package com.techverse.server.repository;

import com.techverse.server.entity.UserRole;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRoleRepository extends JpaRepository<UserRole, UUID> {

	@Query("""
				SELECT userRole
				FROM UserRole userRole
				JOIN FETCH userRole.role
				WHERE userRole.user.id IN :userIds
				""")
	List<UserRole> findWithRoleByUserIdIn(@Param("userIds") Collection<UUID> userIds);
}
