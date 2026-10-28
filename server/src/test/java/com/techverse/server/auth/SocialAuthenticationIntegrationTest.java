package com.techverse.server.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.techverse.server.dto.internal.JwtDetails;
import com.techverse.server.dto.internal.SocialProfile;
import com.techverse.server.entity.SocialAccount;
import com.techverse.server.entity.Token;
import com.techverse.server.entity.User;
import com.techverse.server.enums.SocialProvider;
import com.techverse.server.enums.TokenType;
import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;
import com.techverse.server.repository.SocialAccountRepository;
import com.techverse.server.repository.TokenRepository;
import com.techverse.server.repository.UserRepository;
import com.techverse.server.service.AuthService;
import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.Set;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class SocialAuthenticationIntegrationTest {

	@Container
	@ServiceConnection
	static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));

	@Container
	@ServiceConnection(name = "redis")
	static GenericContainer<?> redis = new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
			.withExposedPorts(6379);

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private SocialAccountRepository socialAccountRepository;

	@Autowired
	private TokenRepository tokenRepository;

	@Autowired
	private AuthService authService;

	@Autowired
	private StringRedisTemplate stringRedisTemplate;

	@Autowired
	private EntityManager entityManager;

	@BeforeEach
	@AfterEach
	void clearRedisTokens() {
		tokenRepository.deleteAll();
		Set<String> userTokenIndexKeys = stringRedisTemplate.keys("auth:user-tokens:*");
		if (userTokenIndexKeys != null && !userTokenIndexKeys.isEmpty()) {
			stringRedisTemplate.delete(userTokenIndexKeys);
		}
	}

	@Test
	void persistsSocialUserAndGoogleIdentityWithSelfAuditFields() {
		User user = userRepository.saveAndFlush(User.createSocialAccount(
				"Google User",
				"google.user@example.com"
		));
		socialAccountRepository.saveAndFlush(SocialAccount.link(user, SocialProvider.GOOGLE, "google-subject-123"));
		entityManager.clear();

		SocialAccount socialAccount = socialAccountRepository
				.findByProviderAndProviderId(SocialProvider.GOOGLE, "google-subject-123")
				.orElseThrow();

		assertThat(socialAccount.getUser().getId()).isEqualTo(user.getId());
		assertThat(socialAccount.getUser().getPassword()).isNull();
		assertThat(socialAccount.getCreatedBy()).isEqualTo(user.getId());
		assertThat(socialAccount.getUpdatedBy()).isEqualTo(user.getId());
	}

	@Test
	void createsSocialUserAndOnlyRefreshSessionForNewVerifiedGoogleProfile() {
		JwtDetails refreshToken = authService.authenticateSocialAccount(googleProfile(
				"new-google-subject",
				"new.google.user@example.com",
				true
		));

		User socialUser = userRepository.findByEmail("new.google.user@example.com").orElseThrow();
		SocialAccount socialAccount = socialAccountRepository
				.findByProviderAndProviderId(SocialProvider.GOOGLE, "new-google-subject")
				.orElseThrow();
		List<Token> storedTokens = StreamSupport.stream(tokenRepository.findAll().spliterator(), false).toList();

		assertThat(socialUser.getPassword()).isNull();
		assertThat(socialAccount.getUser().getId()).isEqualTo(socialUser.getId());
		assertThat(storedTokens)
				.hasSize(1)
				.singleElement()
				.satisfies(token -> {
					assertThat(token.getJwtId()).isEqualTo(refreshToken.getJwtId());
					assertThat(token.getUserId()).isEqualTo(socialUser.getId().toString());
					assertThat(token.getTokenType()).isEqualTo(TokenType.REFRESH);
				});
	}

	@Test
	void reusesExistingUserWhenGoogleProviderIdentityAlreadyExists() {
		User existingUser = userRepository.saveAndFlush(User.createSocialAccount(
				"Existing Google User",
				"existing.google.user@example.com"
		));
		socialAccountRepository.saveAndFlush(SocialAccount.link(
				existingUser,
				SocialProvider.GOOGLE,
				"existing-google-subject"
		));

		JwtDetails refreshToken = authService.authenticateSocialAccount(googleProfile(
				"existing-google-subject",
				"renamed.google.email@example.com",
				true
		));

		assertThat(userRepository.count()).isEqualTo(1);
		assertThat(socialAccountRepository.count()).isEqualTo(1);
		assertThat(tokenRepository.findById(refreshToken.getJwtId()))
				.hasValueSatisfying(token -> {
					assertThat(token.getUserId()).isEqualTo(existingUser.getId().toString());
					assertThat(token.getTokenType()).isEqualTo(TokenType.REFRESH);
				});
	}

	@Test
	void rejectsGoogleProfileWhenItsEmailAlreadyBelongsToLocalAccount() {
		userRepository.saveAndFlush(User.createLocalAccount(
				"Local User",
				"local.user@example.com",
				"encoded-password"
		));

		assertThatThrownBy(() -> authService.authenticateSocialAccount(googleProfile(
					"blocked-google-subject",
					"LOCAL.USER@example.com",
					true
		)))
				.isInstanceOf(CustomException.class)
				.satisfies(exception -> assertThat(((CustomException) exception).getErrorCode())
						.isEqualTo(ErrorCode.SOCIAL_EMAIL_ALREADY_REGISTERED));

		assertThat(socialAccountRepository.count()).isZero();
		assertThat(tokenRepository.findAll()).isEmpty();
	}

	@Test
	void rejectsGoogleProfileWhenItsEmailIsNotVerified() {
		assertThatThrownBy(() -> authService.authenticateSocialAccount(googleProfile(
					"unverified-google-subject",
					"unverified.google.user@example.com",
					false
		)))
				.isInstanceOf(CustomException.class)
				.satisfies(exception -> assertThat(((CustomException) exception).getErrorCode())
						.isEqualTo(ErrorCode.SOCIAL_PROFILE_INVALID));

		assertThat(userRepository.count()).isZero();
		assertThat(socialAccountRepository.count()).isZero();
		assertThat(tokenRepository.findAll()).isEmpty();
	}

	private SocialProfile googleProfile(String providerId, String email, boolean emailVerified) {
		return SocialProfile.builder()
				.provider(SocialProvider.GOOGLE)
				.providerId(providerId)
				.email(email)
				.fullName("Google User")
				.emailVerified(emailVerified)
				.build();
	}
}
