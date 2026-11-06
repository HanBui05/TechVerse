package com.techverse.server.course;

import static org.assertj.core.api.Assertions.assertThat;

import com.techverse.server.dto.request.*;
import com.techverse.server.dto.response.*;

import org.junit.jupiter.api.Test;

import tools.jackson.databind.json.JsonMapper;

import java.lang.reflect.*;
import java.util.*;

/** Free course contract: no money fields anywhere, no raw video URL in responses. */
class CourseContractTest {
    static final List<Class<?>> REQUESTS =
            List.of(CourseWriteRequest.class, LessonWriteRequest.class, CourseChapterRequest.class, CourseReorderRequest.class);
    static final List<Class<?>> RESPONSES =
            List.of(CourseResponse.class, LessonResponse.class, CourseSummaryResponse.class, CourseModerationHistoryResponse.class);

    @Test
    void noPriceOrCurrencyFields() {
        var all = new ArrayList<Class<?>>(REQUESTS);
        all.addAll(RESPONSES);
        for (Class<?> type : all)
            assertThat(fieldNames(type, new HashSet<>()))
                    .as(type.getSimpleName())
                    .noneMatch(n -> n.toLowerCase().contains("price") || n.toLowerCase().contains("currency"));
    }

    @Test
    void responsesExposeOnlyProviderAndVideoId() {
        for (Class<?> type : RESPONSES)
            assertThat(fieldNames(type, new HashSet<>())).as(type.getSimpleName()).doesNotContain("videoUrl");
        assertThat(fieldNames(LessonResponse.Video.class, new HashSet<>())).containsExactlyInAnyOrder("provider", "videoId");
    }

    @Test
    void unknownFieldsSuchAsPriceAreRejected() {
        var json = JsonMapper.builder().build();
        for (String body : List.of("{\"action\":\"SAVE\",\"priceAmount\":0}", "{\"action\":\"SAVE\",\"currency\":\"VND\"}"))
            assertThat(catchThrowable(() -> json.readValue(body, CourseWriteRequest.class))).isNotNull();
        assertThat(catchThrowable(() -> json.readValue("{\"title\":\"x\",\"priceAmount\":0}", LessonWriteRequest.class)))
                .isNotNull();
    }

    private static Throwable catchThrowable(Runnable r) {
        try {
            r.run();
            return null;
        } catch (RuntimeException e) {
            return e;
        }
    }

    /** Field names of the type and of nested DTO types (records and inner classes). */
    private static Set<String> fieldNames(Class<?> type, Set<Class<?>> seen) {
        var names = new HashSet<String>();
        if (!seen.add(type)) return names;
        for (Field f : type.getDeclaredFields()) {
            if (Modifier.isStatic(f.getModifiers())) continue;
            names.add(f.getName());
            for (Class<?> nested : typesOf(f.getGenericType()))
                if (nested.getName().startsWith("com.techverse.server.dto")) names.addAll(fieldNames(nested, seen));
        }
        return names;
    }

    private static List<Class<?>> typesOf(Type t) {
        if (t instanceof Class<?> c) return List.of(c);
        if (t instanceof ParameterizedType p) {
            var out = new ArrayList<Class<?>>();
            for (Type arg : p.getActualTypeArguments()) out.addAll(typesOf(arg));
            return out;
        }
        return List.of();
    }
}
