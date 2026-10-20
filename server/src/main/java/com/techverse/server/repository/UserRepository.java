package com.techverse.server.repository;

import com.techverse.server.entity.User;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, UUID> {

	@Query(
			value = "select exists (select 1 from techverse.users where lower(email::text) = lower(:email))",
			nativeQuery = true
	)
	boolean existsByEmailIgnoreCase(@Param("email") String email);

	Optional<User> findByEmail(String email);
}
