package com.techverse.server.entity;

import jakarta.persistence.*;

import lombok.*;

import org.hibernate.annotations.Immutable;

@Entity
@Immutable
@Table(name = "course_publication_version_tags")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CourseVersionTag extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "version_id", nullable = false, updatable = false)
    private CoursePublicationVersion version;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tag_id", nullable = false, updatable = false)
    private Tag tag;

    CourseVersionTag(CoursePublicationVersion version, Tag tag) {
        this.version = version;
        this.tag = tag;
    }
}
