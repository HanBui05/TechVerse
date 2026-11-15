package com.techverse.server.entity;

import jakarta.persistence.*;

import lombok.*;

@Entity
@Table(
        name = "course_tags",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uq_course_tags_course_tag",
                        columnNames = {"course_id", "tag_id"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CourseTag extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tag_id", nullable = false)
    private Tag tag;

    CourseTag(Course course, Tag tag) {
        this.course = course;
        this.tag = tag;
    }
}
