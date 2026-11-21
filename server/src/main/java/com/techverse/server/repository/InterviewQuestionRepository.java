package com.techverse.server.repository;

import com.techverse.server.entity.InterviewQuestion;

import jakarta.persistence.LockModeType;

import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.*;

public interface InterviewQuestionRepository extends JpaRepository<InterviewQuestion, UUID>, JpaSpecificationExecutor<InterviewQuestion> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select q from InterviewQuestion q where q.id=:id")
    Optional<InterviewQuestion> findByIdForUpdate(@Param("id") UUID id);

    @Query("select q.author.id from InterviewQuestion q where q.id=:id")
    Optional<UUID> findAuthorIdById(@Param("id") UUID id);

    @Override
    @EntityGraph(attributePaths = {"topic", "author"})
    Page<InterviewQuestion> findAll(Specification<InterviewQuestion> spec, Pageable pageable);
}
