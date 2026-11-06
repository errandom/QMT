package com.errandom.qmt;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.Instrumentation;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.job.JobScheduler;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Rect;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.Switch;
import android.widget.TextView;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.function.BooleanSupplier;
import java.io.File;
import java.io.FileOutputStream;

public final class UiTests extends Instrumentation {
    @Override public void onCreate(Bundle arguments) { super.onCreate(arguments); start(); }
    private String evaluate(WebView web, String script) throws Exception {
        CountDownLatch complete = new CountDownLatch(1);
        String[] value = {null};
        runOnMainSync(() -> web.evaluateJavascript(script, result -> { value[0] = result; complete.countDown(); }));
        if (!complete.await(8, TimeUnit.SECONDS)) throw new AssertionError("JavaScript callback timeout: " + script);
        return value[0];
    }
    private Object field(Activity activity, String name) {
        try {
            java.lang.reflect.Field value = MainActivity.class.getDeclaredField(name); value.setAccessible(true);
            return value.get(activity);
        } catch (ReflectiveOperationException e) { throw new AssertionError(e); }
    }
    private View find(View root, String label) {
        if (label.equals(root.getContentDescription()) ||
            (root instanceof TextView && label.contentEquals(((TextView) root).getText()))) return root;
        if (root instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) root;
            for (int i = 0; i < group.getChildCount(); i++) {
                View found = find(group.getChildAt(i), label); if (found != null) return found;
            }
        }
        return null;
    }
    private void await(BooleanSupplier condition, String failure) throws InterruptedException {
        boolean[] ready = {false};
        for (int i = 0; i < 80; i++) {
            runOnMainSync(() -> ready[0] = condition.getAsBoolean());
            if (ready[0]) return;
            Thread.sleep(100);
        }
        throw new AssertionError(failure);
    }
    private void tap(View target) {
        if (target == null) throw new AssertionError("Missing native action");
        runOnMainSync(() -> target.requestRectangleOnScreen(new Rect(0, 0, target.getWidth(), target.getHeight()), true));
        waitForIdleSync();
        int[] location = new int[2]; runOnMainSync(() -> target.getLocationOnScreen(location));
        float x = location[0] + target.getWidth() / 2f, y = location[1] + target.getHeight() / 2f;
        long time = SystemClock.uptimeMillis();
        sendPointerSync(MotionEvent.obtain(time, time, MotionEvent.ACTION_DOWN, x, y, 0));
        sendPointerSync(MotionEvent.obtain(time, time + 80, MotionEvent.ACTION_UP, x, y, 0));
        waitForIdleSync();
    }
    private void screenshot(String name) throws Exception {
        Bitmap image = getUiAutomation().takeScreenshot();
        if (image == null) throw new AssertionError("Screenshot unavailable");
        File directory = getTargetContext().getExternalFilesDir(null);
        if (directory == null || (!directory.exists() && !directory.mkdirs())) throw new AssertionError("Fixture output unavailable");
        try (FileOutputStream output = new FileOutputStream(new File(directory, name + ".png"))) {
            if (!image.compress(Bitmap.CompressFormat.PNG, 100, output)) throw new AssertionError("Screenshot save failed");
        } finally { image.recycle(); }
    }
    private void loadFixture(WebView web) {
        runOnMainSync(() -> web.loadDataWithBaseURL(Policy.ORIGIN,
            "<!doctype html><meta name='viewport' content='width=device-width,initial-scale=1'><body style='margin:16px'>"
            + "<button style='height:48px;width:120px' onclick=\"document.getElementById('form').hidden=false\">Login</button>"
            + "<div id='form' hidden><label>Fixture only <input type='text' style='display:block;font-size:16px;height:44px'></label>"
            + "<input type='password' style='display:block;font-size:16px;height:44px'></div></body>",
            "text/html", "UTF-8", null));
    }
    @Override public void onStart() {
        Bundle result = new Bundle();
        Activity activity = null;
        SessionStore store = new SessionStore(getTargetContext());
        int outcome = -1;
        try {
            store.prefs.edit().clear().commit();
            activity = startActivitySync(new Intent(getTargetContext(), MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            Activity screen = activity;
            WebView web = (WebView) field(screen, "web");
            View controls = (View) field(screen, "controls");
            Button alerts = (Button) field(screen, "alerts");
            Button refresh = (Button) find(controls, "Refresh QMT");
            loadFixture(web);
            await(() -> web.isShown() && Boolean.TRUE.equals(field(screen, "loaded")),
                "Offline fixture did not finish loading visibly");
            if (!"2".equals(evaluate(web, "1+1"))) throw new AssertionError("Renderer unavailable");
            int minimum = (int) (48 * getTargetContext().getResources().getDisplayMetrics().density);
            await(() -> refresh != null && refresh.getHeight() >= minimum && alerts.getHeight() >= minimum &&
                controls.getTop() == web.getBottom(), "Dock bounds or minimum touch targets failed");
            int navigation = (Integer) field(screen, "navigation");
            tap(refresh);
            await(() -> (Integer) field(screen, "navigation") > navigation, "Refresh did not reload the WebView");
            tap(alerts);
            AlertDialog dialog = (AlertDialog) field(screen, "alertDialog");
            Switch toggle = (Switch) field(screen, "alertToggle");
            TextView status = (TextView) field(screen, "alertStatus");
            await(() -> dialog.isShowing() && !toggle.isChecked(), "Alerts panel did not reflect initial opt-out");
            Rect doneBounds = new Rect();
            await(() -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).getGlobalVisibleRect(doneBounds) &&
                doneBounds.height() == dialog.getButton(AlertDialog.BUTTON_POSITIVE).getHeight(),
                "Settings completion action is clipped");
            tap(toggle);
            await(() -> store.enabled() && alerts.getText().toString().endsWith("on"), "Opt-in did not update the dock");
            screenshot("native-alerts");
            store.prefs.edit().putString("status", "Offline fixture status updated.").commit();
            await(() -> status.getText().toString().contains("Offline fixture status updated."),
                "An open panel did not refresh background status");
            runOnMainSync(() -> screen.onRequestPermissionsResult(301,
                new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, new int[]{PackageManager.PERMISSION_DENIED}));
            await(() -> !store.enabled() && !toggle.isChecked() && alerts.getText().toString().endsWith("off") &&
                status.getText().toString().toLowerCase(java.util.Locale.ROOT).contains("permission"),
                "Permission denial left stale opt-in UI or overwrote the denial reason");
            tap(toggle);
            String[] currentUrl = {null}; runOnMainSync(() -> currentUrl[0] = web.getUrl());
            tap(find(dialog.getWindow().getDecorView(), "Forget background session"));
            await(() -> !store.enabled() && !toggle.isChecked() && alerts.getText().toString().endsWith("off") &&
                status.getText().toString().contains("forgotten") && currentUrl[0].equals(web.getUrl()),
                "Forgetting the session left stale UI, overwrote its reason, or navigated the web page");
            tap(toggle);
            NotificationManager manager = getTargetContext().getSystemService(NotificationManager.class);
            manager.createNotificationChannel(new NotificationChannel(PollJob.CHANNEL, "QMT updates", NotificationManager.IMPORTANCE_NONE));
            store.prefs.edit().putString("status", "Android notification channel blocked in the offline fixture.").commit();
            await(() -> toggle.isChecked() && alerts.getText().toString().endsWith("paused") &&
                status.getText().toString().contains("Paused in Android"), "Android-blocked alerts were presented as available");
            screenshot("native-alerts-paused");
            tap(dialog.getButton(AlertDialog.BUTTON_POSITIVE));
            await(() -> field(screen, "alertDialog") == null, "Settings panel did not close");
            store.prefs.edit().putBoolean("enabled", false).commit();
            getTargetContext().getSystemService(JobScheduler.class).cancel(PollJob.ID);
            Rect dockBounds = new Rect();
            await(() -> alerts.getText().toString().endsWith("off") && controls.isShown() &&
                controls.getGlobalVisibleRect(dockBounds) && dockBounds.height() == controls.getHeight(),
                "Dock was hidden, clipped, or stale after closing settings");
            runOnMainSync(() -> {
                try {
                    java.lang.reflect.Method failure = MainActivity.class.getDeclaredMethod("showError", String.class);
                    failure.setAccessible(true); failure.invoke(screen, "Offline connection fixture");
                } catch (ReflectiveOperationException e) { throw new AssertionError(e); }
            });
            View error = (View) field(screen, "error");
            await(() -> web.getVisibility() == View.GONE && error.getBottom() == controls.getTop() &&
                error.getHeight() > controls.getHeight(), "Offline error moved the dock away from the bottom");
            Thread.sleep(500);
            screenshot("native-offline");
            loadFixture(web);
            await(() -> web.isShown() && Boolean.TRUE.equals(field(screen, "loaded")),
                "Offline fixture did not recover visibly");
            String position = null;
            for (int i = 0; i < 50; i++) {
                position = evaluate(web, "(function(){const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Login');if(!b)return null;const r=b.getBoundingClientRect();return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2,scale:devicePixelRatio});})()");
                if (!"null".equals(position)) break;
                Thread.sleep(500);
            }
            if (position == null || "null".equals(position)) throw new AssertionError("Offline fixture did not load");
            JSONObject rect = new JSONObject(new JSONArray("[" + position + "]").getString(0));
            int[] location = new int[2]; runOnMainSync(() -> web.getLocationOnScreen(location));
            float x = (float) (location[0] + rect.getDouble("x") * rect.getDouble("scale"));
            float y = (float) (location[1] + rect.getDouble("y") * rect.getDouble("scale"));
            long time = SystemClock.uptimeMillis();
            sendPointerSync(MotionEvent.obtain(time, time, MotionEvent.ACTION_DOWN, x, y, 0));
            sendPointerSync(MotionEvent.obtain(time, time + 80, MotionEvent.ACTION_UP, x, y, 0));
            Thread.sleep(800);
            String opened = evaluate(web, "document.getElementById('form').hidden");
            if (!"false".equals(opened)) throw new AssertionError("Login touch did not open fixture; x=" + x + ", y=" + y);
            String input = evaluate(web, "(function(){const r=document.querySelector('input:not([type=hidden])').getBoundingClientRect();return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2});})()");
            JSONObject inputRect = new JSONObject(new JSONArray("[" + input + "]").getString(0));
            int[] height = new int[1]; runOnMainSync(() -> height[0] = web.getHeight());
            x = (float) (location[0] + inputRect.getDouble("x") * rect.getDouble("scale"));
            y = (float) (location[1] + inputRect.getDouble("y") * rect.getDouble("scale"));
            time = SystemClock.uptimeMillis();
            sendPointerSync(MotionEvent.obtain(time, time, MotionEvent.ACTION_DOWN, x, y, 0));
            sendPointerSync(MotionEvent.obtain(time, time + 80, MotionEvent.ACTION_UP, x, y, 0));
            String focused = null;
            for (int i = 0; i < 40; i++) {
                focused = evaluate(web, "document.activeElement.tagName");
                if ("\"INPUT\"".equals(focused)) break;
                Thread.sleep(100);
            }
            screenshot("native-keyboard");
            if (!"\"INPUT\"".equals(focused))
                throw new AssertionError("Touch did not focus the empty input; x=" + x + ", y=" + y + ", active=" + focused);
            try {
                await(() -> web.getHeight() < height[0], "Keyboard did not resize the WebView");
                if (Build.VERSION.SDK_INT >= 30)
                    await(() -> controls.getVisibility() == View.GONE &&
                        screen.getWindow().getDecorView().getRootWindowInsets().isVisible(android.view.WindowInsets.Type.ime()),
                        "Dock did not make room for the visible keyboard");
                Thread.sleep(500);
            } finally { screenshot("native-keyboard"); }
            sendKeyDownUpSync(KeyEvent.KEYCODE_BACK);
            await(() -> controls.getVisibility() == View.VISIBLE && !screen.isFinishing(), "Dock did not return after closing the keyboard");
            Thread.sleep(500);
            screenshot("native-controls");
            result.putString("stream", "PASS: bottom dock/reload, live alert opt-in/status/denial/forget flows, Android-blocked state, scrollable settings, offline layout, touchscreen fixture and keyboard resizing/dock recovery. No production access or credentials.\n");
        } catch (Throwable e) {
            outcome = 0; result.putString("stream", "FAIL: " + android.util.Log.getStackTraceString(e) + "\n");
        } finally {
            store.prefs.edit().clear().commit();
            getTargetContext().getSystemService(JobScheduler.class).cancel(PollJob.ID);
            getTargetContext().getSystemService(NotificationManager.class).cancel(PollJob.ID);
            if (activity != null) { Activity closing = activity; runOnMainSync(closing::finish); }
        }
        finish(outcome, result);
    }
}
