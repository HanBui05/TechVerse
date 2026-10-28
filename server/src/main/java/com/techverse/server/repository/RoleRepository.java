package com.techverse.server.repository;

import com.techverse.server.entity.Role;
import com.techverse.server.enums.RoleName;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RoleRepository extends JpaRepository<Role, UUID> {

	Optional<Role> findByName(RoleName name);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select role from Role role where role.name = :name")
	Optional<Role> findByNameForUpdate(@Param("name") RoleName name);
}
