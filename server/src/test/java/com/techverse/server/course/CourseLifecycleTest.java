package com.techverse.server.course;

import static org.assertj.core.api.Assertions.*;

import com.techverse.server.entity.*;
import com.techverse.server.enums.*;
import com.techverse.server.exception.*;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.*;

/** Pure state machine of {@link Course}: no Spring, no database. */
class CourseLifecycleTest {
    static final String VIDEO = "https://youtu.be/dQw4w9WgXcQ";
    final User author = withId(User.createLocalAccount("Author", "a@example.com", "x"));
    final User moderator = withId(User.createLocalAccount("Mod", "m@example.com", "x"));
    final Topic topic = withId(Topic.builder().name("Backend").build());
    final Tag java = withId(Tag.builder().name("Java").build());
    final Instant now = Instant.parse("2026-11-07T00:00:00Z");

    @Test
    void newCourseIsUnpublishedDraft() {
        Course c = course();
        assertThat(c.getWorkflowStatus()).isEqualTo(ArticleWorkflowStatus.DRAFT);
        assertThat(c.getPublicationStatus()).isEqualTo(ArticlePublicationStatus.UNPUBLISHED);
        assertThat(c.getContentFingerprint()).matches("[a-f0-9]{64}");
        assertThat(c.hasUnpublishedChanges()).isFalse();
    }

    @Test
    void lessonNeedsVideoOrContentAndValidYoutube() {
        Course c = course();
        var ch = c.addChapter("Intro", 1);
        expect(ErrorCode.LESSON_CONTENT_REQUIRED, () -> c.addLesson(ch, "L", null, " ", null, false, 1));
        expect(ErrorCode.LESSON_VIDEO_INVALID, () -> c.addLesson(ch, "L", null, null, "https://evil.com/x", false, 1));
        var video = c.addLesson(ch, "V", null, null, VIDEO, true, 1);
        assertThat(video.getVideoProvider()).isEqualTo("YOUTUBE");
        assertThat(video.getVideoId()).isEqualTo("dQw4w9WgXcQ");
        assertThat(video.getContent()).isNull();
        assertThat(video.getContentFingerprint()).matches("[a-f0-9]{64}");
    }

    @Test
    void submitRequiresChapterWithLessonAndEachChapterNonEmpty() {
        Course c = course();
        expect(ErrorCode.COURSE_NOT_READY, c::submit);
        var ch = c.addChapter("Intro", 1);
        c.save();
        expect(ErrorCode.COURSE_NOT_READY, c::submit);
        c.addLesson(ch, "L1", null, "text", null, false, 1);
        c.addChapter("Empty", 2);
        c.save();
        expect(ErrorCode.COURSE_NOT_READY, c::submit);
        assertThat(c.getWorkflowStatus()).isEqualTo(ArticleWorkflowStatus.DRAFT);
    }

    @Test
    void approveCreatesVersionOneWithCurriculumSnapshot() {
        Course c = pending();
        var history = c.approve(moderator, null, now);
        var v = c.getPublishedVersion();
        assertThat(v.getVersionNumber()).isEqualTo(1);
        assertThat(v.getContentFingerprint()).isEqualTo(c.getContentFingerprint());
        assertThat(v.getTags()).extracting(t -> t.getTag().getName()).containsExactly("Java");
        assertThat(v.getChapters()).hasSize(1);
        assertThat(v.getLessons()).extracting(CourseVersionLesson::getTitle).containsExactly("L1", "L2");
        assertThat(v.getLessons().get(0).getLesson().getId()).isEqualTo(c.activeLessons().get(0).getId());
        assertThat(c.getPublicationStatus()).isEqualTo(ArticlePublicationStatus.PUBLISHED);
        assertThat(c.getWorkflowStatus()).isEqualTo(ArticleWorkflowStatus.PUBLISHED);
        assertThat(c.getPublishedAt()).isEqualTo(now);
        assertThat(history.getAction()).isEqualTo(ArticleModerationAction.APPROVE);
        assertThat(history.getVersion()).isSameAs(v);
    }

    @Test
    void editingKeepsSnapshotAndMarksUnpublishedChanges() {
        Course c = published();
        var v1 = c.getPublishedVersion();
        c.activeLessons().get(0).edit("L1 new", null, "changed", null, false);
        assertThat(c.save()).isTrue();
        assertThat(c.getWorkflowStatus()).isEqualTo(ArticleWorkflowStatus.DRAFT);
        assertThat(c.getPublishedVersion()).isSameAs(v1);
        assertThat(v1.getLessons().get(0).getTitle()).isEqualTo("L1");
        assertThat(c.hasUnpublishedChanges()).isTrue();
        assertThat(c.save()).isFalse();
    }

    @Test
    void submittingUnchangedPublishedCourseIsRejected() {
        Course c = published();
        expect(ErrorCode.COURSE_NO_CHANGES, c::submit);
    }

    @Test
    void withdrawAndRequestChanges() {
        Course c = pending();
        c.withdraw();
        assertThat(c.getWorkflowStatus()).isEqualTo(ArticleWorkflowStatus.DRAFT);
        expect(ErrorCode.COURSE_NOT_WITHDRAWABLE, c::withdraw);
        c.submit();
        var h = c.requestChanges(moderator, "fix", now);
        assertThat(c.getWorkflowStatus()).isEqualTo(ArticleWorkflowStatus.CHANGES_REQUESTED);
        assertThat(c.getModerationNote()).isEqualTo("fix");
        assertThat(h.getAction()).isEqualTo(ArticleModerationAction.REQUEST_CHANGES);
        expect(ErrorCode.COURSE_NOT_PENDING, () -> c.approve(moderator, null, now));
        expect(ErrorCode.COURSE_NOT_PENDING, () -> c.requestChanges(moderator, "x", now));
    }

    @Test
    void pendingCourseCannotBeEdited() {
        Course c = pending();
        expect(ErrorCode.COURSE_NOT_EDITABLE, c::save);
        expect(ErrorCode.COURSE_NOT_EDITABLE, () -> c.addChapter("X", 9));
    }

    @Test
    void neverApprovedLessonAndChapterAreHardDeleted() {
        Course c = course();
        var ch = c.addChapter("Intro", 1);
        var l = c.addLesson(ch, "L1", null, "t", null, false, 1);
        persist(c);
        c.removeLesson(l);
        assertThat(ch.getLessons()).isEmpty();
        c.removeChapter(ch);
        assertThat(c.getChapters()).isEmpty();
    }

    @Test
    void approvedLessonIsArchivedKeepingIdAndDroppedFromNextVersion() {
        Course c = published();
        var l1 = c.activeLessons().get(0);
        UUID id = l1.getId();
        c.removeLesson(l1);
        assertThat(l1.getArchivedAt()).isNotNull();
        assertThat(l1.getChapter().getLessons()).contains(l1);
        assertThat(c.activeLessons()).hasSize(1);
        assertThat(c.getPublishedVersion().getLessons()).hasSize(2); // v1 untouched
        assertThat(c.save()).isTrue();
        c.submit();
        c.approve(moderator, null, now.plusSeconds(1));
        var v2 = c.getPublishedVersion();
        assertThat(v2.getVersionNumber()).isEqualTo(2);
        assertThat(v2.getLessons()).hasSize(1); // new denominator
        assertThat(v2.getLessons()).noneMatch(x -> x.getLesson().getId().equals(id));
        assertThat(l1.getId()).isEqualTo(id);
    }

    @Test
    void archivingApprovedChapterArchivesItsLessons() {
        Course c = published();
        c.addChapter("Second", 2);
        var ch = c.getChapters().get(0);
        c.removeChapter(ch);
        assertThat(ch.getArchivedAt()).isNotNull();
        assertThat(ch.getLessons()).allMatch(l -> l.getArchivedAt() != null);
        assertThat(c.activeLessons()).isEmpty();
    }

    @Test
    void lessonAddedAfterApprovalIsHardDeletedUntilNextApproval() {
        Course c = published();
        var ch = c.getChapters().get(0);
        var extra = c.addLesson(ch, "L3", null, "t", null, false, 3);
        persist(c);
        c.removeLesson(extra);
        assertThat(ch.getLessons()).doesNotContain(extra);
    }

    @Test
    void archivingApprovedChapterHardDeletesItsNeverPublishedLessons() {
        Course c = published();
        var ch = c.getChapters().get(0);
        var extra = c.addLesson(ch, "L3", null, "t", null, false, 3);
        persist(c);
        c.removeChapter(ch);
        assertThat(ch.getLessons()).doesNotContain(extra).hasSize(2);
    }

    @Test
    void lessonDroppedInVersionTwoSurvivesLaterChapterAndLessonRemoval() {
        Course c = published();
        var ch = c.getChapters().get(0);
        var old = c.activeLessons().get(0);
        c.removeLesson(old);
        c.save();
        c.submit();
        c.approve(moderator, null, now.plusSeconds(1)); // v2 no longer has `old`
        c.removeLesson(old); // already archived: no-op, not a delete
        assertThat(ch.getLessons()).contains(old);
        c.removeChapter(ch);
        assertThat(ch.getLessons()).contains(old);
        assertThat(old.getArchivedAt()).isNotNull();
    }

    @Test
    void replacingPublishedLessonByIdenticalNewOneIsAChange() {
        Course c = published();
        var ch = c.getChapters().get(0);
        var old = c.activeLessons().get(0);
        c.removeLesson(old);
        c.addLesson(ch, old.getTitle(), old.getSummary(), old.getContent(), null, old.isPreview(), old.getPosition());
        persist(c);
        c.save();
        assertThat(c.hasUnpublishedChanges()).isTrue();
        c.submit();
    }

    @Test
    void aiProvenanceChangeIsAChange() {
        Course c = published();
        c.activeLessons().get(0).markAiAssisted();
        assertThat(c.save()).isTrue();
        c.submit();
    }

    // ------------------------------------------------------------------ helpers

    @Test
    void discardRestoresTreeFromSnapshotAndKeepsOlderArchives() {
        Course c = published();
        var ch = c.activeChapters().get(0);
        var l1 = c.activeLessons().get(0);
        var l2 = c.activeLessons().get(1);
        // v2 drops L2 (archived, older version only)
        c.removeLesson(l2);
        c.save();
        c.submit();
        c.approve(moderator, null, now);
        persist(c);
        String v2 = c.getPublishedVersion().getContentFingerprint();
        // edits after v2: rename chapter, edit L1, archive L1 via chapter? no: add L3, remove L1
        c.editChapter(ch, "Renamed");
        var l3 = c.addLesson(ch, "L3", null, "three", null, false, 2);
        persist(c);
        c.removeLesson(l1);
        c.edit(topic, "New title", "S", "D", CourseLevel.ADVANCED, null);
        c.save();
        assertThat(c.hasUnpublishedChanges()).isTrue();

        c.discard();

        assertThat(c.getTitle()).isEqualTo("T");
        assertThat(c.getLevel()).isEqualTo(CourseLevel.BEGINNER);
        assertThat(ch.getTitle()).isEqualTo("Intro");
        assertThat(l1.isActive()).isTrue();
        assertThat(ch.getLessons()).doesNotContain(l3);
        assertThat(l2.isActive()).isFalse(); // archived in an older version stays archived
        assertThat(ch.getLessons()).contains(l2);
        assertThat(c.getContentFingerprint()).isEqualTo(v2);
        assertThat(c.computeFingerprint()).isEqualTo(v2);
        assertThat(c.getWorkflowStatus()).isEqualTo(ArticleWorkflowStatus.PUBLISHED);
        assertThat(c.hasUnpublishedChanges()).isFalse();
    }

    @Test
    void discardNeedsPublishedVersionAndEditableRevision() {
        expect(ErrorCode.COURSE_NOT_DISCARDABLE, course()::discard);
        Course c = published();
        c.edit(topic, "X", "S", "D", CourseLevel.BEGINNER, null);
        c.save();
        c.submit();
        expect(ErrorCode.COURSE_NOT_DISCARDABLE, c::discard);
    }

    @Test
    void authorHideUnhideAndDelete() {
        Course c = published();
        var hide = c.authorHide(author);
        assertThat(hide.getAction()).isEqualTo(ArticleModerationAction.AUTHOR_HIDE);
        assertThat(c.getPublicationStatus()).isEqualTo(ArticlePublicationStatus.AUTHOR_HIDDEN);
        expect(ErrorCode.COURSE_PUBLICATION_TRANSITION_INVALID, () -> c.authorHide(author));
        c.authorUnhide(author);
        assertThat(c.getPublicationStatus()).isEqualTo(ArticlePublicationStatus.PUBLISHED);
        expect(ErrorCode.COURSE_PUBLICATION_TRANSITION_INVALID, () -> c.authorUnhide(author));
        assertThat(c.isHardDeletable()).isFalse();
        var del = c.softDelete(author);
        assertThat(del.getAction()).isEqualTo(ArticleModerationAction.AUTHOR_DELETE);
        assertThat(c.getPublicationStatus()).isEqualTo(ArticlePublicationStatus.AUTHOR_DELETED);
        expect(ErrorCode.COURSE_NOT_DELETABLE, () -> c.softDelete(author));
        assertThat(course().isHardDeletable()).isTrue();
        expect(ErrorCode.COURSE_NOT_DELETABLE, () -> course().softDelete(author));
    }

    @Test
    void reorderNeedsExactlyTheActiveIds() {
        Course c = course();
        var a = c.addChapter("A", 1);
        var b = c.addChapter("B", 2);
        var l1 = c.addLesson(a, "L1", null, "x", null, false, 1);
        var l2 = c.addLesson(a, "L2", null, "y", null, false, 2);
        persist(c);
        expect(ErrorCode.COURSE_ORDER_INVALID, () -> c.reorderChapters(List.of(a.getId()), 0));
        expect(ErrorCode.COURSE_ORDER_INVALID, () -> c.reorderChapters(List.of(a.getId(), a.getId()), 0));
        expect(ErrorCode.COURSE_ORDER_INVALID, () -> c.reorderChapters(List.of(a.getId(), b.getId(), l1.getId()), 0));
        expect(ErrorCode.COURSE_ORDER_INVALID, () -> c.reorderLessons(b, List.of(l1.getId(), l2.getId()), 0));
        c.reorderChapters(List.of(b.getId(), a.getId()), 0);
        c.reorderLessons(a, List.of(l2.getId(), l1.getId()), 1000);
        assertThat(c.activeChapters()).containsExactly(b, a);
        assertThat(l2.getPosition()).isEqualTo(1001);
        assertThat(l1.getPosition()).isEqualTo(1002);
    }

    private Course course() {
        Course c = withId(Course.builder().author(author).topic(topic).title("T").summary("S")
                .description("D").level(CourseLevel.BEGINNER).build());
        c.replaceTags(List.of(java));
        c.save();
        return c;
    }

    private Course pending() {
        Course c = course();
        var ch = c.addChapter("Intro", 1);
        c.addLesson(ch, "L1", null, "one", null, true, 1);
        c.addLesson(ch, "L2", null, null, VIDEO, false, 2);
        c.save();
        persist(c);
        c.submit();
        return c;
    }

    private Course published() {
        Course c = pending();
        c.approve(moderator, null, now);
        persist(c);
        return c;
    }

    /** Stands in for the database assigning IDs. */
    private static void persist(Course c) {
        c.getChapters().forEach(ch -> {
            if (ch.getId() == null) withId(ch);
            ch.getLessons().forEach(l -> { if (l.getId() == null) withId(l); });
        });
    }

    private static void expect(ErrorCode code, Executable call) {
        assertThatThrownBy(call::execute)
                .isInstanceOfSatisfying(CustomException.class, e -> assertThat(e.getErrorCode()).isEqualTo(code));
    }

    private static <T> T withId(T entity) {
        ReflectionTestUtils.setField(entity, "id", UUID.randomUUID());
        return entity;
    }
}
