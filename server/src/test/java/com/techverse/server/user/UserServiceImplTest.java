package com.techverse.server.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.techverse.server.dto.request.ChangeMyPasswordRequest;
import com.techverse.server.entity.User;
import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;
import com.techverse.server.repository.PasswordChangeAttemptRepository;
import com.techverse.server.repository.UserRepository;
import com.techverse.server.service.TokenService;
import com.techverse.server.service.impl.UserServiceImpl;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

class UserServiceImplTest {

	private static final UUID USER_ID = UUID.randomUUID();
	private static final String SID = "current-sid";
	private static final ChangeMyPasswordRequest REQUEST =
			new ChangeMyPasswordRequest("OldSecure123!", "NewSecure123!", "NewSecure123!");

	private final UserRepository users = mock(UserRepository.class);
	private final PasswordEncoder encoder = mock(PasswordEncoder.class);
	private final PasswordChangeAttemptRepository attempts = mock(PasswordChangeAttemptRepository.class);
	private final TokenService tokens = mock(TokenService.class);
	private final UserServiceImpl service = new UserServiceImpl(users, encoder, attempts, tokens);
	private User localUser;

	@BeforeEach
	void setUp() {
		localUser = User.createLocalAccount("Local", "local@example.com", "{bcrypt}old-hash");
		when(users.findByIdForAuthentication(USER_ID)).thenReturn(Optional.of(localUser));
	}

	@Test
	void reportsLocalPasswordOnlyWhenAHashExists() {
		when(users.findWithRolesById(USER_ID)).thenReturn(Optional.of(localUser));
		assertThat(service.getMyProfile(USER_ID).isHasLocalPassword()).isTrue();

		when(users.findWithRolesById(USER_ID)).thenReturn(Optional.of(User.createSocialAccount("G", "g@example.com")));
		assertThat(service.getMyProfile(USER_ID).isHasLocalPassword()).isFalse();
	}

	@Test
	void socialOnlyAccountCannotChangePasswordAndDoesNotCountAnAttempt() {
		when(users.findByIdForAuthentication(USER_ID))
				.thenReturn(Optional.of(User.createSocialAccount("G", "g@example.com")));

		assertError(ErrorCode.PASSWORD_CHANGE_UNAVAILABLE);
		verify(attempts, never()).recordFailure(any());
		verify(encoder, never()).matches(any(), any());
	}

	@Test
	void rateLimitIsCheckedBeforeComparingPasswords() {
		when(attempts.isBlocked(USER_ID)).thenReturn(true);

		assertError(ErrorCode.PASSWORD_CHANGE_RATE_LIMITED);
		verify(encoder, never()).matches(any(), any());
	}

	@Test
	void wrongCurrentPasswordCountsAFailureAndKeepsTheHash() {
		when(encoder.matches("OldSecure123!", "{bcrypt}old-hash")).thenReturn(false);

		assertError(ErrorCode.CURRENT_PASSWORD_INCORRECT);
		verify(attempts).recordFailure(USER_ID);
		assertThat(localUser.getPassword()).isEqualTo("{bcrypt}old-hash");
	}

	@Test
	void newPasswordEqualToCurrentIsRejectedWithoutCountingAFailure() {
		when(encoder.matches(anyString(), any())).thenReturn(true);

		assertError(ErrorCode.NEW_PASSWORD_MUST_DIFFER);
		verify(attempts, never()).recordFailure(any());
		assertThat(localUser.getPassword()).isEqualTo("{bcrypt}old-hash");
	}

	@Test
	void successStoresEncodedHashClearsCounterAndRevokesOtherSessions() {
		when(encoder.matches("OldSecure123!", "{bcrypt}old-hash")).thenReturn(true);
		when(encoder.matches("NewSecure123!", "{bcrypt}old-hash")).thenReturn(false);
		when(encoder.encode("NewSecure123!")).thenReturn("{bcrypt}new-hash");

		service.changeMyPassword(USER_ID, SID, REQUEST);

		assertThat(localUser.getPassword()).isEqualTo("{bcrypt}new-hash");
		verify(users).saveAndFlush(localUser);
		verify(attempts).reset(USER_ID);
		verify(tokens).deleteOtherSessions(USER_ID, SID);
	}

	private void assertError(ErrorCode code) {
		assertThatThrownBy(() -> service.changeMyPassword(USER_ID, SID, REQUEST))
				.isInstanceOfSatisfying(CustomException.class, e -> assertThat(e.getErrorCode()).isEqualTo(code));
		verify(tokens, never()).deleteOtherSessions(any(), any());
		verify(attempts, never()).reset(any());
	}
}
