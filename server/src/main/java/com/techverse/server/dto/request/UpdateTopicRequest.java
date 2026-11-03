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
public class UpdateTopicRequest {

	@Size(max = 100, message = "Topic name must not exceed 100 characters")
	@Pattern(regexp = "(?s).*\\S.*", message = "Topic name must not be blank")
	@Schema(description = "Omit to preserve; null is not allowed", example = "Backend Development")
	private String name;

	@Size(max = 500, message = "Topic description must not exceed 500 characters")
	@Schema(description = "Omit to preserve; null or blank clears the description")
	private String description;

	@Pattern(regexp = "^[a-z0-9]{1,64}$", message = "Topic icon must be a lowercase simple-icons slug")
	@Schema(description = "Omit to preserve; null or blank clears the icon", example = "docker")
	private String icon;

	@JsonIgnore
	private boolean nameProvided;
	@JsonIgnore
	private boolean descriptionProvided;
	@JsonIgnore
	private boolean iconProvided;

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

	@JsonSetter("icon")
	public void setIcon(String icon) {
		this.iconProvided = true;
		this.icon = icon == null || icon.isBlank() ? null : icon.strip();
	}

	@JsonIgnore
	@AssertTrue(message = "Provide at least one of name, description or icon")
	public boolean isUpdateProvided() {
		return nameProvided || descriptionProvided || iconProvided;
	}
}
