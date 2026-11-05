package com.errandom.qmt;

import android.app.Instrumentation;
import android.app.NotificationManager;
import android.app.job.JobScheduler;
import android.content.Context;
import android.os.Bundle;
import android.util.Base64;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.time.Instant;

public final class AndroidTests extends Instrumentation {
    private int checks;
    @Override public void onCreate(Bundle arguments) { super.onCreate(arguments); start(); }
    private void check(boolean condition, String message) { checks++; if (!condition) throw new AssertionError(message); }
    private int awaitNotifications(NotificationManager nm, int expected) throws Exception {
        for (int i = 0; i < 30; i++) {
            int actual = nm.getActiveNotifications().length;
            if (actual == expected) return actual;
            Thread.sleep(100);
        }
        return nm.getActiveNotifications().length;
    }
    private String syntheticToken(int id) throws Exception {
        String claims = new JSONObject().put("id", id).put("exp", Instant.now().getEpochSecond() + 3600).toString();
        return "synthetic." + Base64.encodeToString(claims.getBytes(StandardCharsets.UTF_8), Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING) + ".fixture";
    }
    @Override public void onStart() {
        Bundle result = new Bundle();
        Context c = getTargetContext();
        SessionStore store = new SessionStore(c);
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        int outcome = ActivityResult.OK;
        try {
            store.prefs.edit().clear().commit();
            check(!store.enabled(), "Notifications default off");
            store.capture(syntheticToken(900));
            check(store.token() == null, "No persisted token without opt-in");
            store.prefs.edit().putBoolean("enabled", true).commit();
            PollJob.configure(c);
            check(c.getSystemService(JobScheduler.class).getPendingJob(PollJob.ID).isPersisted(), "Periodic job must persist");
            check(c.getSystemService(JobScheduler.class).getPendingJob(PollJob.ID).getIntervalMillis() >= 900000, "Interval >= 15 minutes");
            c.getSystemService(JobScheduler.class).cancel(PollJob.ID);
            nm.cancelAll();
            String token = syntheticToken(901);
            store.capture(token);
            check(token.equals(store.token()), "Keystore encrypt/decrypt");
            check(!store.prefs.getString("token", "").contains(token), "No plaintext token");
            final int[] revision = {0}, max = {1};
            String start = Instant.now().plusSeconds(3600).toString(), end = Instant.now().plusSeconds(7200).toString();
            Poller.Reader fixture = (path, bearer) -> {
                if (path.equals("/api/auth/me")) return "{\"id\":901,\"role\":\"admin\",\"is_active\":true}";
                if (path.startsWith("/api/events?")) return "[{\"id\":1,\"name\":\"Synthetic " + revision[0] + "\",\"start_time\":\"" + start + "\",\"end_time\":\"" + end + "\"}]";
                if (path.startsWith("/api/requests?")) return "[{\"id\":" + max[0] + ",\"status\":\"Pending\"}]";
                throw new AssertionError("Unexpected read path");
            };
            check(new Poller(c, fixture).run(), "First complete fixture fetch");
            Thread.sleep(300);
            check(nm.getActiveNotifications().length == 0, "First baseline must not notify");
            check(new Poller(c, fixture).run(), "Unchanged fetch");
            check(nm.getActiveNotifications().length == 0, "No unchanged notification");
            revision[0]++;
            check(new Poller(c, fixture).run(), "Changed schedule fetch");
            Thread.sleep(300);
            check(awaitNotifications(nm, 1) == 1, "Changed schedule notification delivered locally");
            nm.cancelAll(); check(awaitNotifications(nm, 0) == 0, "Schedule notification cancellation");
            Thread.sleep(1200);
            check(store.prefs.getLong("requestCursor", -1) == 1, "Initial request cursor retained");
            max[0]++;
            check(new Poller(c, fixture).run(), "New request fetch");
            check(store.prefs.getLong("requestCursor", -1) == 2, "New request cursor advanced");
            Thread.sleep(300);
            check(awaitNotifications(nm, 1) == 1, "New request notification delivered locally");
            nm.cancelAll();
            String baseline = store.prefs.getString("snapshot", "");
            long cursor = store.prefs.getLong("requestCursor", -1);
            check(!new Poller(c, (path, bearer) -> path.startsWith("/api/requests?") ? "invalid" : fixture.read(path, bearer)).run(), "Incomplete fetch rejected");
            check(baseline.equals(store.prefs.getString("snapshot", "")), "Incomplete fetch retains schedule baseline");
            check(cursor == store.prefs.getLong("requestCursor", -1), "Incomplete fetch retains request baseline");
            check(new Poller(c, (path, bearer) -> { throw new Poller.Expired(); }).run(), "401 handled");
            check(store.token() == null && !store.prefs.contains("snapshot"), "401 erases session/baselines");
            store.capture(token);
            check(store.token() == null, "Rejected token cannot be re-captured from stale web storage");
            store.capture(syntheticToken(902));
            check("902".equals(store.prefs.getString("account", "")), "New account identity");
            check(!store.prefs.contains("requestCursor"), "New account resets request baseline");
            store.capture(null);
            check(store.token() == null && !store.prefs.contains("account"), "Logout erases captured session");
            result.putString("stream", "PASS: " + checks + " Android synthetic checks; local schedule/request notifications observed.\n");
        } catch (Throwable e) {
            result.putString("stream", "FAIL: " + e.getClass().getSimpleName() + ": " + e.getMessage() + "\n");
            outcome = ActivityResult.FAIL;
        } finally {
            store.prefs.edit().clear().commit(); nm.cancelAll(); c.getSystemService(JobScheduler.class).cancel(PollJob.ID);
        }
        finish(outcome, result);
    }
    private static final class ActivityResult { static final int OK = -1; static final int FAIL = 0; }
}
