package com.techverse.server.entity;

import com.techverse.server.persistence.CitextJdbcType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.JdbcType;

@Getter
@Entity
@DynamicUpdate
@Table(name = "topics")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Topic extends BaseEntity {

	@Column(nullable = false, unique = true, columnDefinition = "citext")
	@JdbcType(CitextJdbcType.class)
	private String name;

	@Column(length = 500)
	private String description;

	@Column(name = "is_active", nullable = false)
	private boolean active = true;

	@Builder
	private Topic(String name, String description) {
		this.name = name;
		this.description = description;
	}

	public void updateName(String name) {
		this.name = name;
	}

	public void updateDescription(String description) {
		this.description = description;
	}

	public void updateActiveStatus(boolean active) {
		this.active = active;
	}
}
