package com.techverse.server.dto.request;

import com.techverse.server.enums.AdminUserSortBy;
import com.techverse.server.enums.AuthorProfileStatus;
import com.techverse.server.enums.RoleName;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.domain.Sort;

@Getter
@Setter
public class AdminUserFilter {

	@Size(max = 100, message = "Keyword must not exceed 100 characters")
	@Schema(description = "Case-insensitive partial match against full name or email", example = "han")
	private String keyword;

	@Schema(description = "Filter by account activity")
	private Boolean active;

	@Schema(description = "Filter by an assigned role")
	private RoleName role;

	@Schema(description = "Filter by author application status; excludes users without an author profile")
	private AuthorProfileStatus authorStatus;

	@Min(value = 0, message = "Page must be at least 0")
	@Schema(defaultValue = "0", minimum = "0")
	private int page = 0;

	@Min(value = 1, message = "Size must be at least 1")
	@Max(value = 100, message = "Size must not exceed 100")
	@Schema(defaultValue = "20", minimum = "1", maximum = "100")
	private int size = 20;

	@NotNull(message = "Sort field is required")
	@Schema(defaultValue = "CREATED_AT", allowableValues = {"CREATED_AT", "FULL_NAME", "EMAIL"})
	private AdminUserSortBy sortBy = AdminUserSortBy.CREATED_AT;

	@NotNull(message = "Sort direction is required")
	@Schema(defaultValue = "DESC", allowableValues = {"ASC", "DESC"})
	private Sort.Direction direction = Sort.Direction.DESC;
}
