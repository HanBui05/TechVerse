package com.techverse.server.repository;

import com.techverse.server.entity.Tag;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TagRepository extends JpaRepository<Tag, UUID>, JpaSpecificationExecutor<Tag> {

	@Query(value = "select exists (select 1 from techverse.tags where lower(name::text) = lower(:name))", nativeQuery = true)
	boolean existsByNameIgnoreCase(@Param("name") String name);

	@Query(value = "select exists (select 1 from techverse.tags where lower(name::text) = lower(:name) and id <> :id)", nativeQuery = true)
	boolean existsByNameIgnoreCaseAndIdNot(@Param("name") String name, @Param("id") UUID id);

	// Future content assignments must take a compatible tag lock before checking active.
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select tag from Tag tag where tag.id = :id")
	Optional<Tag> findByIdForUpdate(@Param("id") UUID id);
}
