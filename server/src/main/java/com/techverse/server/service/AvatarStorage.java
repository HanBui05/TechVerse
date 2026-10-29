package com.techverse.server.service;

import com.techverse.server.dto.internal.AvatarAsset;

import java.util.UUID;

public interface AvatarStorage {
    String FOLDER = "techverse/avatars";
    String DEFAULT_ID = FOLDER + "/default";

    boolean configured();

    AvatarAsset upload(String publicId, byte[] png);

    void deleteOwned(UUID ownerId, String url);
}
