package com.errandom.qmt;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.Gravity;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.*;
import android.widget.*;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.net.URL;
import javax.net.ssl.HttpsURLConnection;

public final class MainActivity extends Activity {
    private WebView web;
    private LinearLayout error;
    private TextView errorText;
    private ProgressBar progress;
    private SessionStore store;
    private LinearLayout controls;
    private Button alerts;
    private AlertDialog alertDialog;
    private Switch alertToggle;
    private TextView alertStatus;
    private int navy, accent, charcoal, surface;
    private final SharedPreferences.OnSharedPreferenceChangeListener preferenceChanged = (prefs, key) -> refreshAlerts();
    private ValueCallback<Uri[]> fileCallback;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private int navigation;
    private boolean loaded;
    private String retryUrl = Policy.ORIGIN;
    private byte[] export;
    private String exportUrl;
    private final Runnable sessionWatch = new Runnable() {
        @Override public void run() { captureSession(); handler.postDelayed(this, 1000); }
    };

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        store = new SessionStore(this);
        navy = getColor(R.color.qmt_navy);
        accent = getColor(R.color.qmt_accent);
        charcoal = getColor(R.color.qmt_charcoal);
        surface = getColor(R.color.qmt_surface);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        getWindow().setStatusBarColor(navy);
        getWindow().setNavigationBarColor(navy);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(navy);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                android.graphics.Insets keyboard = insets.getInsets(WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, keyboard.bottom));
                controls.setVisibility(insets.isVisible(WindowInsets.Type.ime()) ? View.GONE : View.VISIBLE);
                return WindowInsets.CONSUMED;
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
                WindowInsets consumed = insets.consumeSystemWindowInsets().consumeStableInsets();
                return Build.VERSION.SDK_INT >= 28 ? consumed.consumeDisplayCutout() : consumed;
            }
        });
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setProgressTintList(ColorStateList.valueOf(accent));
        progress.setProgressBackgroundTintList(ColorStateList.valueOf(navy));
        root.addView(progress, new LinearLayout.LayoutParams(-1, dp(3)));
        error = new LinearLayout(this); error.setOrientation(LinearLayout.VERTICAL);
        error.setGravity(Gravity.CENTER); error.setBackgroundColor(surface); error.setPadding(dp(24), dp(24), dp(24), dp(24));
        errorText = text("", 18, charcoal); errorText.setGravity(Gravity.CENTER); error.addView(errorText);
        Button retry = action("Retry secure connection", R.drawable.action_refresh, Color.WHITE, accent);
        retry.setOnClickListener(v -> web.loadUrl(retryUrl));
        LinearLayout.LayoutParams retryLayout = new LinearLayout.LayoutParams(-2, -2); retryLayout.topMargin = dp(20);
        error.addView(retry, retryLayout); error.setVisibility(View.GONE);
        root.addView(error, new LinearLayout.LayoutParams(-1, 0, 1));
        web = new WebView(this);
        root.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
        controls = new LinearLayout(this); controls.setOrientation(LinearLayout.VERTICAL);
        controls.setBackgroundColor(navy); controls.setElevation(dp(6));
        View divider = new View(this); divider.setBackgroundColor(Color.argb(35, 245, 245, 245));
        controls.addView(divider, new LinearLayout.LayoutParams(-1, dp(1)));
        LinearLayout actions = new LinearLayout(this); actions.setGravity(Gravity.CENTER_VERTICAL);
        actions.setPadding(dp(12), dp(6), dp(12), dp(6));
        Button refresh = action("Refresh", R.drawable.action_refresh, Color.WHITE, Color.TRANSPARENT);
        refresh.setContentDescription("Refresh QMT"); refresh.setTooltipText("Reload the current QMT page");
        refresh.setOnClickListener(v -> web.reload());
        actions.addView(refresh, new LinearLayout.LayoutParams(0, -2, 1));
        alerts = action("Alerts off", R.drawable.action_alerts, Color.WHITE, Color.TRANSPARENT);
        alerts.setOnClickListener(v -> settings());
        actions.addView(alerts, new LinearLayout.LayoutParams(0, -2, 1));
        controls.addView(actions); root.addView(controls);
        setContentView(root);
        if (Build.VERSION.SDK_INT >= 30 && getWindow().getInsetsController() != null) {
            getWindow().getInsetsController().setSystemBarsAppearance(
                0,
                android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
        } else {
            root.setSystemUiVisibility(root.getSystemUiVisibility() &
                ~(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR));
        }
        WebView.setWebContentsDebuggingEnabled(false);
        WebSettings config = web.getSettings();
        config.setJavaScriptEnabled(true);
        config.setDomStorageEnabled(true);
        config.setUseWideViewPort(true);
        config.setLoadWithOverviewMode(true);
        config.setBuiltInZoomControls(true);
        config.setDisplayZoomControls(false);
        config.setAllowFileAccess(false);
        config.setAllowContentAccess(false);
        config.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        config.setSafeBrowsingEnabled(true);
        config.setSupportMultipleWindows(true);
        config.setJavaScriptCanOpenWindowsAutomatically(false);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                if (Policy.trusted(request.getUrl().toString())) return false;
                if (request.isForMainFrame() && request.hasGesture()) external(request.getUrl());
                return true;
            }
            @Override public void onPageStarted(WebView v, String url, android.graphics.Bitmap icon) {
                navigation++; loaded = false;
                if (!Policy.trusted(url)) { v.stopLoading(); showError("This address cannot be opened inside QMT."); return; }
                retryUrl = url; error.setVisibility(View.GONE); web.setVisibility(View.VISIBLE);
            }
            @Override public void onPageFinished(WebView v, String url) {
                if (Policy.trusted(url) && error.getVisibility() != View.VISIBLE) { loaded = true; captureSession(); }
            }
            @Override public void onReceivedError(WebView v, WebResourceRequest request, WebResourceError failure) {
                if (request.isForMainFrame()) showError("QMT could not connect. Check your connection, then retry.");
            }
            @Override public void onReceivedHttpError(WebView v, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame()) showError("QMT is temporarily unavailable (HTTP " + response.getStatusCode() + ").");
            }
            @Override public void onReceivedSslError(WebView v, SslErrorHandler ssl, SslError failure) {
                ssl.cancel(); showError("Secure connection failed. No certificate exceptions are allowed. Please retry later.");
            }
            @Override public boolean onRenderProcessGone(WebView v, RenderProcessGoneDetail detail) {
                showError("The web display stopped. Close and reopen QMT to recover."); return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView v, int value) {
                progress.setProgress(value); progress.setVisibility(value == 100 ? View.GONE : View.VISIBLE);
            }
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (!Policy.trusted(v.getUrl()) || !loaded) return false;
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent choose = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
                String[] types = params.getAcceptTypes();
                if (types.length > 0 && types[0].contains("/")) choose.putExtra(Intent.EXTRA_MIME_TYPES, types);
                choose.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                try { startActivityForResult(choose, 201); }
                catch (ActivityNotFoundException e) { fileCallback.onReceiveValue(null); fileCallback = null; toast("No file picker available."); }
                return true;
            }
            @Override public boolean onCreateWindow(WebView v, boolean dialog, boolean gesture, android.os.Message result) {
                if (!gesture) return false;
                WebView popup = new WebView(MainActivity.this);
                popup.setWebViewClient(new WebViewClient() {
                    @Override public boolean shouldOverrideUrlLoading(WebView w, WebResourceRequest request) {
                        String url = request.getUrl().toString();
                        if (Policy.trusted(url)) web.loadUrl(url); else external(request.getUrl());
                        w.destroy(); return true;
                    }
                });
                ((WebView.WebViewTransport) result.obj).setWebView(popup); result.sendToTarget(); return true;
            }
        });
        web.setDownloadListener((url, agent, disposition, mime, length) -> download(url, mime, disposition));
        PollJob.configure(this);
        store.prefs.registerOnSharedPreferenceChangeListener(preferenceChanged);
        refreshAlerts();
        if (Build.VERSION.SDK_INT >= 33) getOnBackInvokedDispatcher().registerOnBackInvokedCallback(0, this::back);
        if (saved == null || web.restoreState(saved) == null) web.loadUrl(Policy.ORIGIN);
    }

    private int dp(int value) { return (int) (getResources().getDisplayMetrics().density * value); }
    private GradientDrawable rounded(int color) {
        GradientDrawable shape = new GradientDrawable(); shape.setColor(color); shape.setCornerRadius(dp(12)); return shape;
    }
    private TextView text(String value, int size, int color) {
        TextView label = new TextView(this); label.setText(value); label.setTextSize(size); label.setTextColor(color);
        label.setLineSpacing(dp(3), 1); return label;
    }
    private Button action(String title, int icon, int color, int background) {
        Button button = new Button(this);
        button.setText(title); button.setAllCaps(false); button.setTextSize(14);
        button.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        button.setTextColor(color); button.setMinWidth(0); button.setMinimumWidth(0);
        button.setMinHeight(dp(48)); button.setMinimumHeight(dp(48));
        button.setMaxLines(2); button.setPadding(dp(12), dp(10), dp(12), dp(10));
        button.setBackground(new RippleDrawable(ColorStateList.valueOf(Color.argb(45, 36, 139, 204)), rounded(background), null));
        if (icon != 0) {
            Drawable drawable = getDrawable(icon).mutate(); drawable.setTint(color);
            button.setCompoundDrawablesWithIntrinsicBounds(drawable, null, null, null);
            button.setCompoundDrawablePadding(dp(8));
        }
        return button;
    }
    private void toast(String value) { Toast.makeText(this, value, Toast.LENGTH_LONG).show(); }
    private void showError(String text) { loaded = false; errorText.setText(text); error.setVisibility(View.VISIBLE); web.setVisibility(View.GONE); progress.setVisibility(View.GONE); }
    private void back() { if (web.canGoBack()) web.goBack(); else finish(); }
    @Override public void onBackPressed() { back(); }
    @Override protected void onResume() { super.onResume(); if (store != null) { PollJob.configure(this); refreshAlerts(); handler.post(sessionWatch); } }
    @Override protected void onPause() { captureSession(); handler.removeCallbacks(sessionWatch); super.onPause(); }
    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }
    @Override protected void onDestroy() {
        handler.removeCallbacks(sessionWatch);
        store.prefs.unregisterOnSharedPreferenceChangeListener(preferenceChanged);
        if (alertDialog != null) alertDialog.dismiss();
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        web.destroy(); super.onDestroy();
    }
    @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); web.loadUrl(Policy.ORIGIN); }

    private void captureSession() {
        if (web == null || !loaded || !store.enabled() || !Policy.trusted(web.getUrl())) return;
        int generation = navigation;
        web.evaluateJavascript("(function(){try{return JSON.stringify({origin:location.origin,token:localStorage.getItem('auth_token')});}catch(e){return null;}})()", result -> {
            if (generation != navigation || !loaded || !Policy.trusted(web.getUrl()) || !store.enabled()) return;
            try {
                JSONObject data = new JSONObject(new JSONArray("[" + result + "]").getString(0));
                if (!Policy.ORIGIN.equals(data.getString("origin"))) return;
                String previous = store.prefs.getString("account", "");
                store.capture(data.isNull("token") ? null : data.getString("token"));
                if (!previous.equals(store.prefs.getString("account", ""))) getSystemService(NotificationManager.class).cancel(4107);
            } catch (Exception ignored) { /* No session is captured from failed or unexpected script results. */ }
        });
    }

    private boolean notificationsAvailable() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        NotificationChannel channel = manager.getNotificationChannel(PollJob.CHANNEL);
        return manager.areNotificationsEnabled() && (channel == null || channel.getImportance() != NotificationManager.IMPORTANCE_NONE);
    }

    private void refreshAlerts() {
        if (alerts == null) return;
        boolean enabled = store.enabled(), available = notificationsAvailable();
        String state = !enabled ? "off" : available ? "on" : "paused";
        alerts.setText("Alerts " + state);
        alerts.setContentDescription("Notification settings, alerts " + state);
        alerts.setTooltipText(enabled && !available ? "Notifications are blocked in Android settings" : "Manage QMT notifications");
        alerts.setBackground(new RippleDrawable(ColorStateList.valueOf(Color.argb(45, 245, 245, 245)),
            rounded(enabled && available ? accent : Color.TRANSPARENT), null));
        if (alertToggle != null) alertToggle.setChecked(enabled);
        if (alertStatus != null) {
            String heading = !enabled ? "Alerts are off" : available ? "Alerts are enabled" : "Paused in Android";
            String permission = enabled && !available ? "\nAllow QMT notifications in Android settings to receive alerts." : "";
            alertStatus.setText(heading + permission + "\n\n" +
                store.prefs.getString("status", enabled ? "Waiting for a fresh baseline." : "No background session is stored."));
        }
    }

    private void setAlertsEnabled(boolean enabled, String status) {
        synchronized (SessionStore.LOCK) {
            store.prefs.edit().putBoolean("enabled", enabled).commit();
            store.clear(status);
        }
        getSystemService(NotificationManager.class).cancel(4107);
        if (enabled && Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 301);
        captureSession(); PollJob.configure(this); refreshAlerts();
    }

    private void settings() {
        if (alertDialog != null) return;
        LinearLayout layout = new LinearLayout(this); layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(dp(20), dp(20), dp(20), dp(12));
        TextView title = text("Notifications", 22, navy); title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        layout.addView(title);
        TextView detail = text("Stay up to date with schedule changes and new pending admin/management requests.", 14, charcoal);
        detail.setPadding(0, dp(8), 0, dp(12)); layout.addView(detail);
        alertToggle = new Switch(this); alertToggle.setText("Enable alerts"); alertToggle.setTextSize(16);
        alertToggle.setTextColor(navy); alertToggle.setMinHeight(dp(56)); alertToggle.setMaxLines(2);
        alertToggle.setThumbTintList(new ColorStateList(new int[][]{new int[]{android.R.attr.state_checked}, new int[]{}},
            new int[]{accent, charcoal}));
        alertToggle.setTrackTintList(new ColorStateList(new int[][]{new int[]{android.R.attr.state_checked}, new int[]{}},
            new int[]{Color.argb(90, 36, 139, 204), Color.argb(45, 62, 67, 71)}));
        alertToggle.setChecked(store.enabled()); layout.addView(alertToggle);
        alertToggle.setOnCheckedChangeListener((button, checked) -> {
            if (checked != store.enabled())
                setAlertsEnabled(checked, checked ? "Waiting for a fresh baseline." : "Alerts off; background session erased.");
        });
        alertStatus = text("", 14, navy); alertStatus.setPadding(dp(14), dp(14), dp(14), dp(14));
        alertStatus.setBackground(rounded(Color.WHITE));
        LinearLayout.LayoutParams statusLayout = new LinearLayout.LayoutParams(-1, -2); statusLayout.topMargin = dp(8);
        layout.addView(alertStatus, statusLayout);
        TextView cadence = text("Checks cover the next two weeks and run approximately every 15 minutes. They are not instant push notifications; Android battery limits may delay them.", 13, charcoal);
        cadence.setPadding(0, dp(12), 0, dp(12)); layout.addView(cadence);
        Button system = action("Android notification settings", 0, navy, Color.WHITE);
        system.setOnClickListener(v -> {
            try { startActivity(new Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, getPackageName())); }
            catch (ActivityNotFoundException e) { toast("Android notification settings are unavailable on this device."); }
        });
        layout.addView(system, new LinearLayout.LayoutParams(-1, -2));
        Button clear = action("Forget background session", 0, charcoal, Color.TRANSPARENT);
        clear.setOnClickListener(v -> setAlertsEnabled(false, "Background session forgotten; web sign-in unchanged."));
        layout.addView(clear, new LinearLayout.LayoutParams(-1, -2));
        TextView privacy = text("Turning alerts off or forgetting the saved background session leaves your web sign-in unchanged.", 12, charcoal);
        layout.addView(privacy);
        ScrollView scroll = new ScrollView(this); scroll.setFillViewport(false); scroll.addView(layout);
        alertDialog = new AlertDialog.Builder(this).setView(scroll).setPositiveButton("Done", null).create();
        alertDialog.setOnDismissListener(dialog -> { alertDialog = null; alertToggle = null; alertStatus = null; });
        alertDialog.show();
        alertDialog.getWindow().setBackgroundDrawable(rounded(surface));
        alertDialog.getWindow().setLayout(Math.min(getResources().getDisplayMetrics().widthPixels - dp(32), dp(480)), -2);
        alertDialog.getButton(AlertDialog.BUTTON_POSITIVE).setTextColor(accent);
        alertDialog.getButton(AlertDialog.BUTTON_POSITIVE).setAllCaps(false);
        refreshAlerts();
    }

    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code == 301) {
            if (results.length == 0 || results[0] != PackageManager.PERMISSION_GRANTED) {
                store.prefs.edit().putBoolean("enabled", false).commit(); store.clear("Notification permission declined; alerts are off.");
            }
            captureSession(); PollJob.configure(this); refreshAlerts();
        }
    }

    private void external(Uri uri) {
        String scheme = uri.getScheme();
        if (!("https".equals(scheme) || "mailto".equals(scheme) || "tel".equals(scheme) || "sms".equals(scheme) || "whatsapp".equals(scheme))) {
            toast("Unsupported or insecure link blocked."); return;
        }
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)); }
        catch (ActivityNotFoundException e) { toast("No app can open this link. Install or configure a suitable app."); }
    }

    private void download(String url, String mime, String disposition) {
        if (!loaded || !Policy.trusted(web.getUrl())) { toast("Download blocked outside QMT."); return; }
        if (url.startsWith("blob:" + Policy.ORIGIN + "/")) {
            int generation = navigation;
            // evaluateJavascript does not await Promises; collect this bounded export without a native bridge.
            web.evaluateJavascript("(function(){window.__qmtExport=null;fetch(" + JSONObject.quote(url)
                + ").then(r=>r.blob()).then(b=>{if(b.size>8388608){window.__qmtExport='error';return;}const f=new FileReader();f.onload=()=>window.__qmtExport=f.result;f.onerror=()=>window.__qmtExport='error';f.readAsDataURL(b);}).catch(()=>window.__qmtExport='error');})()", ignored -> pollExport(generation, mime, disposition, 0));
        } else if (Policy.trusted(url)) { exportUrl = url; export = null; savePicker(mime, disposition, url); }
        else { external(Uri.parse(url)); }
    }

    private void pollExport(int generation, String mime, String disposition, int attempt) {
        if (generation != navigation || !loaded || !Policy.trusted(web.getUrl())) return;
        if (attempt >= 40) { toast("Export timed out. Please retry."); return; }
        handler.postDelayed(() -> web.evaluateJavascript("window.__qmtExport", value -> {
            if (generation != navigation || !Policy.trusted(web.getUrl())) return;
            try {
                String data = new JSONArray("[" + value + "]").optString(0, "");
                if (data.isEmpty() || data.equals("null")) { pollExport(generation, mime, disposition, attempt + 1); return; }
                if (!data.startsWith("data:") || !data.contains(";base64,")) { toast("Export unavailable or exceeds 8 MB."); return; }
                export = android.util.Base64.decode(data.substring(data.indexOf(',') + 1), android.util.Base64.DEFAULT);
                if (export.length > 8 * 1024 * 1024) { export = null; toast("Export exceeds 8 MB."); return; }
                exportUrl = null;
                web.evaluateJavascript("delete window.__qmtExport", ignored -> {});
                savePicker(mime, disposition, "qmt-export");
            } catch (Exception e) { toast("Unable to prepare export."); }
        }), 250);
    }

    private void savePicker(String mime, String disposition, String url) {
        Intent save = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
            .setType(mime == null || mime.isEmpty() ? "application/octet-stream" : mime)
            .putExtra(Intent.EXTRA_TITLE, URLUtil.guessFileName(url, disposition, mime));
        try { startActivityForResult(save, 202); } catch (ActivityNotFoundException e) { toast("No document saver available."); export = null; exportUrl = null; }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == 201 && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data)); fileCallback = null;
        }
        if (request != 202) return;
        byte[] bytes = export; String url = exportUrl; export = null; exportUrl = null;
        if (result != RESULT_OK || data == null || data.getData() == null) return;
        Uri destination = data.getData();
        String token = store.token();
        new Thread(() -> {
            HttpsURLConnection connection = null;
            try (OutputStream output = getContentResolver().openOutputStream(destination, "wt")) {
                if (output == null) throw new IOException();
                if (bytes != null) output.write(bytes);
                else {
                    if (!Policy.trusted(url)) throw new IOException();
                    connection = (HttpsURLConnection) new URL(url).openConnection();
                    connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(10000); connection.setReadTimeout(15000);
                    if (token != null) connection.setRequestProperty("Authorization", "Bearer " + token);
                    if (connection.getResponseCode() != 200) throw new IOException();
                    try (InputStream input = connection.getInputStream()) {
                        byte[] buffer = new byte[8192]; int count; int total = 0;
                        while ((count = input.read(buffer)) != -1) { total += count; if (total > 8 * 1024 * 1024) throw new IOException(); output.write(buffer, 0, count); }
                    }
                }
                runOnUiThread(() -> toast("Export saved."));
            } catch (Exception e) { runOnUiThread(() -> toast("Export failed; remove any incomplete file and retry.")); }
            finally { if (connection != null) connection.disconnect(); }
        }, "qmt-document-save").start();
    }
}
