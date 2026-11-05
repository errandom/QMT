package com.errandom.qmt;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

final class SessionStore {
    static final Object LOCK = new Object();
    private static final String KEY = "qmt-background-session";
    final SharedPreferences prefs;
    SessionStore(Context c) { prefs = c.getSharedPreferences("qmt_private", Context.MODE_PRIVATE); }
    boolean enabled() { return prefs.getBoolean("enabled", false); }
    boolean allowed(Context c) {
        return enabled() && c.getSystemService(android.app.NotificationManager.class).areNotificationsEnabled();
    }

    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (!store.containsAlias(KEY)) {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(KEY, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
            generator.generateKey();
        }
        return (SecretKey) store.getKey(KEY, null);
    }

    static String account(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 3) return null;
            JSONObject claims = new JSONObject(new String(Base64.decode(parts[1], Base64.URL_SAFE | Base64.NO_WRAP), StandardCharsets.UTF_8));
            if (claims.getLong("exp") <= System.currentTimeMillis() / 1000) return null;
            return claims.getString("id");
        } catch (Exception e) { return null; }
    }

    String token() {
        synchronized (LOCK) {
            try {
                String encrypted = prefs.getString("token", "");
                if (encrypted.isEmpty()) return null;
                String[] parts = encrypted.split(":");
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
                String value = new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), StandardCharsets.UTF_8);
                if (account(value) == null) { clear("Sign in again for request notifications."); return null; }
                return value;
            } catch (Exception e) { clear("Session storage unavailable. Sign in again."); return null; }
        }
    }

    void capture(String token) {
        synchronized (LOCK) {
            if (!enabled()) return;
            if (token == null || account(token) == null) {
                if (prefs.contains("token")) clear("Sign in for request notifications.");
                return;
            }
            if (Policy.hash(token).equals(prefs.getString("rejectedTokenHash", ""))) return;
            if (token.equals(token())) return;
            try {
                String identity = account(token);
                if (!identity.equals(prefs.getString("account", ""))) clear("Account changed; establishing a fresh baseline.");
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.ENCRYPT_MODE, key());
                String encrypted = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + ":" +
                    Base64.encodeToString(cipher.doFinal(token.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
                prefs.edit().putString("token", encrypted).putString("account", identity)
                    .remove("rejectedTokenHash").putString("status", "Session saved securely; waiting for a complete check.").commit();
            } catch (Exception e) { clear("Cannot securely store session; request checks unavailable."); }
        }
    }

    void clear(String status) {
        synchronized (LOCK) {
            prefs.edit().remove("token").remove("account").remove("snapshot").remove("requestCursor")
                .putString("status", status).commit();
        }
    }

    void reject(String token) {
        synchronized (LOCK) {
            clear("Session expired or inactive. Sign in again for request checks.");
            prefs.edit().putString("rejectedTokenHash", Policy.hash(token)).commit();
        }
    }
}
