package com.techverse.server.repository;

import com.techverse.server.entity.AuthSession;
import org.springframework.data.repository.CrudRepository;

public interface AuthSessionRepository extends CrudRepository<AuthSession, String> {
}
