package com.techverse.server.repository;

import com.techverse.server.entity.Topic;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TopicRepository extends JpaRepository<Topic, UUID>, JpaSpecificationExecutor<Topic> {

	@Query(value = "select exists (select 1 from techverse.topics where lower(name::text) = lower(:name))", nativeQuery = true)
	boolean existsByNameIgnoreCase(@Param("name") String name);

	@Query(value = "select exists (select 1 from techverse.topics where lower(name::text) = lower(:name) and id <> :id)", nativeQuery = true)
	boolean existsByNameIgnoreCaseAndIdNot(@Param("name") String name, @Param("id") UUID id);

	// Future content assignments must take a compatible topic lock before checking active.
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select topic from Topic topic where topic.id = :id")
	Optional<Topic> findByIdForUpdate(@Param("id") UUID id);
}
