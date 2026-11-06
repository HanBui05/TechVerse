package com.techverse.server.course;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.techverse.server.dto.internal.ArticleImageAsset;
import com.techverse.server.dto.internal.ArticleImageAsset.Scope;
import com.techverse.server.entity.*;
import com.techverse.server.enums.CourseLevel;
import com.techverse.server.properties.CloudinaryProperties;
import com.techverse.server.repository.*;
import com.techverse.server.service.ArticleImageStorage;
import com.techverse.server.service.impl.*;

import org.junit.jupiter.api.*;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;

import java.net.URI;
import java.time.Instant;
import java.util.*;

/** Cleanup keeps every image a working copy or any snapshot still references, per scope. */
class ArticleImageCleanupServiceTest {
    static final String FOLDER = "techverse/articles";
    final Instant old = Instant.now().minusSeconds(3 * 24 * 3600);
    final ArticleImageStorage storage = mock(ArticleImageStorage.class);
    final ArticleRepository articles = mock(ArticleRepository.class);
    final ArticlePublicationVersionRepository articleVersions = mock(ArticlePublicationVersionRepository.class);
    final CourseRepository courses = mock(CourseRepository.class);
    final LessonRepository lessons = mock(LessonRepository.class);
    final CoursePublicationVersionRepository courseVersions = mock(CoursePublicationVersionRepository.class);
    final CourseVersionLessonRepository versionLessons = mock(CourseVersionLessonRepository.class);
    final CloudinaryProperties properties =
            new CloudinaryProperties("test", "k", "s", FOLDER, URI.create("https://api.cloudinary.com"), true);
    final ArticleContentService content = new ArticleContentService();
    final ArticleImageService images =
            new ArticleImageService(null, storage, null, content, null, properties, mock(PlatformTransactionManager.class));
    final ArticleImageCleanupService cleanup =
            new ArticleImageCleanupService(
                    storage, images, articles, articleVersions, content, properties,
                    mock(PlatformTransactionManager.class), courses, lessons, courseVersions, versionLessons);
    final User author = withId(User.createLocalAccount("A", "a@example.com", "x"));
    final Map<String, ArticleImageAsset> cloud = new HashMap<>();
    Course course;
    Lesson lesson;

    @BeforeEach
    void setup() {
        when(storage.configured()).thenReturn(true);
        when(storage.find(anyString())).thenAnswer(i -> Optional.ofNullable(cloud.get(i.<String>getArgument(0))));
        when(storage.list(any())).thenAnswer(i -> new ArticleImageStorage.AssetPage(new ArrayList<>(cloud.values()), null));
        when(storage.retire(any())).thenAnswer(i -> i.<ArticleImageAsset>getArgument(0).toBuilder().retiring(true).build());
        doAnswer(i -> cloud.values().removeIf(a -> a.assetId().equals(i.getArgument(0)))).when(storage).delete(anyString());
        course = withId(Course.builder().author(author).topic(withId(Topic.builder().name("B").build()))
                .title("T").summary("S").description("D").level(CourseLevel.BEGINNER).build());
        var chapter = withId(course.addChapter("C", 1));
        lesson = withId(course.addLesson(chapter, "L", null, "text", null, false, 1));
        touch(course, old);
        touch(lesson, old);
        when(courses.findByIdForUpdate(course.getId())).thenReturn(Optional.of(course));
        when(lessons.findById(lesson.getId())).thenReturn(Optional.of(lesson));
        when(courseVersions.findImageSources(any())).thenReturn(List.of());
        when(versionLessons.findContentsByLessonId(any())).thenReturn(List.of());
    }

    @Test
    void detachedCourseAndLessonImagesAreDeleted() {
        var cover = asset(Scope.COURSE, course.getId(), null);
        var inline = asset(Scope.LESSON, lesson.getId(), course.getId());
        cleanup.clean();
        verify(storage).delete(cover.assetId());
        verify(storage).delete(inline.assetId());
    }

    @Test
    void imagesInWorkingCopyAreKept() {
        var cover = asset(Scope.COURSE, course.getId(), null);
        var inline = asset(Scope.LESSON, lesson.getId(), course.getId());
        course.edit(course.getTopic(), "T", "S", "![x](" + cover.url() + ")", CourseLevel.BEGINNER, null);
        lesson.edit("L", null, "![y](" + inline.url() + ")", null, false);
        cleanup.clean();
        verify(storage, never()).delete(anyString());
    }

    @Test
    void imagesInAnySnapshotAreKept() {
        var cover = asset(Scope.COURSE, course.getId(), null);
        var inline = asset(Scope.LESSON, lesson.getId(), course.getId());
        when(courseVersions.findImageSources(course.getId()))
                .thenReturn(List.<Object[]>of(new Object[] {"D", cover.url()}));
        when(versionLessons.findContentsByLessonId(lesson.getId()))
                .thenReturn(Arrays.asList(null, "![y](" + inline.url() + ")"));
        cleanup.clean();
        verify(storage, never()).delete(anyString());
    }

    @Test
    void snapshotReferenceKeepsLessonImageEvenWithoutWorkingRow() {
        var orphan = asset(Scope.LESSON, UUID.randomUUID(), course.getId());
        when(versionLessons.findContentsByLessonId(orphan.articleId()))
                .thenReturn(List.of("![y](" + orphan.url() + ")"));
        cleanup.clean();
        verify(storage, never()).delete(anyString());
    }

    @Test
    void recentEditsDelayDeletion() {
        asset(Scope.COURSE, course.getId(), null);
        asset(Scope.LESSON, lesson.getId(), course.getId());
        touch(course, Instant.now());
        touch(lesson, Instant.now());
        cleanup.clean();
        verify(storage, never()).delete(anyString());
    }

    @Test
    void imagesOfDeletedCourseOrLessonAreDeleted() {
        var gone = asset(Scope.LESSON, UUID.randomUUID(), course.getId());
        var orphan = asset(Scope.COURSE, UUID.randomUUID(), null);
        cleanup.clean();
        verify(storage).delete(gone.assetId());
        verify(storage).delete(orphan.assetId());
    }

    @Test
    void articleScopeBehavesAsBefore() {
        var a = asset(null, UUID.randomUUID(), null);
        cleanup.clean();
        verify(storage).delete(a.assetId());
        verifyNoInteractions(courses, lessons);
    }

    private ArticleImageAsset asset(Scope scope, UUID document, UUID parent) {
        String prefix =
                scope == null ? images.prefix(author.getId(), document) : images.prefix(scope, author.getId(), document, parent);
        String publicId = prefix + UUID.randomUUID();
        var a = ArticleImageAsset.builder()
                .assetId(UUID.randomUUID().toString())
                .publicId(publicId)
                .url("https://res.cloudinary.com/test/image/upload/v1/" + publicId + ".png")
                .ownerId(author.getId())
                .articleId(document)
                .scope(scope)
                .parentId(parent)
                .width(1).height(1)
                .createdAt(old)
                .build();
        cloud.put(publicId, a);
        return a;
    }

    private static void touch(Object entity, Instant at) {
        ReflectionTestUtils.setField(entity, "updatedAt", at);
    }

    private static <T> T withId(T entity) {
        ReflectionTestUtils.setField(entity, "id", UUID.randomUUID());
        return entity;
    }
}
