package com.techverse.server.dto.request;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonSetter;
import com.fasterxml.jackson.annotation.Nulls;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;

@Getter
public class UpdateTagRequest {

	@Size(max = 100, message = "Tag name must not exceed 100 characters")
	@Pattern(regexp = "(?s).*\\S.*", message = "Tag name must not be blank")
	@Schema(description = "Omit to preserve; null is not allowed", example = "Backend Development")
	private String name;

	@Size(max = 500, message = "Tag description must not exceed 500 characters")
	@Schema(description = "Omit to preserve; null or blank clears the description")
	private String description;

	@JsonIgnore
	private boolean nameProvided;
	@JsonIgnore
	private boolean descriptionProvided;

	@JsonSetter(value = "name", nulls = Nulls.FAIL)
	public void setName(String name) {
		this.nameProvided = true;
		this.name = name.strip();
	}

	@JsonSetter("description")
	public void setDescription(String description) {
		this.descriptionProvided = true;
		this.description = description == null || description.isBlank() ? null : description.strip();
	}

	@JsonIgnore
	@AssertTrue(message = "Provide at least one of name or description")
	public boolean isUpdateProvided() {
		return nameProvided || descriptionProvided;
	}
}
