package com.techverse.server.repository;

import com.techverse.server.entity.AuthorProfile;
import java.util.Optional;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthorProfileRepository extends JpaRepository<AuthorProfile, UUID> {

	boolean existsByUser_Id(UUID userId);

	Optional<AuthorProfile> findByUser_Id(UUID userId);

	List<AuthorProfile> findByUser_IdIn(Collection<UUID> userIds);
}
