package com.errandom.qmt;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;

public final class PollJob extends JobService {
    static final int ID = 4107;
    static final String CHANNEL = "qmt_updates";
    private Thread worker;

    static void configure(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel(CHANNEL, "QMT updates", NotificationManager.IMPORTANCE_DEFAULT));
        JobScheduler scheduler = c.getSystemService(JobScheduler.class);
        SessionStore store = new SessionStore(c);
        if (!store.allowed(c)) { scheduler.cancel(ID); return; }
        if (scheduler.getPendingJob(ID) == null)
            scheduler.schedule(new JobInfo.Builder(ID, new ComponentName(c, PollJob.class))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPersisted(true)
                .setPeriodic(15 * 60 * 1000L).build());
    }

    @Override public boolean onStartJob(JobParameters params) {
        if (!new SessionStore(this).allowed(this)) { configure(this); return false; }
        worker = new Thread(() -> {
            boolean retry = !new Poller(this).run();
            if (!Thread.currentThread().isInterrupted()) jobFinished(params, retry);
        }, "qmt-read-only-check");
        worker.start();
        return true;
    }

    @Override public boolean onStopJob(JobParameters params) {
        if (worker != null) worker.interrupt();
        return new SessionStore(this).allowed(this);
    }
}
