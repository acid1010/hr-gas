function getLocalDayRange(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

function normalizeDevicePunchType(value) {
  if (value === null || value === undefined || value === "") return null;
  const type = Number(value);
  return type === 0 || type === 1 ? type : null;
}

function minutesFromLocalTime(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function minutesFromShiftTime(date) {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

function getShiftMidpoint(startTime, endTime) {
  const start = minutesFromShiftTime(startTime);
  let end = minutesFromShiftTime(endTime);
  if (end <= start) end += 24 * 60;
  return start + (end - start) / 2;
}

function classifyByShift(punchTime, shift) {
  const start = minutesFromShiftTime(shift.start_time);
  const midpoint = getShiftMidpoint(shift.start_time, shift.end_time);
  let punch = minutesFromLocalTime(punchTime);
  if (midpoint >= 24 * 60 && punch < start) punch += 24 * 60;

  return punch < midpoint ? 0 : 1;
}

function classifyByFallback(punchTime, firstPunch) {
  const duplicateWindowMs = 2 * 60 * 60 * 1000;
  if (firstPunch && punchTime - firstPunch.punch_time <= duplicateWindowMs) {
    return firstPunch.punch_type ?? 0;
  }

  return minutesFromLocalTime(punchTime) < 12 * 60 ? 0 : 1;
}

async function classifyPunchType(prisma, deviceUid, punchTime, devicePunchType = null) {
  const normalizedDevicePunchType = normalizeDevicePunchType(devicePunchType);
  if (normalizedDevicePunchType !== null) return normalizedDevicePunchType;

  const { start } = getLocalDayRange(punchTime);

  const [user, firstPunch] = await Promise.all([
    prisma.users.findFirst({
      where: { nik: parseFloat(deviceUid), deletedAt: null },
      select: { shift: { select: { start_time: true, end_time: true } } },
    }),
    prisma.attendance.findFirst({
      where: {
        device_uid: deviceUid,
        punch_time: { gte: start, lt: punchTime },
      },
      orderBy: { punch_time: "asc" },
      select: { punch_time: true, punch_type: true },
    }),
  ]);

  if (user?.shift) return classifyByShift(punchTime, user.shift);

  return classifyByFallback(punchTime, firstPunch);
}

/**
 * Build the pre-fetch maps needed by classifyPunchTypeFromMaps.
 * Two queries total regardless of how many logs are processed.
 */
async function buildPunchTypeMaps(prisma, deviceUids, logs) {
  const minTime = logs.reduce((m, l) => { const t = new Date(l.recordTime); return t < m ? t : m; }, new Date());
  const rangeStart = new Date(minTime); rangeStart.setHours(0, 0, 0, 0);

  const [users, existing] = await Promise.all([
    prisma.users.findMany({
      where: { nik: { in: deviceUids.map(parseFloat) }, deletedAt: null },
      select: { nik: true, shift: { select: { start_time: true, end_time: true } } },
    }),
    prisma.attendance.findMany({
      where: { device_uid: { in: deviceUids }, punch_time: { gte: rangeStart } },
      select: { device_uid: true, punch_time: true, punch_type: true },
      orderBy: { punch_time: "asc" },
    }),
  ]);

  const shiftMap = {}; // deviceUid -> shift | null
  for (const u of users) shiftMap[String(u.nik)] = u.shift || null;

  // existing punches grouped by `${uid}-${YYYY-MM-DD}`
  const existingMap = {};
  for (const r of existing) {
    const key = `${r.device_uid}-${r.punch_time.toISOString().slice(0, 10)}`;
    if (!existingMap[key]) existingMap[key] = [];
    existingMap[key].push({ punch_time: r.punch_time, punch_type: r.punch_type });
  }

  return { shiftMap, existingMap };
}

/**
 * Zero-DB classify — uses pre-fetched maps + the in-progress punches seen so far this sync.
 * Callers must maintain `inProgressMap` (same shape as existingMap) and push each result in after calling.
 */
function classifyPunchTypeFromMaps(deviceUid, punchTime, shiftMap, existingMap, inProgressMap) {
  const shift = shiftMap[deviceUid];
  if (shift) return classifyByShift(punchTime, shift);

  const day = punchTime.toISOString().slice(0, 10);
  const key = `${deviceUid}-${day}`;
  const prior = [...(existingMap[key] || []), ...(inProgressMap[key] || [])]
    .filter((p) => p.punch_time < punchTime)
    .sort((a, b) => a.punch_time - b.punch_time);

  return classifyByFallback(punchTime, prior[0] || null);
}

module.exports = {
  classifyByFallback,
  classifyByShift,
  classifyPunchType,
  buildPunchTypeMaps,
  classifyPunchTypeFromMaps,
  getLocalDayRange,
  normalizeDevicePunchType,
};
