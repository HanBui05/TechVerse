package com.techverse.server.repository;

import com.techverse.server.entity.Report;

import jakarta.persistence.LockModeType;

import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.*;

public interface ReportRepository extends JpaRepository<Report, UUID>, JpaSpecificationExecutor<Report> {
    @Query("select r.targetId from Report r where r.id=:id")
    Optional<UUID> findTargetIdById(@Param("id") UUID id);

    boolean existsByReporter_IdAndTargetTypeAndTargetId(UUID reporter, String targetType, UUID targetId);

    /** Locks the open reports of one target in id order (the shared lock order). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Report r where r.targetType=:type and r.targetId=:target and r.status=com.techverse.server.enums.ReportStatus.OPEN order by r.id")
    List<Report> findOpenForUpdate(@Param("type") String type, @Param("target") UUID target);

    /** Runs only under the target's row lock, which every report write takes first. */
    @Modifying(flushAutomatically = true, clearAutomatically = false)
    @Query("""
            update Report r set r.status=com.techverse.server.enums.ReportStatus.DISMISSED, r.handledBy=null, r.handledAt=:at, r.resolutionNote=:note
            where r.targetType=:type and r.targetId=:target and r.status=com.techverse.server.enums.ReportStatus.OPEN""")
    int dismissOpen(@Param("type") String type, @Param("target") UUID target, @Param("note") String note, @Param("at") Instant at);

    @Query("select r.targetId from Report r where r.reporter.id=:reporter and r.targetType=:type and r.targetId in :targets")
    Set<UUID> findReportedTargets(@Param("reporter") UUID reporter, @Param("type") String type, @Param("targets") Collection<UUID> targets);

    @Override
    @EntityGraph(attributePaths = {"reporter"})
    Page<Report> findAll(Specification<Report> spec, Pageable pageable);

    @Query("""
            select r.targetId, count(r) from Report r
            where r.targetType=:type and r.targetId in :targets and r.status=com.techverse.server.enums.ReportStatus.OPEN group by r.targetId""")
    List<Object[]> countOpen(@Param("type") String type, @Param("targets") Collection<UUID> targets);
}
