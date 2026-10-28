package com.techverse.server.entity;

import com.techverse.server.persistence.CitextJdbcType;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcType;
import org.hibernate.annotations.DynamicUpdate;

@Getter
@Entity
@DynamicUpdate
@Table(name = "users")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User extends BaseEntity {

	@Column(name = "full_name", nullable = false, length = 150)
	private String fullName;

	@Column(nullable = false, unique = true, columnDefinition = "citext")
	@JdbcType(CitextJdbcType.class)
	private String email;

	@Column(length = 255)
	private String password;

	@Column(name = "phone_number", length = 20)
	private String phoneNumber;

	@Column(name = "date_of_birth")
	private LocalDate dateOfBirth;

	@Column(name = "avatar_url")
	private String avatarUrl;

	@Column(name = "is_active", nullable = false)
	private boolean active = true;

	@OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
	private final Set<UserRole> userRoles = new HashSet<>();

	private User(String fullName, String email, String password, String phoneNumber, LocalDate dateOfBirth) {
		this.fullName = fullName;
		this.email = email;
		this.password = password;
		this.phoneNumber = phoneNumber;
		this.dateOfBirth = dateOfBirth;
	}

	public static User createLocalAccount(String fullName, String email, String encodedPassword) {
		return createLocalAccount(fullName, email, encodedPassword, null, null);
	}

	public static User createLocalAccount(
			String fullName,
			String email,
			String encodedPassword,
			String phoneNumber,
			LocalDate dateOfBirth
	) {
		return new User(fullName, email, encodedPassword, phoneNumber, dateOfBirth);
	}

	public static User createSocialAccount(String fullName, String email) {
		return new User(fullName, email, null, null, null);
	}

	public void updateProfile(String fullName, String phoneNumber, LocalDate dateOfBirth) {
		if (fullName != null) {
			this.fullName = fullName.trim();
		}
		if (phoneNumber != null) {
			this.phoneNumber = phoneNumber.isBlank() ? null : phoneNumber.trim();
		}
		if (dateOfBirth != null) {
			this.dateOfBirth = dateOfBirth;
		}
	}

	public void updateActiveStatus(boolean active) {
		this.active = active;
	}

	public void changePassword(String encodedPassword) {
		this.password = encodedPassword;
	}

	public void addRole(Role role) {
		userRoles.add(new UserRole(this, role));
	}
}
