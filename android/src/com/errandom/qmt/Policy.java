package com.errandom.qmt;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

public final class Policy {
    public static final String ORIGIN = "https://qmt.errandom.com";
    private Policy() {}

    public static boolean trusted(String url) {
        try {
            URI uri = new URI(url);
            return "https".equalsIgnoreCase(uri.getScheme())
                && "qmt.errandom.com".equalsIgnoreCase(uri.getHost())
                && (uri.getPort() == -1 || uri.getPort() == 443)
                && uri.getRawUserInfo() == null;
        } catch (Exception e) { return false; }
    }

    public static String hash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder out = new StringBuilder();
            for (byte b : digest) out.append(String.format("%02x", b & 255));
            return out.toString();
        } catch (Exception e) { throw new IllegalStateException(e); }
    }

    public static boolean scheduleChanged(Map<String, String> before, Map<String, String> after,
                                          Map<String, Long> oldEnds, Map<String, Long> newStarts,
                                          long now, long previousUntil) {
        if (before == null) return false;
        for (String id : after.keySet()) {
            if (before.containsKey(id) && !before.get(id).equals(after.get(id))) return true;
            if (!before.containsKey(id) && newStarts.get(id) < previousUntil) return true;
        }
        for (String id : before.keySet())
            if (!after.containsKey(id) && oldEnds.get(id) > now) return true;
        return false;
    }
}
