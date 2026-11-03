package com.techverse.server.dto.response;

/** Result of PUT/DELETE on the actor's saved flag; never includes a public save count. */
public record SavedArticleStateResponse(boolean saved) {}
