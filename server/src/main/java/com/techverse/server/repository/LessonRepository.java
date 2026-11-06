package com.techverse.server.repository;

import com.techverse.server.entity.Lesson;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface LessonRepository extends JpaRepository<Lesson, UUID> {}
