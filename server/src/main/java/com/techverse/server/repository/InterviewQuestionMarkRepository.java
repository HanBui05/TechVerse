package com.techverse.server.repository;

import com.techverse.server.entity.InterviewQuestionMark;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.*;

public interface InterviewQuestionMarkRepository extends JpaRepository<InterviewQuestionMark, UUID> {
    /**
     * One statement so concurrent requests never lose each other's fields: a column whose {@code set*}
     * flag is false keeps the value of the row as locked by ON CONFLICT; re-marking keeps the first stamp.
     */
    @Modifying(clearAutomatically = true)
    @Query(
            value = "INSERT INTO interview_question_marks AS m (user_id, question_id, reviewed_at, saved_at, created_by, updated_by)"
                    + " VALUES (:user, :question, CASE WHEN :setReviewed AND :reviewed THEN now() END,"
                    + " CASE WHEN :setSaved AND :saved THEN now() END, :user, :user)"
                    + " ON CONFLICT (user_id, question_id) DO UPDATE SET"
                    + " reviewed_at = CASE WHEN NOT :setReviewed THEN m.reviewed_at WHEN :reviewed THEN coalesce(m.reviewed_at, now()) END,"
                    + " saved_at = CASE WHEN NOT :setSaved THEN m.saved_at WHEN :saved THEN coalesce(m.saved_at, now()) END,"
                    + " updated_by = :user",
            nativeQuery = true)
    int upsert(@Param("user") UUID user, @Param("question") UUID question,
               @Param("setReviewed") boolean setReviewed, @Param("reviewed") boolean reviewed,
               @Param("setSaved") boolean setSaved, @Param("saved") boolean saved);

    @Query("select m from InterviewQuestionMark m where m.user.id = :user and m.question.id in :questions")
    List<InterviewQuestionMark> findFor(@Param("user") UUID user, @Param("questions") Collection<UUID> questions);
}
