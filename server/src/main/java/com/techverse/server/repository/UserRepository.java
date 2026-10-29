package com.techverse.server.repository;

import com.techverse.server.entity.User;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, UUID>, JpaSpecificationExecutor<User> {

	@Modifying
	@Query(value = "update techverse.users set avatar_url = :url, updated_by = :id where id = :id", nativeQuery = true)
	int updateAvatarUrl(@Param("id") UUID id, @Param("url") String url);

	@Query(
			value = "select exists (select 1 from techverse.users where lower(email::text) = lower(:email))",
			nativeQuery = true
	)
	boolean existsByEmailIgnoreCase(@Param("email") String email);

	Optional<User> findByEmail(String email);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select user from User user where user.email = :email")
	Optional<User> findByEmailForAuthentication(@Param("email") String email);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select user from User user where user.id = :id")
	Optional<User> findByIdForAuthentication(@Param("id") UUID id);

	@EntityGraph(attributePaths = {"userRoles", "userRoles.role"})
	Optional<User> findWithRolesById(UUID id);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select user from User user where user.id = :id")
	Optional<User> findByIdForAuthorProfileApplication(@Param("id") UUID id);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select user from User user where user.id in :userIds order by user.id")
	List<User> findAllByIdForAdminStatusUpdate(@Param("userIds") Collection<UUID> userIds);
}
