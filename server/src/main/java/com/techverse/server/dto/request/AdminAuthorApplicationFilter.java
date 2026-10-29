package com.techverse.server.dto.request;

import com.techverse.server.enums.AdminAuthorApplicationSortBy;
import com.techverse.server.enums.AuthorProfileStatus;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.domain.Sort;

@Getter
@Setter
public class AdminAuthorApplicationFilter {
	@Size(max = 100)
	private String keyword;
	private AuthorProfileStatus status;
	private Boolean active;
	@Min(0)
	private int page = 0;
	@Min(1) @Max(100)
	private int size = 20;
	@NotNull
	private AdminAuthorApplicationSortBy sortBy = AdminAuthorApplicationSortBy.CREATED_AT;
	@NotNull
	private Sort.Direction direction = Sort.Direction.DESC;
}
