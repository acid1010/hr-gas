"use client";
import { useState } from "react";
import { Award, ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { PerfBadge, ScoreBar, deptColor, getDrivePreview, RANK_COLORS } from "./_shared";

const PAGE_SIZE = 25;

function SortTh({ k, children, sortKey, sortDir, onSort, p }) {
  const active = sortKey === k;
  const Icon = active ? (sortDir === -1 ? ArrowDown : ArrowUp) : ArrowUpDown;
  return (
    <th
      className="px-5 py-3.5 text-left text-[10px] font-black tracking-[0.18em] uppercase cursor-pointer select-none"
      style={{ color: active ? "#5b8df8" : p.faint }}
      onClick={() => onSort(k)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <Icon size={10} style={{ opacity: active ? 1 : 0.45 }} />
      </span>
    </th>
  );
}

export default function LeaderboardTab({ sorted, month, p, t, sortKey, sortDir, onSort }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(Math.max(0, sorted.length - 3) / PAGE_SIZE);
  const tableRows = sorted.slice(3 + page * PAGE_SIZE, 3 + (page + 1) * PAGE_SIZE);

  // Reset page when sort changes
  const handleSort = (k) => { setPage(0); onSort(k); };

  return (
    <div className="fade-up">
      {/* PODIUM — top 3 */}
      {sorted.length >= 3 && (
        <div className="flex items-end justify-center gap-2 mb-5">
          {[sorted[1], sorted[0], sorted[2]].map((emp, podIdx) => {
            const rank = podIdx === 0 ? 2 : podIdx === 1 ? 1 : 3;
            const color = RANK_COLORS[rank - 1];
            const score = emp?.combined_score ?? 0;
            const avatarSize = rank === 1 ? "w-16 h-16" : "w-11 h-11";
            const podHeight = rank === 1 ? 174 : 136;
            if (!emp) return <div key={podIdx} style={{ flex: 1 }} />;
            return (
              <div
                key={emp.user_id}
                className="flex-1 flex flex-col items-center rounded-2xl px-3 pb-4 pt-5 relative overflow-hidden fade-up"
                style={{
                  background: `linear-gradient(160deg, ${color}12 0%, ${color}06 100%)`,
                  border: `1px solid ${color}${rank === 1 ? "35" : "22"}`,
                  minHeight: podHeight,
                  boxShadow: rank === 1 ? `0 0 40px ${color}20` : undefined,
                  animationDelay: `${podIdx * 0.1 + 0.05}s`,
                }}
              >
                <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${color}14, transparent 70%)` }} />
                <span
                  className="font-black leading-none mb-3 tabular-nums"
                  style={{ color, fontSize: rank === 1 ? "2rem" : "1.4rem", textShadow: rank === 1 ? `0 0 24px ${color}60` : undefined }}
                >
                  #{rank}
                </span>
                <div
                  className={`relative ${avatarSize} rounded-full overflow-hidden mb-2.5 shrink-0`}
                  style={{ background: deptColor(emp.departement), boxShadow: `0 0 0 2.5px ${p.cardBg}, 0 0 0 4px ${color}50` }}
                >
                  <div className="absolute inset-0 flex items-center justify-center font-black text-white" style={{ fontSize: rank === 1 ? "1.4rem" : "1rem" }}>
                    {(emp.name || "?")[0].toUpperCase()}
                  </div>
                  {emp.link_image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={getDrivePreview(emp.link_image)} alt={emp.name} className="absolute inset-0 w-full h-full object-cover" />
                  )}
                </div>
                <p className="font-black text-center leading-tight w-full truncate px-1" style={{ color: rank === 1 ? color : p.text, fontSize: rank === 1 ? "0.85rem" : "0.75rem" }}>{emp.name}</p>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md mt-1 mb-auto" style={{ background: `${deptColor(emp.departement)}18`, color: deptColor(emp.departement) }}>
                  {(emp.departement || "").toUpperCase()}
                </span>
                <div className="mt-3 flex flex-col items-center">
                  <span className="font-black tabular-nums" style={{ color, fontSize: rank === 1 ? "1.6rem" : "1.2rem" }}>{score}</span>
                  <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: `${color}80` }}>score</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl overflow-hidden transition-colors duration-300" style={{ background: p.cardBg, border: `1px solid ${p.border}` }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: `1px solid ${p.border}` }}>
              <th className="px-5 py-3.5 text-left text-[10px] font-black tracking-[0.18em] uppercase" style={{ color: p.faint }}>{t("performance.columns.rank")}</th>
              <th className="px-5 py-3.5 text-left text-[10px] font-black tracking-[0.18em] uppercase" style={{ color: p.faint }}>{t("performance.columns.employee")}</th>
              <th className="px-5 py-3.5 text-left text-[10px] font-black tracking-[0.18em] uppercase" style={{ color: p.faint }}>{t("performance.columns.department")}</th>
              <SortTh k="attendance_rate" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} p={p}>{t("performance.columns.attendance")}</SortTh>
              <th className="px-5 py-3.5 text-left text-[10px] font-black tracking-[0.18em] uppercase" style={{ color: p.faint }}>{t("performance.columns.perfRating")}</th>
              <SortTh k="combined_score" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} p={p}>{t("performance.columns.combinedScore")}</SortTh>
            </tr>
          </thead>
          <tbody>
            {sorted.length > 0 ? tableRows.map((emp, i) => {
              const rank = 3 + page * PAGE_SIZE + i + 1;
              const rankColor = rank <= 3 ? RANK_COLORS[rank - 1] : p.faint;
              const isChamp = rank === 1;
              return (
                <tr
                  key={emp.user_id}
                  className="fade-up relative transition-colors duration-150"
                  style={{
                    borderBottom: `1px solid ${p.border}`,
                    background: isChamp ? "rgba(245,158,11,0.04)" : i % 2 === 0 ? p.cardBg : p.rowAlt,
                    boxShadow: isChamp ? "inset 3px 0 0 #f59e0b" : undefined,
                    animationDelay: `${i * 0.02}s`,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = isChamp ? "rgba(245,158,11,0.08)" : p.rowHover; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isChamp ? "rgba(245,158,11,0.04)" : i % 2 === 0 ? p.cardBg : p.rowAlt; }}
                >
                  <td className="px-5 py-4">
                    {rank <= 3 ? (
                      <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black" style={{ background: `${rankColor}18`, color: rankColor, boxShadow: isChamp ? `0 0 12px ${rankColor}44` : undefined }}>{rank}</span>
                    ) : (
                      <span className="text-sm font-black inline-block w-7 text-center" style={{ color: p.faint }}>#{rank}</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0" style={{ background: deptColor(emp.departement), boxShadow: isChamp ? `0 0 0 2px #f59e0b, 0 0 10px rgba(245,158,11,0.3)` : undefined }}>
                        <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-white">{(emp.name || "?")[0].toUpperCase()}</div>
                        {emp.link_image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={getDrivePreview(emp.link_image)} alt={emp.name} className="absolute inset-0 w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold truncate" style={{ color: isChamp ? "#f59e0b" : p.text }}>{emp.name}</p>
                        <p className="font-mono text-[11px]" style={{ color: p.faint }}>{emp.nik}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {emp.departement ? (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md" style={{ background: `${deptColor(emp.departement)}18`, color: deptColor(emp.departement) }}>{emp.departement.toUpperCase()}</span>
                    ) : <span style={{ color: p.faint }}>—</span>}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-1 min-w-[72px]">
                      <span className="text-sm font-black tabular-nums" style={{ color: emp.attendance_rate >= 80 ? "#22c55e" : emp.attendance_rate >= 60 ? "#f59e0b" : "#ef4444" }}>{emp.attendance_rate}%</span>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: p.border2, minWidth: 64 }}>
                        <div className="h-full rounded-full score-bar-animated" style={{ background: emp.attendance_rate >= 80 ? "#22c55e" : emp.attendance_rate >= 60 ? "#f59e0b" : "#ef4444", width: `${emp.attendance_rate}%`, animationDelay: `${i * 0.02}s` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">{emp.performance_status ? <PerfBadge value={emp.performance_status} /> : <span style={{ color: p.faint }}>—</span>}</td>
                  <td className="px-5 py-4"><ScoreBar score={emp.combined_score} barBg={p.border2} /></td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: p.inputBg }}>
                      <Award size={22} style={{ color: p.faint }} />
                    </div>
                    <p className="text-sm font-semibold" style={{ color: p.faint }}>{t("performance.noData")} {month}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: `1px solid ${p.border}` }}>
            <span className="text-xs font-bold" style={{ color: p.faint }}>
              {3 + page * PAGE_SIZE + 1}–{Math.min(3 + (page + 1) * PAGE_SIZE, sorted.length)} / {sorted.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg transition-all"
                style={{ background: p.inputBg, color: page === 0 ? p.faint : p.text, opacity: page === 0 ? 0.35 : 1 }}
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-black tabular-nums" style={{ color: p.text }}>{page + 1} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="p-1.5 rounded-lg transition-all"
                style={{ background: p.inputBg, color: page === totalPages - 1 ? p.faint : p.text, opacity: page === totalPages - 1 ? 0.35 : 1 }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
