const ZKLib = require("node-zklib");
const prisma = require("../../libs/prisma");
const {
  buildPunchTypeMaps,
  classifyPunchTypeFromMaps,
  normalizeDevicePunchType,
} = require("./attendancePunchType");

const DEVICE_IP = process.env.ZK_IP || "192.128.69.33";
const DEVICE_PORT = parseInt(process.env.ZK_PORT || "4370");
const DEVICE_TIMEOUT = 10000;
const DEVICE_INPORT = 4000;

async function syncAttendanceFromDevice({ since = null } = {}) {
  let zk = null;

  try {
    zk = new ZKLib(DEVICE_IP, DEVICE_PORT, DEVICE_TIMEOUT, DEVICE_INPORT);
    await zk.createSocket();

    const { data: logs } = await zk.getAttendances();

    if (!logs || logs.length === 0) {
      return { message: "No records on device", synced: 0, skipped: 0, total: 0, latestPunch: null };
    }

    const deviceUserIds = [...new Set(logs.map((l) => String(l.deviceUserId)))];
    const sortedLogs = [...logs].sort((a, b) => new Date(a.recordTime) - new Date(b.recordTime));

    const [dbUsers, { shiftMap, existingMap }] = await Promise.all([
      prisma.users.findMany({
        where: { nik: { in: deviceUserIds.map(parseFloat) } },
        select: { id: true, nik: true },
      }),
      buildPunchTypeMaps(prisma, deviceUserIds, sortedLogs),
    ]);

    const nikToUserId = {};
    for (const u of dbUsers) nikToUserId[String(u.nik)] = u.id;

    let synced = 0;
    let skipped = 0;
    let latestPunch = null;
    const inProgressMap = {};

    for (const log of sortedLogs) {
      const deviceUid = String(log.deviceUserId);
      const punchTime = new Date(log.recordTime);
      const userId = nikToUserId[deviceUid] || null;

      const deviceType = normalizeDevicePunchType(log.type);
      const punchType = deviceType !== null
        ? deviceType
        : classifyPunchTypeFromMaps(deviceUid, punchTime, shiftMap, existingMap, inProgressMap);

      const day = punchTime.toISOString().slice(0, 10);
      const key = `${deviceUid}-${day}`;
      if (!inProgressMap[key]) inProgressMap[key] = [];
      inProgressMap[key].push({ punch_time: punchTime, punch_type: punchType });

      try {
        await prisma.attendance.upsert({
          where: { device_uid_punch_time: { device_uid: deviceUid, punch_time: punchTime } },
          create: { device_uid: deviceUid, punch_time: punchTime, punch_type: punchType, user_id: userId },
          update: { punch_type: punchType, user_id: userId },
        });
        synced++;

        if (userId && (!since || punchTime >= since) && (!latestPunch || punchTime > latestPunch.punch_time)) {
          latestPunch = { user_id: userId, punch_time: punchTime, punch_type: punchType };
        }
      } catch {
        skipped++;
      }
    }

    return { message: "Sync complete", synced, skipped, total: logs.length, latestPunch };
  } finally {
    if (zk) { try { await zk.disconnect(); } catch {} }
  }
}

module.exports = { syncAttendanceFromDevice };
