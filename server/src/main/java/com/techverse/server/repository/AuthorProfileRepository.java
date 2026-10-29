package com.techverse.server.repository;

import com.techverse.server.entity.AuthorProfile;
import com.techverse.server.enums.AuthorProfileStatus;
import com.techverse.server.enums.RoleName;
import java.util.Optional;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import jakarta.persistence.LockModeType;

public interface AuthorProfileRepository extends JpaRepository<AuthorProfile, UUID>, JpaSpecificationExecutor<AuthorProfile> {

	@Override
	@EntityGraph(attributePaths = {"user"})
	Page<AuthorProfile> findAll(Specification<AuthorProfile> specification, Pageable pageable);

	@EntityGraph(attributePaths = {"user", "reviewedBy", "suspendedBy", "restoredBy"})
	@Query("select profile from AuthorProfile profile where profile.id = :id")
	Optional<AuthorProfile> findDetailsById(@Param("id") UUID id);

	@Query("select profile.user.id from AuthorProfile profile where profile.id = :id")
	Optional<UUID> findApplicantIdById(@Param("id") UUID id);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select profile from AuthorProfile profile where profile.id = :id")
	Optional<AuthorProfile> findByIdForReview(@Param("id") UUID id);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select profile from AuthorProfile profile where profile.user.id = :userId")
	Optional<AuthorProfile> findByUserIdForResubmit(@Param("userId") UUID userId);

	@Query("""
			select (count(profile) > 0) from AuthorProfile profile
			where profile.user.id = :userId and profile.user.active = true and profile.status = :status
			and exists (select assignment.id from UserRole assignment
			    where assignment.user = profile.user and assignment.role.name = :role)
			""")
	boolean hasActiveAuthorPermission(@Param("userId") UUID userId,
			@Param("status") AuthorProfileStatus status, @Param("role") RoleName role);

	boolean existsByUser_Id(UUID userId);

	Optional<AuthorProfile> findByUser_Id(UUID userId);

	List<AuthorProfile> findByUser_IdIn(Collection<UUID> userIds);
}
