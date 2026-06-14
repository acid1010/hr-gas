// Combined-score formula shared by /performance leaderboard and /attendance excel export.
// Spec: combined_score = round((attendance_rate * 0.6 + performance_rating * 0.4) * 100)
// where attendance_rate and performance_rating are both 0..1 ratios.
//
// Two convenience entry points so each caller passes whatever shape it already has:
//   - computeCombinedScore(attendanceRate, perfRating)         // both in 0..1
//   - computeCombinedScoreFromPct(attendancePct, perfRatingPct) // both in 0..100
// Both return an integer 0..100.

const ATTENDANCE_WEIGHT = 0.6;
const PERFORMANCE_WEIGHT = 0.4;

// Performance status -> 0..1 rating mapping (canonical).
// Both percentage form (* 100) and ratio form are derived from this.
const PERFORMANCE_RATING_MAP = Object.freeze({
  best: 1.0,
  good: 0.75,
  average: 0.5,
  worst: 0.25,
});

const PERFORMANCE_RATING_PCT_MAP = Object.freeze({
  best: 100,
  good: 75,
  average: 50,
  worst: 25,
});

function computeCombinedScore(attendanceRate, perfRating) {
  const a = Number.isFinite(attendanceRate) ? attendanceRate : 0;
  const p = Number.isFinite(perfRating) ? perfRating : 0;
  return Math.round((a * ATTENDANCE_WEIGHT + p * PERFORMANCE_WEIGHT) * 100);
}

function computeCombinedScoreFromPct(attendancePct, perfRatingPct) {
  const a = Number.isFinite(attendancePct) ? attendancePct / 100 : 0;
  const p = Number.isFinite(perfRatingPct) ? perfRatingPct / 100 : 0;
  return computeCombinedScore(a, p);
}

// Look up performance rating (0..1) by status string. Case-insensitive. Unknown -> 0.
function ratingForStatus(status) {
  if (!status) return 0;
  return PERFORMANCE_RATING_MAP[String(status).toLowerCase()] ?? 0;
}

function ratingPctForStatus(status) {
  if (!status) return 0;
  return PERFORMANCE_RATING_PCT_MAP[String(status).toLowerCase()] ?? 0;
}

module.exports = {
  ATTENDANCE_WEIGHT,
  PERFORMANCE_WEIGHT,
  PERFORMANCE_RATING_MAP,
  PERFORMANCE_RATING_PCT_MAP,
  computeCombinedScore,
  computeCombinedScoreFromPct,
  ratingForStatus,
  ratingPctForStatus,
};
