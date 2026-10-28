package com.techverse.server.repository;

import com.techverse.server.entity.UserRole;
import com.techverse.server.enums.RoleName;
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

	@Query("""
			SELECT COUNT(DISTINCT userRole.user.id)
			FROM UserRole userRole
			WHERE userRole.role.name = :roleName AND userRole.user.active = true
			""")
	long countActiveUsersByRole(@Param("roleName") RoleName roleName);

	@Query("""
			SELECT COUNT(DISTINCT userRole.user.id)
			FROM UserRole userRole
			WHERE userRole.role.name = :roleName
				AND userRole.user.active = true
				AND userRole.user.id IN :userIds
			""")
	long countActiveUsersByRoleAndUserIdIn(
			@Param("roleName") RoleName roleName,
			@Param("userIds") Collection<UUID> userIds
	);
}
