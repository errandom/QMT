package com.errandom.qmt;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.MotionEvent;
import android.webkit.WebView;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

public final class UiTests extends Instrumentation {
    @Override public void onCreate(Bundle arguments) { super.onCreate(arguments); start(); }
    private String evaluate(WebView web, String script) throws Exception {
        CountDownLatch complete = new CountDownLatch(1);
        String[] value = {null};
        runOnMainSync(() -> web.evaluateJavascript(script, result -> { value[0] = result; complete.countDown(); }));
        if (!complete.await(8, TimeUnit.SECONDS)) throw new AssertionError("JavaScript callback timeout");
        return value[0];
    }
    @Override public void onStart() {
        Bundle result = new Bundle();
        Activity activity = null;
        int outcome = -1;
        try {
            activity = startActivitySync(new Intent(getTargetContext(), MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            java.lang.reflect.Field field = MainActivity.class.getDeclaredField("web"); field.setAccessible(true);
            WebView web = (WebView) field.get(activity);
            runOnMainSync(() -> web.loadDataWithBaseURL(Policy.ORIGIN,
                "<!doctype html><meta name='viewport' content='width=device-width,initial-scale=1'><body style='margin:16px'>"
                + "<button style='height:48px;width:120px' onclick=\"document.getElementById('form').hidden=false\">Login</button>"
                + "<div id='form' hidden><label>Fixture only <input type='text' style='display:block;font-size:16px;height:44px'></label>"
                + "<input type='password' style='display:block;font-size:16px;height:44px'></div></body>",
                "text/html", "UTF-8", null));
            Thread.sleep(3000);
            if (!"2".equals(evaluate(web, "1+1"))) throw new AssertionError("Renderer unavailable");
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
            Thread.sleep(1500);
            int[] resized = new int[1]; runOnMainSync(() -> resized[0] = web.getHeight());
            if (resized[0] >= height[0]) throw new AssertionError("Keyboard did not resize the WebView");
            result.putString("stream", "PASS: offline native shell fixture loaded, touchscreen button opened, keyboard resized WebView. No production access or credentials.\n");
        } catch (Throwable e) {
            outcome = 0; result.putString("stream", "FAIL: " + e.getClass().getSimpleName() + ": " + e.getMessage() + "\n");
        } finally {
            if (activity != null) { Activity closing = activity; runOnMainSync(closing::finish); }
        }
        finish(outcome, result);
    }
}
