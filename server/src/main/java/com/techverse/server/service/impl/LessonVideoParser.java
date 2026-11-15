package com.techverse.server.service.impl;

import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;

import java.net.URI;
import java.util.Set;
import java.util.regex.Pattern;

/** Extracts the 11-character YouTube video ID from an allowlisted HTTPS URL; nothing else is stored. */
public final class LessonVideoParser {
    private static final Set<String> YOUTUBE_HOSTS = Set.of("youtube.com", "www.youtube.com", "m.youtube.com");
    private static final Pattern ID = Pattern.compile("[A-Za-z0-9_-]{11}");
    // Playlist and start-time parameters are rejected rather than silently dropped.
    private static final Pattern REJECTED_PARAM = Pattern.compile("(^|&)(list|t|start|time_continue)(=|&|$)");

    private LessonVideoParser() {}

    public static String youtubeId(String url) {
        if (url == null) throw invalid();
        URI uri;
        try {
            uri = new URI(url.trim());
        } catch (java.net.URISyntaxException e) {
            throw invalid();
        }
        String host = uri.getHost();
        String query = uri.getRawQuery();
        String fragment = uri.getRawFragment();
        if (!"https".equals(uri.getScheme())
                || host == null
                || uri.getRawUserInfo() != null
                || uri.getPort() != -1
                || (query != null && REJECTED_PARAM.matcher(query).find())
                || (fragment != null && REJECTED_PARAM.matcher(fragment).find()))
            throw invalid();
        host = host.toLowerCase();
        String path = uri.getRawPath() == null ? "" : uri.getRawPath();

        String id = null;
        if (host.equals("youtu.be")) {
            id = path.startsWith("/") ? path.substring(1) : null;
        } else if (YOUTUBE_HOSTS.contains(host)) {
            if (path.equals("/watch")) id = queryValue(query, "v");
            else if (path.startsWith("/shorts/")) id = path.substring("/shorts/".length());
            else if (path.startsWith("/embed/")) id = path.substring("/embed/".length());
        }
        if (id == null || !ID.matcher(id).matches()) throw invalid();
        return id;
    }

    private static String queryValue(String query, String name) {
        if (query == null) return null;
        for (String pair : query.split("&")) {
            if (pair.startsWith(name + "=")) return pair.substring(name.length() + 1);
        }
        return null;
    }

    private static CustomException invalid() {
        return new CustomException(ErrorCode.LESSON_VIDEO_INVALID);
    }
}
