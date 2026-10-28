package com.techverse.server.repository;

import com.techverse.server.entity.User;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, UUID>, JpaSpecificationExecutor<User> {

	@Query(
			value = "select exists (select 1 from techverse.users where lower(email::text) = lower(:email))",
			nativeQuery = true
	)
	boolean existsByEmailIgnoreCase(@Param("email") String email);

	Optional<User> findByEmail(String email);

	@EntityGraph(attributePaths = {"userRoles", "userRoles.role"})
	Optional<User> findWithRolesById(UUID id);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select user from User user where user.id = :id")
	Optional<User> findByIdForAuthorProfileApplication(@Param("id") UUID id);
}
