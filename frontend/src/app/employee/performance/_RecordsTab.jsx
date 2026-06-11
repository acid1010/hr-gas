"use client";
import { Search, TrendingUp } from "lucide-react";
import { PerfBadge, DeleteButton, deptColor, getDrivePreview } from "./_shared";

export default function RecordsTab({ perfRecords, filteredPerf, statusFilter, setStatusFilter, perfNameFilter, setPerfNameFilter, handleDelete, p, t }) {
  return (
    <div className="fade-up">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {[
          { key: "", label: "All" },
          { key: "best",    label: "Best",    color: "#22c55e", bg: "rgba(34,197,94,0.12)"  },
          { key: "good",    label: "Good",    color: "#5b8df8", bg: "rgba(91,141,248,0.12)" },
          { key: "average", label: "Average", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
          { key: "worst",   label: "Worst",   color: "#ef4444", bg: "rgba(239,68,68,0.12)"  },
        ].map(opt => {
          const active = statusFilter === opt.key;
          const count = opt.key
            ? perfRecords.filter(r => (r.status || "").toLowerCase() === opt.key).length
            : perfRecords.length;
          return (
            <button
              key={opt.key}
              onClick={() => setStatusFilter(opt.key)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
              style={{
                background: active ? (opt.bg || p.inputBg) : p.inputBg,
                color:      active ? (opt.color || p.text) : p.muted,
                border:     `1px solid ${active ? (opt.color || p.border) + "55" : p.border}`,
                boxShadow:  active && opt.color ? `0 0 0 2px ${opt.color}22` : "none",
              }}
            >
              {opt.key && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: opt.color }} />}
              {opt.label}
              <span className="ml-0.5 tabular-nums text-[10px] opacity-70">{count}</span>
            </button>
          );
        })}
        <div className="relative ml-auto">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: p.faint }} />
          <input
            type="text"
            placeholder="Search name / NIK…"
            value={perfNameFilter}
            onChange={e => setPerfNameFilter(e.target.value)}
            className="pl-8 pr-4 py-1.5 rounded-xl text-xs outline-none transition-all w-44"
            style={{ background: p.inputBg, border: `1px solid ${p.border2}`, color: p.text }}
            onFocus={e => { e.target.style.borderColor = "#5b8df8"; e.target.style.boxShadow = "0 0 0 3px rgba(91,141,248,0.1)"; }}
            onBlur={e =>  { e.target.style.borderColor = p.border2; e.target.style.boxShadow = "none"; }}
          />
        </div>
        {(statusFilter || perfNameFilter) && (
          <span className="text-xs" style={{ color: p.faint }}>{filteredPerf.length} / {perfRecords.length}</span>
        )}
      </div>

      <div className="rounded-2xl overflow-hidden transition-colors duration-300" style={{ background: p.cardBg, border: `1px solid ${p.border}` }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: `1px solid ${p.border}` }}>
              {[
                t("performance.columns.quarter"),
                t("performance.columns.nik"),
                t("performance.columns.employee"),
                t("performance.columns.status"),
                t("performance.columns.description"),
                t("performance.columns.action"),
              ].map(h => (
                <th key={h} className="px-5 py-3.5 text-left text-[10px] font-black tracking-[0.18em] uppercase" style={{ color: p.faint }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredPerf.length > 0 ? filteredPerf.map((item, i) => (
              <tr
                key={item.id}
                className="group fade-up transition-colors duration-150"
                style={{ borderBottom: `1px solid ${p.border}`, background: i % 2 === 0 ? p.cardBg : p.rowAlt, animationDelay: `${i * 0.032}s` }}
                onMouseEnter={e => { e.currentTarget.style.background = p.rowHover; }}
                onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? p.cardBg : p.rowAlt; }}
              >
                <td className="px-5 py-4"><span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg" style={{ background: "rgba(91,141,248,0.1)", color: "#5b8df8" }}>Q{item.quarter}</span></td>
                <td className="px-5 py-4"><span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg" style={{ background: "rgba(91,141,248,0.1)", color: "#5b8df8" }}>{item.users?.nik}</span></td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2.5">
                    <div className="relative w-7 h-7 rounded-full overflow-hidden shrink-0" style={{ background: deptColor(item.users?.departement) }}>
                      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-white">{(item.users?.name || "?")[0].toUpperCase()}</div>
                      {item.users?.link_image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={getDrivePreview(item.users.link_image)} alt={item.users.name} className="absolute inset-0 w-full h-full object-cover" />
                      )}
                    </div>
                    <span className="font-semibold" style={{ color: p.text }}>{item.users?.name}</span>
                  </div>
                </td>
                <td className="px-5 py-4"><PerfBadge value={item.status} /></td>
                <td className="px-5 py-4 text-sm max-w-xs truncate" style={{ color: p.muted }}>{item.description || "—"}</td>
                <td className="px-5 py-4">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <DeleteButton label={t("common.delete")} confirmLabel={t("common.confirm")} onConfirm={() => handleDelete(item.id)} />
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: p.inputBg }}>
                      <TrendingUp size={22} style={{ color: p.faint }} />
                    </div>
                    <p className="text-sm font-semibold" style={{ color: p.faint }}>{t("performance.noRecords")}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
