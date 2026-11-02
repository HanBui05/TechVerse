package com.techverse.server.dto.response;

import com.techverse.server.enums.AuthorApplicationStatus;
import java.util.List;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class MyAuthorProfileResponse {

	private final AuthorApplicationStatus applicationStatus;
	private final AuthorProfileResponse profile;
	private final List<AuthorReviewHistoryResponse> reviewHistory;
}
