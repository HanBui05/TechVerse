package com.techverse.server.dto.request;

import jakarta.validation.constraints.*;

import java.util.*;

/** Every active chapter (or lesson of one chapter) ID exactly once, in the new order. */
public record CourseReorderRequest(@NotNull @Size(max = 500) List<@NotNull UUID> ids) {}
