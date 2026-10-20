package com.techverse.server.repository;

import com.techverse.server.entity.Role;
import com.techverse.server.enums.RoleName;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoleRepository extends JpaRepository<Role, UUID> {

	Optional<Role> findByName(RoleName name);
}
