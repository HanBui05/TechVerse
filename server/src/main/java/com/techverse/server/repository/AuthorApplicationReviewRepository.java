package com.techverse.server.repository;

import com.techverse.server.entity.AuthorApplicationReview;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthorApplicationReviewRepository extends JpaRepository<AuthorApplicationReview, UUID> {

	// Shared by owner and admin views; the reviewer is never hydrated (id comes from the FK, name from the snapshot).
	List<AuthorApplicationReview> findByAuthorProfile_IdOrderByReviewedAtDescApplicationVersionDesc(UUID authorProfileId);
}
