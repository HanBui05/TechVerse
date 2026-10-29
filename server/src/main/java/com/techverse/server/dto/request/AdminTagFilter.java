package com.techverse.server.dto.request;

import com.techverse.server.enums.AdminTagSortBy;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.domain.Sort;

@Getter
@Setter
public class AdminTagFilter {
	@Size(max = 100, message = "Keyword must not exceed 100 characters")
	@Schema(description = "Case-insensitive literal partial match against tag name")
	private String keyword;
	@Schema(description = "Omit to include both active and inactive tags")
	private Boolean active;
	@Min(value = 0, message = "Page must be at least 0")
	@Schema(defaultValue = "0")
	private int page = 0;
	@Min(value = 1, message = "Size must be at least 1")
	@Max(value = 100, message = "Size must not exceed 100")
	@Schema(defaultValue = "20")
	private int size = 20;
	@NotNull(message = "Sort field is required")
	@Schema(defaultValue = "CREATED_AT")
	private AdminTagSortBy sortBy = AdminTagSortBy.CREATED_AT;
	@NotNull(message = "Sort direction is required")
	@Schema(defaultValue = "DESC")
	private Sort.Direction direction = Sort.Direction.DESC;
}
