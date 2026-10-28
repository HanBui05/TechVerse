package com.techverse.server.repository;

import com.techverse.server.entity.SocialAccount;
import com.techverse.server.enums.SocialProvider;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SocialAccountRepository extends JpaRepository<SocialAccount, UUID> {

	Optional<SocialAccount> findByProviderAndProviderId(SocialProvider provider, String providerId);

	List<SocialAccount> findByUser_Id(UUID userId);
}
