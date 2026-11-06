package com.techverse.server.article;

import static com.techverse.server.enums.ArticlePublicationStatus.*;
import static org.assertj.core.api.Assertions.*;

import com.techverse.server.entity.*;
import com.techverse.server.enums.*;
import com.techverse.server.exception.*;
import com.techverse.server.dto.response.*;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.lang.reflect.RecordComponent;
import java.util.*;

/** Pure state machine of {@link Article}: no Spring, no database. */
class ArticleLifecycleTest {
    final User author = withId(User.createLocalAccount("Author", "a@example.com", "x"));
    final User moderator = withId(User.createLocalAccount("Mod", "m@example.com", "x"));
    final Topic topic = withId(Topic.builder().name("Backend").build());
    final Tag java = withId(Tag.builder().name("Java").build());
    final Tag spring = withId(Tag.builder().name("Spring").build());
    final Instant now = Instant.parse("2026-11-04T00:00:00Z");

    @Test
    void fingerprintIsCanonicalStableAndIgnoresTagOrder() {
        UUID t = topic.getId(), a = java.getId(), b = spring.getId();
        String fp = Article.fingerprint("T", "S", "C", null, t, List.of(a, b));
        assertThat(fp).matches("[a-f0-9]{64}");
        assertThat(Article.fingerprint("T", "S", "C", null, t, List.of(b, a))).isEqualTo(fp);
        // Length-prefixing keeps field boundaries and null distinct from empty.
        assertThat(Article.fingerprint("TS", "", "C", null, t, List.of(a, b))).isNotEqualTo(fp);
        assertThat(Article.fingerprint("T", "S", "C", "", t, List.of(a, b))).isNotEqualTo(fp);
        assertThat(Article.fingerprint("T", "S", "C", null, t, List.of(a))).isNotEqualTo(fp);
    }

    @Test
    void newArticleIsUnpublishedDraftWithWorkingFingerprint() {
        Article a = draft();
        assertThat(a.getWorkflowStatus()).isEqualTo(ArticleWorkflowStatus.DRAFT);
        assertThat(a.getPublicationStatus()).isEqualTo(UNPUBLISHED);
        assertThat(a.getContentFingerprint()).isEqualTo(a.computeFingerprint());
        assertThat(a.hasUnpublishedChanges()).isFalse();
        assertThat(a.isAiAssisted()).isFalse();
    }

    @Test
    void aiAssistedProvenanceOnlyMovesToTrueAndSurvivesLifecycle() {
        Article a = draft();
        a.markAiAssisted();
        a.markAiAssisted();
        assertThat(a.isAiAssisted()).isTrue();

        a.edit(topic, "AI revision", a.getSummary(), a.getContent(), null);
        a.save();
        a.submit();
        a.approve(moderator, null, now, 1);
        a.edit(topic, "Another revision", a.getSummary(), a.getContent(), null);
        a.save();
        a.discard();
        a.authorHide(author);
        a.authorUnhide(author);

        assertThat(a.isAiAssisted()).isTrue();
    }

    @Test
    void publicSavedAndRelatedContractsDoNotExposeAiProvenance() {
        for (Class<?> type :
                List.of(
                        PublishedArticleSummaryResponse.class,
                        PublishedArticleDetailResponse.class,
                        SavedArticleSummaryResponse.class,
                        RelatedArticleResponse.class)) {
            assertThat(type.getRecordComponents())
                    .extracting(RecordComponent::getName)
                    .doesNotContain("aiAssisted");
        }
    }

    @Test
    void firstApprovalCreatesVersionOneAndPublishes() {
        Article a = pending();
        var history = a.approve(moderator, null, now, 3);
        var v = a.getPublishedVersion();
        assertThat(v.getVersionNumber()).isEqualTo(1);
        assertThat(v.getContentFingerprint()).isEqualTo(a.getContentFingerprint());
        assertThat(v.getReadingMinutes()).isEqualTo(3);
        assertThat(v.getTags()).extracting(t -> t.getTag().getName()).containsExactly("Java");
        assertThat(a.getPublicationStatus()).isEqualTo(PUBLISHED);
        assertThat(a.getWorkflowStatus()).isEqualTo(ArticleWorkflowStatus.PUBLISHED);
        assertThat(a.getPublishedAt()).isEqualTo(now);
        assertThat(history.getAction()).isEqualTo(ArticleModerationAction.APPROVE);
        assertThat(history.getFromWorkflowStatus()).isEqualTo(ArticleWorkflowStatus.PENDING);
        assertThat(history.getToPublicationStatus()).isEqualTo(PUBLISHED);
        assertThat(history.getVersion()).isSameAs(v);
    }

    @Test
    void savingUnchangedPublishedArticleIsNoOp() {
        Article a = published();
        assertThat(a.save()).isFalse();
        assertThat(a.getWorkflowStatus()).isEqualTo(ArticleWorkflowStatus.PUBLISHED);
    }

    @Test
    void editingPublishedArticleKeepsSnapshotAndStartsDraftRevision() {
        Article a = published();
        var snapshot = a.getPublishedVersion();
        a.edit(topic, "New title", a.getSummary(), a.getContent(), null);
        assertThat(a.save()).isTrue();
        assertThat(a.getWorkflowStatus()).isEqualTo(ArticleWorkflowStatus.DRAFT);
        assertThat(a.getPublicationStatus()).isEqualTo(PUBLISHED);
        assertThat(a.getPublishedVersion()).isSameAs(snapshot);
        assertThat(snapshot.getTitle()).isEqualTo("Title");
        assertThat(a.hasUnpublishedChanges()).isTrue();
    }

    @Test
    void submittingContentIdenticalToSnapshotIsRejectedInEveryWorkflow() {
        Article a = published();
        expect(ErrorCode.ARTICLE_NO_CHANGES, a::submit);
        a.edit(topic, "Other", a.getSummary(), a.getContent(), null);
        a.save();
        a.edit(topic, "Title", a.getSummary(), a.getContent(), null); // back to the snapshot
        a.save();
        expect(ErrorCode.ARTICLE_NO_CHANGES, a::submit);
        assertThat(a.getWorkflowStatus()).isEqualTo(ArticleWorkflowStatus.DRAFT);
    }

    @Test
    void secondApprovalReplacesSnapshotButKeepsFirstPublishedAt() {
        Article a = published();
        a.edit(topic, "V2", a.getSummary(), a.getContent(), null);
        a.submit();
        Instant later = now.plusSeconds(60);
        a.approve(moderator, null, later, 1);
        assertThat(a.getPublishedVersion().getVersionNumber()).isEqualTo(2);
        assertThat(a.getPublishedVersion().getApprovedAt()).isEqualTo(later);
        assertThat(a.getPublishedAt()).isEqualTo(now);
    }

    @Test
    void requestChangesKeepsPublicSnapshot() {
        Article a = published();
        a.edit(topic, "V2", a.getSummary(), a.getContent(), null);
        a.submit();
        var h = a.requestChanges(moderator, "Fix", now);
        assertThat(a.getWorkflowStatus()).isEqualTo(ArticleWorkflowStatus.CHANGES_REQUESTED);
        assertThat(a.getPublicationStatus()).isEqualTo(PUBLISHED);
        assertThat(a.getModerationNote()).isEqualTo("Fix");
        assertThat(h.getNote()).isEqualTo("Fix");
    }

    @Test
    void withdrawOnlyFromPending() {
        Article a = pending();
        a.withdraw();
        assertThat(a.getWorkflowStatus()).isEqualTo(ArticleWorkflowStatus.DRAFT);
        expect(ErrorCode.ARTICLE_NOT_WITHDRAWABLE, a::withdraw);
    }

    @Test
    void discardRestoresSnapshotIncludingTags() {
        Article a = published();
        a.edit(topic, "Changed", "Changed", "Changed", null);
        a.replaceTags(List.of(spring));
        a.save();
        a.discard();
        assertThat(a.getTitle()).isEqualTo("Title");
        assertThat(a.getContent()).isEqualTo("Content");
        assertThat(a.getArticleTags()).extracting(t -> t.getTag().getName()).containsExactly("Java");
        assertThat(a.getWorkflowStatus()).isEqualTo(ArticleWorkflowStatus.PUBLISHED);
        assertThat(a.hasUnpublishedChanges()).isFalse();
    }

    @Test
    void discardRequiresSnapshotAndEditableRevision() {
        expect(ErrorCode.ARTICLE_NOT_DISCARDABLE, draft()::discard);
        expect(ErrorCode.ARTICLE_NOT_DISCARDABLE, published()::discard);
        Article pending = published();
        pending.edit(topic, "V2", pending.getSummary(), pending.getContent(), null);
        pending.submit();
        expect(ErrorCode.ARTICLE_NOT_DISCARDABLE, pending::discard);
    }

    @Test
    void pendingCannotBeEdited() {
        expect(ErrorCode.ARTICLE_NOT_EDITABLE, pending()::ensureEditable);
    }

    @Test
    void authorHideAndUnhideKeepWorkflow() {
        Article a = published();
        a.edit(topic, "V2", a.getSummary(), a.getContent(), null);
        a.save();
        var h = a.authorHide(author);
        assertThat(a.getPublicationStatus()).isEqualTo(AUTHOR_HIDDEN);
        assertThat(a.getWorkflowStatus()).isEqualTo(ArticleWorkflowStatus.DRAFT);
        assertThat(h.getAction()).isEqualTo(ArticleModerationAction.AUTHOR_HIDE);
        expect(ErrorCode.ARTICLE_PUBLICATION_TRANSITION_INVALID, () -> a.authorHide(author));
        a.authorUnhide(author);
        assertThat(a.getPublicationStatus()).isEqualTo(PUBLISHED);
        expect(ErrorCode.ARTICLE_PUBLICATION_TRANSITION_INVALID, () -> a.authorUnhide(author));
    }

    @Test
    void moderatorHideRemembersSourceAndRestoreReturnsToIt() {
        for (var source : List.of(PUBLISHED, AUTHOR_HIDDEN)) {
            Article a = published();
            if (source == AUTHOR_HIDDEN) a.authorHide(author);
            a.moderatorHide(moderator, "Spam");
            assertThat(a.getPublicationStatus()).isEqualTo(HIDDEN);
            assertThat(a.getHiddenFromPublicationStatus()).isEqualTo(source);
            expect(ErrorCode.ARTICLE_AUTHOR_UNHIDE_NOT_ALLOWED, () -> a.authorUnhide(author));
            expect(ErrorCode.ARTICLE_PUBLICATION_TRANSITION_INVALID, () -> a.authorHide(author));
            a.restore(moderator, null);
            assertThat(a.getPublicationStatus()).isEqualTo(source);
            assertThat(a.getHiddenFromPublicationStatus()).isNull();
        }
    }

    @Test
    void approvingWhileHiddenReturnsToSourceAndAuthorHiddenStaysHidden() {
        Article a = published();
        a.authorHide(author);
        a.moderatorHide(moderator, "Check");
        a.edit(topic, "Fixed", a.getSummary(), a.getContent(), null);
        a.submit();
        a.approve(moderator, null, now, 1);
        assertThat(a.getPublicationStatus()).isEqualTo(AUTHOR_HIDDEN);
        assertThat(a.getHiddenFromPublicationStatus()).isNull();
        a.edit(topic, "Fixed again", a.getSummary(), a.getContent(), null);
        a.submit();
        a.approve(moderator, null, now, 1);
        assertThat(a.getPublicationStatus()).isEqualTo(AUTHOR_HIDDEN);
    }

    @Test
    void removedIsTerminal() {
        Article a = published();
        a.moderatorHide(moderator, "x");
        a.remove(moderator, "Illegal");
        assertThat(a.getPublicationStatus()).isEqualTo(REMOVED);
        assertThat(a.getHiddenFromPublicationStatus()).isNull();
        assertTerminal(a);
    }

    @Test
    void authorDeletedIsTerminalAndOnlyPossibleWithSnapshot() {
        Article draft = draft();
        assertThat(draft.isHardDeletable()).isTrue();
        expect(ErrorCode.ARTICLE_NOT_DELETABLE, () -> draft.softDelete(author));
        Article neverPublishedPending = pending();
        assertThat(neverPublishedPending.isHardDeletable()).isFalse();
        expect(ErrorCode.ARTICLE_NOT_DELETABLE, () -> neverPublishedPending.softDelete(author));

        Article a = published();
        a.edit(topic, "V2", a.getSummary(), a.getContent(), null);
        a.submit();
        assertThat(a.isHardDeletable()).isFalse();
        var h = a.softDelete(author);
        assertThat(a.getPublicationStatus()).isEqualTo(AUTHOR_DELETED);
        assertThat(a.getWorkflowStatus()).isEqualTo(ArticleWorkflowStatus.PENDING);
        assertThat(h.getAction()).isEqualTo(ArticleModerationAction.AUTHOR_DELETE);
        assertTerminal(a);
    }

    @Test
    void softDeletingModeratorHiddenArticleDropsHiddenSource() {
        Article a = published();
        a.moderatorHide(moderator, "x");
        a.softDelete(author);
        assertThat(a.getPublicationStatus()).isEqualTo(AUTHOR_DELETED);
        assertThat(a.getHiddenFromPublicationStatus()).isNull();
    }

    @Test
    void invalidModeratorTransitionsLeaveEntityUnchanged() {
        Article a = draft();
        expect(ErrorCode.ARTICLE_NOT_PENDING, () -> a.approve(moderator, null, now, 1));
        expect(ErrorCode.ARTICLE_NOT_PENDING, () -> a.requestChanges(moderator, "x", now));
        expect(ErrorCode.ARTICLE_PUBLICATION_TRANSITION_INVALID, () -> a.moderatorHide(moderator, "x"));
        expect(ErrorCode.ARTICLE_PUBLICATION_TRANSITION_INVALID, () -> a.restore(moderator, null));
        expect(ErrorCode.ARTICLE_PUBLICATION_TRANSITION_INVALID, () -> a.remove(moderator, "x"));
        assertThat(a.getWorkflowStatus()).isEqualTo(ArticleWorkflowStatus.DRAFT);
        assertThat(a.getPublicationStatus()).isEqualTo(UNPUBLISHED);
        assertThat(a.getPublishedVersion()).isNull();
    }

    private void assertTerminal(Article a) {
        var status = a.getPublicationStatus();
        var workflow = a.getWorkflowStatus();
        expect(ErrorCode.ARTICLE_NOT_EDITABLE, a::ensureEditable);
        expect(ErrorCode.ARTICLE_NOT_EDITABLE, a::submit);
        expect(ErrorCode.ARTICLE_NOT_WITHDRAWABLE, a::withdraw);
        expect(ErrorCode.ARTICLE_NOT_DISCARDABLE, a::discard);
        expect(ErrorCode.ARTICLE_NOT_DELETABLE, () -> a.softDelete(author));
        expect(ErrorCode.ARTICLE_PUBLICATION_TRANSITION_INVALID, () -> a.authorHide(author));
        expect(ErrorCode.ARTICLE_PUBLICATION_TRANSITION_INVALID, () -> a.authorUnhide(author));
        expect(ErrorCode.ARTICLE_PUBLICATION_TRANSITION_INVALID, () -> a.approve(moderator, null, now, 1));
        expect(ErrorCode.ARTICLE_PUBLICATION_TRANSITION_INVALID, () -> a.requestChanges(moderator, "x", now));
        expect(ErrorCode.ARTICLE_PUBLICATION_TRANSITION_INVALID, () -> a.moderatorHide(moderator, "x"));
        expect(ErrorCode.ARTICLE_PUBLICATION_TRANSITION_INVALID, () -> a.restore(moderator, null));
        expect(ErrorCode.ARTICLE_PUBLICATION_TRANSITION_INVALID, () -> a.remove(moderator, "x"));
        assertThat(a.isHardDeletable()).isFalse();
        assertThat(a.getPublicationStatus()).isEqualTo(status);
        assertThat(a.getWorkflowStatus()).isEqualTo(workflow);
    }

    private Article draft() {
        Article a = withId(Article.builder().author(author).topic(topic).title("Title").summary("Summary").content("Content").build());
        a.replaceTags(List.of(java));
        a.save();
        return a;
    }

    private Article pending() {
        Article a = draft();
        a.submit();
        return a;
    }

    private Article published() {
        Article a = pending();
        a.approve(moderator, null, now, 1);
        return a;
    }

    private static void expect(ErrorCode code, Executable action) {
        assertThatThrownBy(action::execute)
                .isInstanceOfSatisfying(CustomException.class, e -> assertThat(e.getErrorCode()).isEqualTo(code));
    }

    private static <T> T withId(T entity) {
        ReflectionTestUtils.setField(entity, "id", UUID.randomUUID());
        return entity;
    }
}
