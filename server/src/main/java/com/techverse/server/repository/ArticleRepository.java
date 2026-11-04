package com.techverse.server.repository;

import com.techverse.server.entity.Article;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.*;

public interface ArticleRepository
        extends JpaRepository<Article, UUID>, JpaSpecificationExecutor<Article> {
    @Query("select a.author.id from Article a where a.id=:id")
    Optional<UUID> findAuthorIdById(@Param("id") UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Article a where a.id=:id")
    Optional<Article> findByIdForUpdate(@Param("id") UUID id);

    /** Same rule as APPROVE: active account, AUTHOR role and APPROVED profile; one query per page. */
    @Query(
            "select p.user.id from AuthorProfile p join p.user u join u.userRoles ur"
                    + " where p.user.id in :ids and u.active = true"
                    + " and p.status = com.techverse.server.enums.AuthorProfileStatus.APPROVED"
                    + " and ur.role.name = com.techverse.server.enums.RoleName.AUTHOR")
    Set<UUID> findEligibleAuthorIds(@Param("ids") Collection<UUID> ids);
}
