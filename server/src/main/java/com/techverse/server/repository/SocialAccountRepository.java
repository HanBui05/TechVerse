package com.techverse.server.repository;

import com.techverse.server.entity.SocialAccount;
import com.techverse.server.enums.SocialProvider;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SocialAccountRepository extends JpaRepository<SocialAccount, UUID> {

	Optional<SocialAccount> findByProviderAndProviderId(SocialProvider provider, String providerId);

	@Query("""
			SELECT socialAccount.user.id
			FROM SocialAccount socialAccount
			WHERE socialAccount.provider = :provider AND socialAccount.providerId = :providerId
			""")
	Optional<UUID> findUserIdByProviderAndProviderId(
				@Param("provider") SocialProvider provider,
				@Param("providerId") String providerId
	);

	List<SocialAccount> findByUser_Id(UUID userId);
}
