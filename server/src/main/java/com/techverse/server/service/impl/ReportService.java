package com.techverse.server.service.impl;

import static com.techverse.server.entity.Report.FORUM_POST;
import static com.techverse.server.enums.ForumPostStatus.*;

import com.techverse.server.dto.request.ReportRequest;
import com.techverse.server.dto.response.*;
import com.techverse.server.dto.response.ReportResponse.*;
import com.techverse.server.entity.*;
import com.techverse.server.enums.*;
import com.techverse.server.exception.*;
import com.techverse.server.repository.*;

import lombok.RequiredArgsConstructor;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Reports on forum posts and their moderation. Lock order matches {@link ForumService}: the actor, the question,
 * the answer (when the target is one), then the target's open reports in id order.
 */
@Service
@RequiredArgsConstructor
public class ReportService {
    private final ArticleAccessService access;
    private final ForumService forum;
    private final ForumPostRepository posts;
    private final ReportRepository reports;
    private final UserRepository users;

    // ------------------------------------------------------------------ users

    @Transactional
    public Created create(UUID actor, ReportRequest.Create r) {
        var reporter = access.lockActiveUser(actor);
        UUID targetId = UUID.fromString(r.targetId());
        var target = lockPost(targetId).filter(ReportService::reportable).orElseThrow(() -> new CustomException(ErrorCode.REPORT_TARGET_NOT_FOUND));
        if (target.isOwnedBy(actor)) throw new CustomException(ErrorCode.REPORT_OWN_CONTENT);
        if (reports.existsByReporter_IdAndTargetTypeAndTargetId(actor, FORUM_POST, targetId))
            throw new CustomException(ErrorCode.REPORT_ALREADY_SUBMITTED);
        forum.rateLimit(actor, ForumService.RateKind.REPORT);
        try {
            var saved = reports.saveAndFlush(Report.forumPost(reporter, targetId, r.reasonValue(), r.description()));
            return new Created(saved.getId(), saved.getStatus(), saved.getCreatedAt());
        } catch (DataIntegrityViolationException e) {
            // The unique key is the last net behind the target lock.
            throw new CustomException(ErrorCode.REPORT_ALREADY_SUBMITTED);
        }
    }

    // ------------------------------------------------------------------ moderators

    @Transactional(readOnly = true)
    public PageResponse<Item> queue(UUID actor, ReportRequest.Queue f) {
        checkModerator(users.findWithRolesById(actor).orElse(null));
        Specification<Report> spec = (r, q, cb) -> cb.and(cb.equal(r.get("targetType"), FORUM_POST), cb.equal(r.get("status"), f.getStatus()));
        if (f.getReason() != null) spec = spec.and((r, q, cb) -> cb.equal(r.get("reason"), f.getReason()));
        // Open reports are worked oldest first; closed ones are browsed newest first.
        var order = f.getStatus() == ReportStatus.OPEN ? Sort.Direction.ASC : Sort.Direction.DESC;
        var page = reports.findAll(spec, PageRequest.of(f.getPage(), f.getSize(), Sort.by(order, "createdAt").and(Sort.by("id"))));
        return PageResponse.from(page, items(page.getContent()));
    }

    @Transactional
    public Item resolve(UUID actor, UUID reportId, ReportRequest.Resolve r) {
        var moderator = lockModerator(actor);
        UUID targetId = reports.findTargetIdById(reportId).orElseThrow(() -> new CustomException(ErrorCode.REPORT_NOT_FOUND));
        var post = lockPost(targetId).orElseThrow(() -> new CustomException(ErrorCode.REPORT_ALREADY_HANDLED));
        var open = reports.findOpenForUpdate(FORUM_POST, targetId);
        if (open.stream().noneMatch(x -> x.getId().equals(reportId))) throw new CustomException(ErrorCode.REPORT_ALREADY_HANDLED);
        if (r.hide()) {
            if (post.getStatus() != VISIBLE) throw new CustomException(ErrorCode.REPORT_ALREADY_HANDLED);
            post.hide(moderator, r.note());
        }
        var outcome = r.hide() ? ReportStatus.ACTIONED : ReportStatus.DISMISSED;
        open.forEach(x -> x.close(outcome, moderator, r.note()));
        posts.flush();
        return items(open.stream().filter(x -> x.getId().equals(reportId)).toList()).getFirst();
    }

    @Transactional
    public ModeratedPost visibility(UUID actor, UUID postId, ReportRequest.Visibility r) {
        var moderator = lockModerator(actor);
        var post = lockPost(postId).orElseThrow(() -> new CustomException(ErrorCode.FORUM_POST_NOT_FOUND));
        if (!transitionAllowed(post.getStatus(), r.hide())) throw new CustomException(ErrorCode.FORUM_STATE_INVALID);
        if (r.hide()) {
            post.hide(moderator, r.note());
            reports.findOpenForUpdate(FORUM_POST, postId).forEach(x -> x.close(ReportStatus.ACTIONED, moderator, r.note()));
        } else {
            // Restoring skips the 200-answer cap on purpose.
            post.restore(r.note());
        }
        posts.flush();
        return view(post);
    }

    @Transactional(readOnly = true)
    public PageResponse<ModeratedPost> hidden(UUID actor, ReportRequest.Hidden f) {
        checkModerator(users.findWithRolesById(actor).orElse(null));
        var page = posts.findByStatus(HIDDEN, PageRequest.of(f.getPage(), f.getSize(), Sort.by(Sort.Direction.DESC, "hiddenAt").and(Sort.by("id"))));
        return PageResponse.from(page, page.stream().map(ReportService::view).toList());
    }

    // ------------------------------------------------------------------ rules (pure)

    /** A reader can report a post they can see: VISIBLE, and for an answer, a question that is not HIDDEN. */
    public static boolean reportable(ForumPost p) {
        return p.isQuestion() ? p.getStatus() == VISIBLE : ForumService.answerReadable(p);
    }

    public static boolean publiclyVisible(ForumPost p) {
        return reportable(p);
    }

    /** HIDE only from VISIBLE; RESTORE only from HIDDEN. */
    public static boolean transitionAllowed(ForumPostStatus current, boolean hide) {
        return current == (hide ? VISIBLE : HIDDEN);
    }

    // ------------------------------------------------------------------ helpers

    /** Reads the parent without a lock, then locks the question before the answer. Empty when the post is missing. */
    private Optional<ForumPost> lockPost(UUID id) {
        var parent = posts.findParentIdById(id);
        if (parent.isPresent()) posts.findByIdForUpdate(parent.get());
        return posts.findByIdForUpdate(id);
    }

    private User lockModerator(UUID actor) {
        var user = access.lockActiveUser(actor);
        checkModerator(user);
        return user;
    }

    private static void checkModerator(User user) {
        if (user == null || !user.isActive() || user.getUserRoles().stream().noneMatch(l -> l.getRole().getName() == RoleName.MODERATOR))
            throw new CustomException(ErrorCode.ACCESS_DENIED);
    }

    private List<Item> items(List<Report> page) {
        if (page.isEmpty()) return List.of();
        var targets = page.stream().map(Report::getTargetId).collect(Collectors.toSet());
        var byId = posts.findModerated(targets).stream().collect(Collectors.toMap(ForumPost::getId, Function.identity()));
        var open = new HashMap<UUID, Long>();
        for (Object[] row : reports.countOpen(FORUM_POST, targets)) open.put((UUID) row[0], (Long) row[1]);
        return page.stream().map(x -> {
            long others = open.getOrDefault(x.getTargetId(), 0L) - (x.getStatus() == ReportStatus.OPEN ? 1 : 0);
            return new Item(x.getId(), x.getReason(), x.getDescription(), x.getStatus(), author(x.getReporter()), x.getCreatedAt(),
                    x.getHandledAt(), x.getResolutionNote(), view(byId.get(x.getTargetId())), Math.max(others, 0));
        }).toList();
    }

    private static ModeratedPost view(ForumPost p) {
        var q = p.isQuestion() ? p : p.getParent();
        return new ModeratedPost(p.getId(), p.isQuestion() ? "QUESTION" : "ANSWER", q.getId(), q.getTitle(), p.getContent(), author(p.getUser()),
                p.getStatus(), publiclyVisible(p), p.getModerationNote(), p.getHiddenBy() == null ? null : author(p.getHiddenBy()), p.getHiddenAt());
    }

    private static ArticleAuthorResponse author(User u) {
        return new ArticleAuthorResponse(u.getId(), u.getFullName(), u.getAvatarUrl());
    }
}
