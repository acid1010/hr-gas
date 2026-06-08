// Mon–Fri working, Sat+Sun off, minus holidays.
// holidaySet: Set of 'YYYY-MM-DD' strings.

function ymd(date) {
  return date.toISOString().slice(0, 10);
}

function isWorkingDay(date, holidaySet) {
  const day = date.getDay();
  if (day === 0 || day === 6) return false; // Sun, Sat
  if (holidaySet && holidaySet.has(ymd(date))) return false;
  return true;
}

// 'workday' | 'rest_day' | 'holiday' — holiday takes precedence
function classifyDay(date, holidaySet) {
  if (holidaySet && holidaySet.has(ymd(date))) return "holiday";
  const day = date.getDay();
  if (day === 0 || day === 6) return "rest_day";
  return "workday";
}

// [start, end) — end exclusive
function countWorkingDays(start, end, holidaySet) {
  let count = 0;
  const cur = new Date(start);
  while (cur < end) {
    if (isWorkingDay(cur, holidaySet)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

async function getHolidaySet(prisma, start, end) {
  const rows = await prisma.holiday.findMany({
    where: { date: { gte: start, lt: end } },
    select: { date: true },
  });
  return new Set(rows.map((r) => r.date.toISOString().slice(0, 10)));
}

module.exports = { isWorkingDay, countWorkingDays, getHolidaySet, classifyDay };
