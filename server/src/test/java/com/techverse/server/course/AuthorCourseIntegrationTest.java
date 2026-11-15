package com.techverse.server.course;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.techverse.server.article.ArticleIntegrationTestBase;
import com.techverse.server.dto.internal.ArticleImageAsset;
import com.techverse.server.dto.internal.DecodedArticleImage;
import com.techverse.server.entity.User;
import com.techverse.server.repository.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.support.TransactionTemplate;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

class AuthorCourseIntegrationTest extends ArticleIntegrationTestBase {
    static final String ROOT = "/api/v1/author/courses";
    static final String VIDEO = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder encoder;
    @Autowired TransactionTemplate tx;
    @Autowired CourseRepository courses;
    @Autowired CourseModerationHistoryRepository histories;
    // Same override set as AuthorArticleIntegrationTest: both classes share one Spring context.
    @MockitoSpyBean AiCompletedGenerationRepository aiGenerations;
    final Map<String, ArticleImageAsset> cloud = new ConcurrentHashMap<>();
    UUID author, other, moderator, topic, tag;
    String token, otherToken, learnerToken;

    @BeforeEach
    void setup() throws Exception {
        jdbc.execute("TRUNCATE techverse.users, techverse.topics, techverse.tags CASCADE");
        jdbc.execute("INSERT INTO techverse.roles(name) VALUES ('LEARNER'),('AUTHOR'),('ADMIN'),('MODERATOR')");
        author = user("author@example.com", true);
        other = user("other@example.com", true);
        user("learner@example.com", false);
        moderator = user("moderator@example.com", false);
        token = login("author@example.com");
        otherToken = login("other@example.com");
        learnerToken = login("learner@example.com");
        topic = jdbc.queryForObject("INSERT INTO techverse.topics(name) VALUES ('Backend') RETURNING id", UUID.class);
        tag = jdbc.queryForObject("INSERT INTO techverse.tags(name) VALUES ('Java') RETURNING id", UUID.class);
        cloud.clear();
        when(imageStorage.configured()).thenReturn(true);
        when(imageStorage.find(anyString())).thenAnswer(i -> Optional.ofNullable(cloud.get(i.<String>getArgument(0))));
        when(imageStorage.upload(anyString(), any(), any(), any(), any(), any()))
                .thenAnswer(
                        i -> {
                            String publicId = i.getArgument(0);
                            DecodedArticleImage image = i.getArgument(5);
                            return cloud.computeIfAbsent(
                                    publicId,
                                    k -> ArticleImageAsset.builder()
                                            .assetId(UUID.randomUUID().toString())
                                            .publicId(k)
                                            .url("https://res.cloudinary.com/test/image/upload/v1/" + k + ".png")
                                            .scope(i.getArgument(1))
                                            .ownerId(i.getArgument(2))
                                            .articleId(i.getArgument(3))
                                            .parentId(i.getArgument(4))
                                            .fingerprint(image.fingerprint())
                                            .width(image.width())
                                            .height(image.height())
                                            .createdAt(Instant.now())
                                            .build());
                        });
        when(imageStorage.renew(any(), any())).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    void createIsIdempotentPerKeyAndRejectsPriceAndBadInput() throws Exception {
        UUID key = UUID.randomUUID();
        var body = Map.of("action", "SAVE", "title", "Spring", "topicId", topic);
        String id = data(createCourse(key, body).andExpect(status().isCreated())
                        .andExpect(jsonPath("$.data.level").value("BEGINNER"))
                        .andExpect(jsonPath("$.data.workflowStatus").value("DRAFT"))
                        .andExpect(jsonPath("$.data.fingerprint").isString())
                        .andExpect(jsonPath("$.data.priceAmount").doesNotExist()))
                .path("id").asText();
        assertThat(data(createCourse(key, body).andExpect(status().isCreated())).path("id").asText()).isEqualTo(id);
        createCourse(key, Map.of("action", "SAVE", "title", "Other", "topicId", topic))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COURSE_KEY_CONFLICT"));
        createCourse(UUID.randomUUID(), Map.of("action", "SAVE", "topicId", topic))
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        createCourse(UUID.randomUUID(), Map.of("action", "SAVE", "title", "T", "topicId", topic, "level", "EXPERT"))
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        createCourse(UUID.randomUUID(), Map.of("action", "SAVE", "title", "T", "topicId", topic, "priceAmount", 0))
                .andExpect(status().isBadRequest());
        createCourse(UUID.randomUUID(), Map.of("action", "SAVE", "title", "T", "topicId", topic, "description", "<b>x</b>"))
                .andExpect(jsonPath("$.code").value("COURSE_CONTENT_INVALID"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.courses", Integer.class)).isEqualTo(1);
    }

    @Test
    void onlyOwnerSeesCourseAndSuspendedAuthorCanOnlyReadAndDelete() throws Exception {
        String id = newCourse();
        mvc.perform(get(ROOT + "/" + id).header("Authorization", "Bearer " + otherToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COURSE_NOT_FOUND"));
        mvc.perform(get(ROOT).header("Authorization", "Bearer " + learnerToken)).andExpect(status().isForbidden());
        mvc.perform(get(ROOT).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].id").value(id));
        jdbc.update("UPDATE techverse.author_profiles SET status='SUSPENDED' WHERE user_id=?", author);
        mvc.perform(get(ROOT + "/" + id).header("Authorization", "Bearer " + token)).andExpect(status().isOk());
        patchCourse(id, Map.of("action", "SAVE", "title", "X")).andExpect(status().isForbidden());
        mvc.perform(delete(ROOT + "/" + id).header("Authorization", "Bearer " + token)).andExpect(status().isOk());
        mvc.perform(get(ROOT + "/" + id).header("Authorization", "Bearer " + token)).andExpect(status().isNotFound());
    }

    @Test
    void curriculumCrudReorderAndLessonDetail() throws Exception {
        String id = newCourse();
        String a = lastChapter(send(post(ROOT + "/" + id + "/chapters"), Map.of("title", "A")).andExpect(status().isCreated()));
        String b = lastChapter(send(post(ROOT + "/" + id + "/chapters"), Map.of("title", "B")));
        UUID key = UUID.randomUUID();
        var lessonBody = Map.of("title", "L1", "content", "# Hello", "preview", true);
        String l1 = data(createLesson(id, a, key, lessonBody).andExpect(status().isCreated())
                        .andExpect(jsonPath("$.data.content").value("# Hello"))
                        .andExpect(jsonPath("$.data.video").doesNotExist()))
                .path("id").asText();
        assertThat(data(createLesson(id, a, key, lessonBody)).path("id").asText()).isEqualTo(l1);
        String l2 = data(createLesson(id, a, UUID.randomUUID(), Map.of("title", "L2", "videoUrl", VIDEO))
                        .andExpect(jsonPath("$.data.video.provider").value("YOUTUBE"))
                        .andExpect(jsonPath("$.data.video.videoId").value("dQw4w9WgXcQ"))
                        .andExpect(jsonPath("$.data.videoUrl").doesNotExist()))
                .path("id").asText();
        createLesson(id, a, UUID.randomUUID(), Map.of("title", "Bad", "videoUrl", "https://evil.com/watch?v=dQw4w9WgXcQ"))
                .andExpect(jsonPath("$.code").value("LESSON_VIDEO_INVALID"));
        createLesson(id, a, UUID.randomUUID(), Map.of("title", "Empty", "content", " "))
                .andExpect(jsonPath("$.code").value("LESSON_CONTENT_REQUIRED"));

        send(put(ROOT + "/" + id + "/chapters:reorder"), Map.of("ids", List.of(a)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COURSE_ORDER_INVALID"));
        send(put(ROOT + "/" + id + "/chapters:reorder"), Map.of("ids", List.of(a, a)))
                .andExpect(jsonPath("$.code").value("COURSE_ORDER_INVALID"));
        send(put(ROOT + "/" + id + "/chapters:reorder"), Map.of("ids", List.of(b, a))).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.chapters[0].id").value(b));
        send(put(ROOT + "/" + id + "/chapters/" + b + "/lessons:reorder"), Map.of("ids", List.of(l1, l2)))
                .andExpect(jsonPath("$.code").value("COURSE_ORDER_INVALID"));
        send(put(ROOT + "/" + id + "/chapters/" + a + "/lessons:reorder"), Map.of("ids", List.of(l2, l1)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.chapters[1].lessons[0].id").value(l2))
                .andExpect(jsonPath("$.data.chapters[1].lessons[0].hasVideo").value(true))
                .andExpect(jsonPath("$.data.chapters[1].lessons[0].content").doesNotExist());

        send(patch(ROOT + "/" + id + "/lessons/" + l1), Map.of("title", "L1b", "videoUrl", VIDEO))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("L1b"))
                .andExpect(jsonPath("$.data.content").value("# Hello"));
        var cleared = new HashMap<String, Object>();
        cleared.put("content", null);
        send(patch(ROOT + "/" + id + "/lessons/" + l1), cleared)
                .andExpect(jsonPath("$.data.content").doesNotExist())
                .andExpect(jsonPath("$.data.video.videoId").value("dQw4w9WgXcQ"));
        send(patch(ROOT + "/" + id + "/chapters/" + a), Map.of("title", "A2"))
                .andExpect(jsonPath("$.data.chapters[1].title").value("A2"));
        mvc.perform(get(ROOT + "/" + id + "/lessons/" + l1).header("Authorization", "Bearer " + otherToken))
                .andExpect(status().isNotFound());
        String foreign = newCourse();
        mvc.perform(get(ROOT + "/" + foreign + "/lessons/" + l1).header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.code").value("LESSON_NOT_FOUND"));

        mvc.perform(delete(ROOT + "/" + id + "/lessons/" + l2).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.lessons WHERE id=?::uuid", Integer.class, l2)).isZero();
        mvc.perform(delete(ROOT + "/" + id + "/chapters/" + b).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.chapters.length()").value(1));
    }

    @Test
    void submitApproveThenEditsArchiveAndDiscardKeepSnapshot() throws Exception {
        String id = readyCourse();
        patchCourse(id, Map.of("action", "SUBMIT")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.workflowStatus").value("PENDING"));
        send(post(ROOT + "/" + id + "/chapters"), Map.of("title", "Nope")).andExpect(jsonPath("$.code").value("COURSE_NOT_EDITABLE"));
        mvc.perform(post(ROOT + "/" + id + "/withdraw").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.data.workflowStatus").value("DRAFT"));
        patchCourse(id, Map.of("action", "SUBMIT")).andExpect(status().isOk());
        approve(id);
        JsonNode detail = data(mvc.perform(get(ROOT + "/" + id).header("Authorization", "Bearer " + token)));
        String versionId = detail.at("/publishedVersion/id").asText();
        String lesson = detail.at("/chapters/0/lessons/0/id").asText();
        assertThat(detail.path("hasUnpublishedChanges").asBoolean()).isFalse();

        send(patch(ROOT + "/" + id + "/lessons/" + lesson), Map.of("content", "Changed")).andExpect(status().isOk());
        mvc.perform(get(ROOT + "/" + id).header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.data.hasUnpublishedChanges").value(true))
                .andExpect(jsonPath("$.data.workflowStatus").value("DRAFT"));
        mvc.perform(get(ROOT + "/" + id + "/lessons/" + lesson).param("versionId", versionId).header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.data.content").value("Lesson body"))
                .andExpect(jsonPath("$.data.versionId").value(versionId));
        mvc.perform(get(ROOT + "/" + id + "/lessons/" + lesson).param("versionId", UUID.randomUUID().toString())
                        .header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.code").value("LESSON_NOT_FOUND"));
        mvc.perform(delete(ROOT + "/" + id + "/lessons/" + lesson).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT archived_at IS NOT NULL FROM techverse.lessons WHERE id=?::uuid", Boolean.class, lesson)).isTrue();

        mvc.perform(post(ROOT + "/" + id + "/discard").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hasUnpublishedChanges").value(false))
                .andExpect(jsonPath("$.data.chapters[0].lessons[0].id").value(lesson));
        mvc.perform(get(ROOT + "/" + id + "/lessons/" + lesson).header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.data.content").value("Lesson body"));
        patchCourse(id, Map.of("action", "SUBMIT")).andExpect(jsonPath("$.code").value("COURSE_NO_CHANGES"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.course_publication_versions", Integer.class)).isEqualTo(1);
    }

    @Test
    void submitNeedsSummaryDescriptionAndOwnImages() throws Exception {
        String id = readyCourse();
        patchCourse(id, Map.of("action", "SUBMIT", "summary", " ")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COURSE_NOT_READY"));
        String foreign = "https://res.cloudinary.com/test/image/upload/v1/techverse/articles/course/" + other + "/" + id + "/k.png";
        patchCourse(id, Map.of("action", "SUBMIT", "description", "![x](" + foreign + ")"))
                .andExpect(jsonPath("$.code").value("COURSE_NOT_READY"));
        patchCourse(id, Map.of("action", "SAVE", "coverImageUrl", foreign)).andExpect(jsonPath("$.code").value("COURSE_IMAGE_INVALID"));
        mvc.perform(get(ROOT + "/" + id).header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.data.workflowStatus").value("DRAFT"))
                .andExpect(jsonPath("$.data.summary").value("Summary"));
    }

    @Test
    void imagesAreScopedToTheirCourseOrLesson() throws Exception {
        String id = readyCourse();
        String lesson = data(mvc.perform(get(ROOT + "/" + id).header("Authorization", "Bearer " + token)))
                .at("/chapters/0/lessons/0/id").asText();
        UUID key = UUID.randomUUID();
        String cover = data(upload(ROOT + "/" + id + "/images", key, png()).andExpect(status().isOk())).path("url").asText();
        assertThat(data(upload(ROOT + "/" + id + "/images", key, png())).path("url").asText()).isEqualTo(cover);
        String inline = data(upload(ROOT + "/" + id + "/lessons/" + lesson + "/images", UUID.randomUUID(), png()))
                .path("url").asText();
        assertThat(inline).contains("/lesson/").isNotEqualTo(cover);
        patchCourse(id, Map.of("action", "SAVE", "coverImageUrl", inline)).andExpect(jsonPath("$.code").value("COURSE_IMAGE_INVALID"));
        patchCourse(id, Map.of("action", "SAVE", "coverImageUrl", cover, "description", "![a](" + cover + ")"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.imageIssues.length()").value(0));
        send(patch(ROOT + "/" + id + "/lessons/" + lesson), Map.of("content", "![b](" + inline + ") ![c](" + cover + ")"))
                .andExpect(jsonPath("$.data.imageIssues.length()").value(1))
                .andExpect(jsonPath("$.data.imageIssues[0].source").value(cover));
        patchCourse(id, Map.of("action", "SUBMIT")).andExpect(jsonPath("$.code").value("COURSE_NOT_READY"));
        send(patch(ROOT + "/" + id + "/lessons/" + lesson), Map.of("content", "![b](" + inline + ")")).andExpect(status().isOk());
        patchCourse(id, Map.of("action", "SUBMIT")).andExpect(jsonPath("$.data.workflowStatus").value("PENDING"));
        upload(ROOT + "/" + id + "/images", UUID.randomUUID(), new byte[] {1, 2})
                .andExpect(jsonPath("$.code").value(org.hamcrest.Matchers.startsWith("COURSE_")));
    }

    @Test
    void publicationHistoryDeleteAndTombstone() throws Exception {
        String id = readyCourse();
        patchCourse(id, Map.of("action", "SUBMIT"));
        approve(id);
        send(patch(ROOT + "/" + id + "/publication"), Map.of("action", "HIDE"))
                .andExpect(jsonPath("$.data.publicationStatus").value("AUTHOR_HIDDEN"));
        send(patch(ROOT + "/" + id + "/publication"), Map.of("action", "HIDE"))
                .andExpect(jsonPath("$.code").value("COURSE_PUBLICATION_TRANSITION_INVALID"));
        send(patch(ROOT + "/" + id + "/publication"), Map.of("action", "UNHIDE"))
                .andExpect(jsonPath("$.data.publicationStatus").value("PUBLISHED"));
        mvc.perform(get(ROOT + "/" + id + "/history").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.data.content[0].action").value("AUTHOR_UNHIDE"))
                .andExpect(jsonPath("$.data.content[2].action").value("APPROVE"))
                .andExpect(jsonPath("$.data.content[2].versionNumber").value(1));
        mvc.perform(delete(ROOT + "/" + id).header("Authorization", "Bearer " + token)).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT publication_status FROM techverse.courses WHERE id=?::uuid", String.class, id))
                .isEqualTo("AUTHOR_DELETED");

        UUID key = UUID.randomUUID();
        var body = Map.of("action", "SAVE", "title", "Draft", "topicId", topic);
        String draft = data(createCourse(key, body)).path("id").asText();
        mvc.perform(delete(ROOT + "/" + draft).header("Authorization", "Bearer " + token)).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.courses WHERE id=?::uuid", Integer.class, draft)).isZero();
        createCourse(key, body).andExpect(jsonPath("$.code").value("COURSE_KEY_CONFLICT"));
    }

    @Test
    void aiLessonReceiptIsClaimedOncePerCourseAndTarget() throws Exception {
        String id = readyCourse();
        String chapter = data(mvc.perform(get(ROOT + "/" + id).header("Authorization", "Bearer " + token)))
                .at("/chapters/0/id").asText();
        UUID course = UUID.fromString(id);
        UUID generation = UUID.randomUUID();
        aiGenerations.save(author, generation,
                AiCompletedGenerationRepository.lessonFingerprint(course, "AI lesson", "Tóm tắt", "## Nội dung"));
        var body = Map.of("title", "AI lesson", "summary", "Tóm tắt", "content", "## Nội dung", "aiGenerationId", generation);
        UUID key = UUID.randomUUID();
        String lesson = data(createLesson(id, chapter, key, body).andExpect(status().isCreated())
                        .andExpect(jsonPath("$.data.aiAssisted").value(true)))
                .path("id").asText();
        assertThat(data(createLesson(id, chapter, key, body)).path("id").asText()).isEqualTo(lesson);
        createLesson(id, chapter, UUID.randomUUID(), body).andExpect(jsonPath("$.code").value("AI_GENERATION_INVALID"));
        // PATCH claims LESSON_UPDATE:<lessonId>: a receipt already bound to a create key cannot be reused.
        send(patch(ROOT + "/" + id + "/lessons/" + lesson), body).andExpect(jsonPath("$.code").value("AI_GENERATION_INVALID"));

        UUID other = UUID.randomUUID();
        aiGenerations.save(author, other,
                AiCompletedGenerationRepository.lessonFingerprint(UUID.randomUUID(), "AI lesson", "Tóm tắt", "## Nội dung"));
        createLesson(id, chapter, UUID.randomUUID(), Map.of("title", "AI lesson", "summary", "Tóm tắt",
                        "content", "## Nội dung", "aiGenerationId", other))
                .andExpect(jsonPath("$.code").value("AI_GENERATION_INVALID"));
        UUID article = UUID.randomUUID();
        aiGenerations.save(author, article,
                AiCompletedGenerationRepository.fingerprint("AI lesson", "Tóm tắt", "## Nội dung", topic, List.of()));
        createLesson(id, chapter, UUID.randomUUID(), Map.of("title", "AI lesson", "summary", "Tóm tắt",
                        "content", "## Nội dung", "aiGenerationId", article))
                .andExpect(jsonPath("$.code").value("AI_GENERATION_INVALID"));

        String plain = data(mvc.perform(get(ROOT + "/" + id).header("Authorization", "Bearer " + token)))
                .at("/chapters/0/lessons/0/id").asText();
        UUID edit = UUID.randomUUID();
        aiGenerations.save(author, edit,
                AiCompletedGenerationRepository.lessonFingerprint(course, "Lesson", null, "AI body"));
        send(patch(ROOT + "/" + id + "/lessons/" + plain), Map.of("content", "AI body", "aiGenerationId", edit))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.aiAssisted").value(true));
        send(patch(ROOT + "/" + id + "/lessons/" + plain), Map.of("content", "AI body", "aiGenerationId", edit))
                .andExpect(status().isOk());
    }

    @Test
    void submitRechecksImagesUnderLockAfterCleanupDeletedThem() throws Exception {
        String id = readyCourse();
        String cover = data(upload(ROOT + "/" + id + "/images", UUID.randomUUID(), png())).path("url").asText();
        patchCourse(id, Map.of("action", "SAVE", "description", "![a](" + cover + ")")).andExpect(status().isOk());
        String publicId = cloud.keySet().iterator().next();
        var calls = new java.util.concurrent.atomic.AtomicInteger();
        // The first provider lookup is the unlocked pre-check; cleanup then deletes the asset.
        when(imageStorage.find(publicId)).thenAnswer(i -> {
            var found = Optional.ofNullable(cloud.get(publicId));
            if (calls.incrementAndGet() == 1) cloud.remove(publicId);
            return found;
        });
        patchCourse(id, Map.of("action", "SUBMIT")).andExpect(jsonPath("$.code").value("COURSE_NOT_READY"));
        assertThat(calls.get()).isGreaterThanOrEqualTo(2);
    }

    @Test
    void createKeyEqualToLessonIdCannotReuseAPatchReceipt() throws Exception {
        String id = readyCourse();
        JsonNode detail = data(mvc.perform(get(ROOT + "/" + id).header("Authorization", "Bearer " + token)));
        String chapter = detail.at("/chapters/0/id").asText();
        String lesson = detail.at("/chapters/0/lessons/0/id").asText();
        UUID generation = UUID.randomUUID();
        aiGenerations.save(author, generation,
                AiCompletedGenerationRepository.lessonFingerprint(UUID.fromString(id), "Lesson", null, "AI body"));
        send(patch(ROOT + "/" + id + "/lessons/" + lesson), Map.of("content", "AI body", "aiGenerationId", generation))
                .andExpect(status().isOk());
        createLesson(id, chapter, UUID.fromString(lesson),
                        Map.of("title", "Lesson", "content", "AI body", "aiGenerationId", generation))
                .andExpect(jsonPath("$.code").value("AI_GENERATION_INVALID"));
    }

    @Test
    void optionsAndImport() throws Exception {
        mvc.perform(get(ROOT + "/options").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.data.topics.content[0].id").value(topic.toString()));
        mvc.perform(multipart(ROOT + "/import").file(new MockMultipartFile("file", "a.md", "text/markdown", "# Hi".getBytes()))
                        .header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.data.content").value("# Hi"));
        mvc.perform(multipart(ROOT + "/import").file(new MockMultipartFile("file", "a.pdf", "application/pdf", "x".getBytes()))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.code").value("COURSE_FILE_UNSUPPORTED"));
    }

    // ------------------------------------------------------------------ helpers

    String newCourse() throws Exception {
        return data(createCourse(UUID.randomUUID(), Map.of("action", "SAVE", "title", "Course", "topicId", topic)))
                .path("id").asText();
    }

    /** Metadata, one tag, one chapter with one text lesson: ready to submit. */
    String readyCourse() throws Exception {
        String id = data(createCourse(UUID.randomUUID(), Map.of(
                        "action", "SAVE", "title", "Course", "topicId", topic, "tagIds", List.of(tag),
                        "summary", "Summary", "description", "Description", "level", "INTERMEDIATE")))
                .path("id").asText();
        String chapter = lastChapter(send(post(ROOT + "/" + id + "/chapters"), Map.of("title", "Intro")));
        createLesson(id, chapter, UUID.randomUUID(), Map.of("title", "Lesson", "content", "Lesson body"))
                .andExpect(status().isCreated());
        return id;
    }

    void approve(String id) {
        tx.executeWithoutResult(s -> {
            var course = courses.findByIdForUpdate(UUID.fromString(id)).orElseThrow();
            var history = course.approve(users.findById(moderator).orElseThrow(), null, Instant.now());
            courses.flush(); // version row first, or the history FK is written as null
            histories.save(history);
            courses.flush();
        });
    }

    ResultActions createCourse(UUID key, Map<String, ?> body) throws Exception {
        return send(post(ROOT).header("Idempotency-Key", key.toString()), body);
    }

    ResultActions createLesson(String course, String chapter, UUID key, Map<String, ?> body) throws Exception {
        return send(post(ROOT + "/" + course + "/chapters/" + chapter + "/lessons").header("Idempotency-Key", key.toString()), body);
    }

    ResultActions patchCourse(String id, Map<String, ?> body) throws Exception {
        return send(patch(ROOT + "/" + id), body);
    }

    ResultActions send(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request, Map<String, ?> body)
            throws Exception {
        return mvc.perform(request.header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(body)));
    }

    ResultActions upload(String path, UUID key, byte[] bytes) throws Exception {
        return mvc.perform(multipart(path).file(new MockMultipartFile("file", "a.png", "image/png", bytes))
                .header("Upload-Key", key.toString())
                .header("Authorization", "Bearer " + token));
    }

    JsonNode data(ResultActions result) throws Exception {
        return mapper.readTree(result.andReturn().getResponse().getContentAsString()).path("data");
    }

    String lastChapter(ResultActions result) throws Exception {
        var chapters = data(result).path("chapters");
        return chapters.get(chapters.size() - 1).path("id").asText();
    }

    byte[] png() throws Exception {
        var image = new java.awt.image.BufferedImage(4, 3, java.awt.image.BufferedImage.TYPE_INT_RGB);
        var out = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(image, "png", out);
        return out.toByteArray();
    }

    UUID user(String email, boolean isAuthor) {
        UUID id = users.saveAndFlush(User.createLocalAccount("Test user", email, encoder.encode("SecurePass123!"))).getId();
        if (isAuthor) {
            jdbc.update("INSERT INTO techverse.user_roles(user_id,role_id) SELECT ?,id FROM techverse.roles WHERE name='AUTHOR'", id);
            jdbc.update("INSERT INTO techverse.author_profiles(user_id,bio,expertise,status) VALUES (?,'Bio','Java','APPROVED')", id);
        }
        return id;
    }

    String login(String email) throws Exception {
        var r = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("email", email, "password", "SecurePass123!"))))
                .andExpect(status().isOk())
                .andReturn();
        return mapper.readTree(r.getResponse().getContentAsString()).at("/data/accessToken").asText();
    }
}
