package com.errandom.qmt;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URL;
import javax.net.ssl.HttpsURLConnection;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.TreeMap;

final class Poller {
    private final Context context;
    private final SessionStore store;
    interface Reader { String read(String path, String token) throws Exception; }
    private final Reader reader;
    Poller(Context c) { context = c; store = new SessionStore(c); reader = this::get; }
    Poller(Context c, Reader fixture) { context = c; store = new SessionStore(c); reader = fixture; }
    static final class Expired extends Exception {}

    private String get(String path, String token) throws Exception {
        if (Thread.currentThread().isInterrupted()) throw new InterruptedException();
        HttpsURLConnection connection = (HttpsURLConnection) new URL(Policy.ORIGIN + path).openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(10000);
        connection.setReadTimeout(15000);
        connection.setRequestProperty("Accept", "application/json");
        if (token != null) connection.setRequestProperty("Authorization", "Bearer " + token);
        try {
            int status = connection.getResponseCode();
            if (status == 401 || (token != null && status == 404 && path.equals("/api/auth/me"))) throw new Expired();
            if (status != 200) throw new IllegalStateException("Read unavailable");
            try (InputStream input = connection.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    if (Thread.currentThread().isInterrupted()) throw new InterruptedException();
                    if (output.size() + count > 8 * 1024 * 1024) throw new IllegalStateException("Response too large");
                    output.write(buffer, 0, count);
                }
                return output.toString("UTF-8");
            }
        } finally { connection.disconnect(); }
    }

    boolean run() {
        if (!store.allowed(context)) return true;
        String token = store.token();
        String account = token == null ? "public" : SessionStore.account(token);
        try {
            boolean operations = false;
            if (token != null) {
                JSONObject user = new JSONObject(reader.read("/api/auth/me", token));
                if (!account.equals(user.getString("id")) || !user.optBoolean("is_active", false)) throw new Expired();
                operations = "admin".equals(user.getString("role")) || "mgmt".equals(user.getString("role"));
            }
            long now = System.currentTimeMillis();
            LocalDate today = LocalDate.now(ZoneId.of("Europe/Zurich"));
            String from = today.toString();
            String to = today.plusDays(15).toString();
            long until = today.plusDays(15).atStartOfDay(java.time.ZoneOffset.UTC).toInstant().toEpochMilli();
            Map<String, String> hashes = new TreeMap<>();
            Map<String, Long> starts = new HashMap<>(), ends = new HashMap<>();
            long cursor = 0;
            boolean complete = false;
            for (int page = 0; page < 32; page++) {
                JSONArray rows = new JSONArray(reader.read("/api/events?from=" + from + "&to=" + to + "&limit=500&after=" + cursor, token));
                for (int i = 0; i < rows.length(); i++) {
                    JSONObject event = rows.getJSONObject(i);
                    long id = event.getLong("id");
                    if (id <= cursor) throw new IllegalStateException("Non-advancing event cursor");
                    cursor = id;
                    long end = Instant.parse(event.getString("end_time")).toEpochMilli();
                    if (end <= now) continue;
                    String key = Long.toString(id);
                    starts.put(key, Instant.parse(event.getString("start_time")).toEpochMilli());
                    ends.put(key, end);
                    StringBuilder canonical = new StringBuilder();
                    for (String field : new String[]{"name", "title", "description", "event_type", "start_time", "end_time",
                        "status", "team_id", "team_ids", "field_id", "field_ids", "notes", "external_allocations"})
                        canonical.append(field).append("=").append(JSONObject.quote(event.optString(field, ""))).append("\n");
                    hashes.put(key, Policy.hash(canonical.toString()));
                }
                if (rows.length() < 500) { complete = true; break; }
            }
            if (!complete) throw new IllegalStateException("Incomplete event snapshot");
            long requestMax = 0;
            long pendingMax = 0;
            if (operations) {
                complete = false;
                for (int page = 0; page < 32; page++) {
                    JSONArray rows = new JSONArray(reader.read("/api/requests?after=" + requestMax, token));
                    for (int i = 0; i < rows.length(); i++) {
                        JSONObject request = rows.getJSONObject(i);
                        long id = request.getLong("id");
                        if (id <= requestMax) throw new IllegalStateException("Non-advancing request cursor");
                        requestMax = id;
                        if ("Pending".equals(request.getString("status"))) pendingMax = Math.max(pendingMax, id);
                    }
                    if (rows.length() < 500) { complete = true; break; }
                }
                if (!complete) throw new IllegalStateException("Incomplete request snapshot");
            }
            synchronized (SessionStore.LOCK) {
                if (Thread.currentThread().isInterrupted() || !store.allowed(context)) return true;
                String current = store.token();
                if (token == null ? current != null : !token.equals(current)) return true;
                JSONObject old = store.prefs.contains("snapshot") ? new JSONObject(store.prefs.getString("snapshot", "")) : null;
                Map<String, String> before = null;
                Map<String, Long> oldEnds = new HashMap<>();
                if (old != null && account.equals(old.getString("account"))) {
                    before = new HashMap<>();
                    JSONObject oldHashes = old.getJSONObject("hashes"), oldEndJson = old.getJSONObject("ends");
                    java.util.Iterator<String> keys = oldHashes.keys();
                    while (keys.hasNext()) {
                        String key = keys.next(); before.put(key, oldHashes.getString(key)); oldEnds.put(key, oldEndJson.getLong(key));
                    }
                }
                boolean schedule = Policy.scheduleChanged(before, hashes, oldEnds, starts, now, old == null ? until : old.getLong("until"));
                boolean requests = operations && store.prefs.contains("requestCursor") && pendingMax > store.prefs.getLong("requestCursor", 0);
                JSONObject snapshot = new JSONObject().put("account", account).put("until", until)
                    .put("hashes", new JSONObject(hashes)).put("ends", new JSONObject(ends));
                if (schedule || requests) notifyUpdate(schedule, requests);
                android.content.SharedPreferences.Editor edit = store.prefs.edit().putString("snapshot", snapshot.toString())
                    .putString("status", "Last complete check: " + Instant.now() + (token == null ? " (public schedule only)" : ""));
                if (operations) edit.putLong("requestCursor", Math.max(requestMax, store.prefs.getLong("requestCursor", 0)));
                else edit.remove("requestCursor");
                edit.commit();
            }
            return true;
        } catch (Expired e) {
            synchronized (SessionStore.LOCK) {
                if (token != null && token.equals(store.token())) {
                    store.reject(token);
                    context.getSystemService(NotificationManager.class).cancel(4107);
                }
            }
            return true;
        } catch (Exception e) {
            synchronized (SessionStore.LOCK) {
                store.prefs.edit().putString("status", "Check incomplete; retained the last baseline. Will retry.").commit();
            }
            return false;
        }
    }

    private void notifyUpdate(boolean schedule, boolean requests) {
        Intent open = new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent click = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        context.getSystemService(NotificationManager.class).notify(4107, new Notification.Builder(context, PollJob.CHANNEL)
            .setSmallIcon(R.drawable.notification).setContentTitle("QMT update")
            .setContentText(schedule && requests ? "Schedule changes and new requests. Open QMT to review."
                : requests ? "New requests available. Open QMT to review." : "Upcoming schedule changed. Open QMT to review.")
            .setVisibility(Notification.VISIBILITY_PRIVATE).setContentIntent(click).setAutoCancel(true).build());
    }
}
