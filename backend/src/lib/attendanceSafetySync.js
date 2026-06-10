const { syncAttendanceFromDevice } = require("./attendanceSync");
const zkRealtime = require("./zkRealtime");

const DEFAULT_INTERVAL = 5 * 60 * 1000;
const intervalMs = parseInt(process.env.ATTENDANCE_SYNC_INTERVAL_MS || `${DEFAULT_INTERVAL}`);

let intervalId = null;
let initialTimeoutId = null;
let running = false;
let lastSyncSince = new Date(Date.now() - intervalMs);

function startAttendanceSafetySync() {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    console.log("[AttendanceSync] scheduled safety sync disabled");
    return;
  }

  if (intervalId || initialTimeoutId) return;

  const run = async () => {
    if (running) return;

    running = true;
    const since = lastSyncSince;
    const startedAt = new Date();

    try {
      const result = await syncAttendanceFromDevice({ since });
      if (result.latestPunch) zkRealtime.broadcastDisplayPunch(result.latestPunch);
      console.log(`[AttendanceSync] synced=${result.synced} skipped=${result.skipped} total=${result.total}`);
    } catch (error) {
      console.error("[AttendanceSync] safety sync failed:", error.message);
    } finally {
      lastSyncSince = startedAt;
      running = false;
    }
  };

  initialTimeoutId = setTimeout(() => {
    initialTimeoutId = null;
    run();
  }, Math.min(30000, intervalMs));

  intervalId = setInterval(run, intervalMs);
  console.log(`[AttendanceSync] scheduled every ${Math.round(intervalMs / 1000)}s`);
}

module.exports = { startAttendanceSafetySync };
