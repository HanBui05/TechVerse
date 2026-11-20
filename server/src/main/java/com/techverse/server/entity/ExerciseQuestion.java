package com.techverse.server.entity;

import jakarta.persistence.*;

import lombok.*;

import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.List;

/** One question or card. Quiz: {@code answer} is the correct option index as text; card: the back face. */
@Entity
@Table(name = "exercise_questions")
@DynamicUpdate
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ExerciseQuestion extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exercise_set_id", nullable = false)
    private ExerciseSet exerciseSet;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Column(name = "code_snippet", columnDefinition = "text")
    private String codeSnippet;

    @Column(name = "code_language", length = 50)
    private String codeLanguage;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<String> options;

    @Column(nullable = false, columnDefinition = "text")
    private String answer;

    @Column(nullable = false, columnDefinition = "text")
    private String explanation;

    @Column(nullable = false)
    private int position;

    public static ExerciseQuestion of(
            ExerciseSet set, int position, String content, String codeSnippet, String codeLanguage,
            List<String> options, String answer, String explanation) {
        var q = new ExerciseQuestion();
        q.exerciseSet = set;
        q.position = position;
        q.content = content;
        q.codeSnippet = codeSnippet;
        q.codeLanguage = codeLanguage;
        q.options = options;
        q.answer = answer;
        q.explanation = explanation;
        return q;
    }
}
