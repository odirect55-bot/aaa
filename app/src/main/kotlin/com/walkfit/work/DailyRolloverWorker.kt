package com.walkfit.work

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.walkfit.WalkFitApplication

/**
 * Runs just after midnight: closes yesterday's record and opens today's with a
 * fresh baseline.
 *
 * The rollover is *also* handled the moment the next sensor reading arrives, so
 * this worker is belt-and-braces — it exists so that history is right even on a
 * day where the user takes no steps at all.
 */
class DailyRolloverWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val container = (applicationContext as WalkFitApplication).container
        return runCatching {
            container.stepRepository.rolloverIfNeeded()
            Result.success()
        }.getOrElse { error ->
            Log.e(TAG, "Daily rollover failed", error)
            Result.retry()
        }
    }

    private companion object {
        const val TAG = "DailyRolloverWorker"
    }
}
