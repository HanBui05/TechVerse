package com.techverse.server.repository;

import com.techverse.server.entity.Conversation;

import jakarta.persistence.LockModeType;

import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.*;

public interface ConversationRepository extends JpaRepository<Conversation, UUID> {
    /** Opens the pair's conversation or, when it exists, moves its context to this course; safe under concurrent opens. */
    @Modifying
    @Query(
            value = "INSERT INTO conversations (learner_id, author_id, context_course_id, context_course_title, created_by, updated_by)"
                    + " VALUES (:learner, :author, :course, :title, :learner, :learner)"
                    + " ON CONFLICT (learner_id, author_id) DO UPDATE SET context_course_id = EXCLUDED.context_course_id,"
                    + " context_course_title = EXCLUDED.context_course_title, updated_by = EXCLUDED.updated_by",
            nativeQuery = true)
    void upsert(@Param("learner") UUID learner, @Param("author") UUID author, @Param("course") UUID course, @Param("title") String title);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Conversation c where c.learner.id=:learner and c.author.id=:author")
    Optional<Conversation> findPairForUpdate(@Param("learner") UUID learner, @Param("author") UUID author);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Conversation c where c.id=:id")
    Optional<Conversation> findByIdForUpdate(@Param("id") UUID id);

    /** Both roles, latest message first. An author does not see a conversation before its first message. */
    @EntityGraph(attributePaths = {"learner", "author"})
    @Query(
            value = """
                    select c from Conversation c
                    where c.learner.id=:me or (c.author.id=:me and c.lastMessageSeq is not null)
                    order by c.lastMessageAt desc nulls last, c.createdAt desc, c.id""",
            countQuery = "select count(c) from Conversation c where c.learner.id=:me or (c.author.id=:me and c.lastMessageSeq is not null)")
    Page<Conversation> findMine(@Param("me") UUID me, Pageable pageable);

    /** Conversations whose last message came from the other side after the caller's read marker. */
    @Query("""
            select count(c) from Conversation c
            where c.lastMessageSenderId <> :me
              and ((c.learner.id=:me and c.lastMessageSeq > c.learnerLastReadSeq)
                or (c.author.id=:me and c.lastMessageSeq > c.authorLastReadSeq))""")
    long countUnread(@Param("me") UUID me);

    /** Rows of (course id, user id) for active enrollments among the given courses and users. */
    @Query("select e.course.id, e.userId from CourseEnrollment e where e.revokedAt is null and e.course.id in :courses and e.userId in :users")
    List<Object[]> findActiveEnrollments(@Param("courses") Collection<UUID> courses, @Param("users") Collection<UUID> users);
}
