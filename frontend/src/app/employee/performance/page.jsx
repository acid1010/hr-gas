"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";
import Drawer from "@/app/components/Drawer";
import PerformanceForm from "@/app/components/forms/PerformanceForm";
import { Plus, Users, Award, TrendingUp } from "lucide-react";
import { useAppSettings } from "@/lib/useAppSettings";
import { toast } from "@/lib/toast";

function TabSkeleton() {
  return (
    <div
      className="rounded-2xl animate-pulse"
      style={{ background: "rgba(128,128,128,0.07)", border: "1px solid rgba(128,128,128,0.1)", height: 320 }}
    />
  );
}

const LeaderboardTab = dynamic(() => import("./_LeaderboardTab"), { loading: () => <TabSkeleton /> });
const RecordsTab     = dynamic(() => import("./_RecordsTab"),     { loading: () => <TabSkeleton /> });

export default function Performance() {
  const { t, p } = useAppSettings();
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [month,          setMonth]          = useState(defaultMonth);
  const [leaderboard,    setLeaderboard]    = useState([]);
  const [perfRecords,    setPerfRecords]    = useState([]);
  const [drawerOpen,     setDrawerOpen]     = useState(false);
  const [sortKey,        setSortKey]        = useState("combined_score");
  const [sortDir,        setSortDir]        = useState(-1);
  const [tab,            setTab]            = useState("leaderboard");
  const [statusFilter,   setStatusFilter]   = useState("");
  const [perfNameFilter, setPerfNameFilter] = useState("");
  const [loadingLb,      setLoadingLb]      = useState(true);

  const pillRef        = useRef(null);
  const tabRefs        = useRef({});
  const perfFetchedRef = useRef(false);

  const tabs = [
    { key: "leaderboard", label: t("performance.leaderboard"), Icon: Award },
    { key: "records",     label: t("performance.records"),     Icon: TrendingUp },
  ];

  useEffect(() => {
    const activeEl = tabRefs.current[tab];
    if (activeEl && pillRef.current) {
      pillRef.current.style.left  = activeEl.offsetLeft + "px";
      pillRef.current.style.width = activeEl.offsetWidth + "px";
    }
  }, [tab]);

  const loadLeaderboard = useCallback(async () => {
    setLoadingLb(true);
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/api/performance/leaderboard?month=${month}`);
      setLeaderboard(res.data || []);
    } catch (err) { console.error(err); }
    finally { setLoadingLb(false); }
  }, [month]);

  const loadPerf = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/api/performance`);
      setPerfRecords(res.data || []);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { loadLeaderboard(); }, [loadLeaderboard]);

  // Fetch perf records only on first visit to Records tab
  useEffect(() => {
    if (tab === "records" && !perfFetchedRef.current) {
      perfFetchedRef.current = true;
      loadPerf();
    }
  }, [tab, loadPerf]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    try {
      await fetchWithAuth(`${apiBaseUrl}/api/performance/post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      toast(t("performance.saveRecord") + " — OK");
      e.target.reset();
      setDrawerOpen(false);
      loadLeaderboard();
      if (perfFetchedRef.current) loadPerf();
    } catch (err) { toast(err.message, "error"); }
  };

  const handleDelete = async (id) => {
    try {
      await fetchWithAuth(`${apiBaseUrl}/api/performance/delete/${id}`, { method: "DELETE" });
      toast(t("common.delete") + " — OK");
      loadLeaderboard();
      if (perfFetchedRef.current) loadPerf();
    } catch (err) { toast(err.message, "error"); }
  };

  const sort = (key) => {
    if (sortKey === key) setSortDir(d => -d);
    else { setSortKey(key); setSortDir(-1); }
  };

  const sorted = useMemo(
    () => [...leaderboard].sort((a, b) => sortDir * (b[sortKey] - a[sortKey])),
    [leaderboard, sortKey, sortDir]
  );

  const filteredPerf = useMemo(
    () => perfRecords.filter(r => {
      if (statusFilter && (r.status || "").toLowerCase() !== statusFilter) return false;
      if (perfNameFilter.trim()) {
        const q = perfNameFilter.toLowerCase();
        return (r.users?.name || "").toLowerCase().includes(q) || String(r.users?.nik || "").includes(q);
      }
      return true;
    }),
    [perfRecords, statusFilter, perfNameFilter]
  );

  return (
    <main className="overflow-x-hidden w-full max-w-full">
      <div className="p-8 min-h-screen transition-colors duration-300" style={{ background: p.pageBg }}>

        {/* HEADER */}
        <div className="fade-up mb-8 flex items-end justify-between gap-6 flex-wrap">
          <div className="flex items-end gap-4 flex-wrap">
            <div>
              <p className="text-[10px] font-black tracking-[0.25em] uppercase mb-1.5" style={{ color: p.primary }}>{t("performance.subtitle")}</p>
              <h1 className="text-[2rem] font-black tracking-tight leading-none" style={{ color: p.text }}>{t("performance.title")}</h1>
            </div>
            {leaderboard.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold mb-0.5" style={{ background: `${p.primary}14`, color: p.primary }}>
                <Users size={12} /> {leaderboard.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: p.inputBg, border: `1px solid ${p.border2}`, color: p.text, colorScheme: "dark" }}
              onFocus={e => { e.target.style.borderColor = "#5b8df8"; e.target.style.boxShadow = "0 0 0 3px rgba(91,141,248,0.1)"; }}
              onBlur={e =>  { e.target.style.borderColor = p.border2;  e.target.style.boxShadow = "none"; }}
            />
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black text-white transition-all duration-150 hover:opacity-90 active:scale-[0.97]"
              style={{ background: "#3b6fd4" }}
            >
              <Plus size={15} /> {t("performance.addRecord")}
            </button>
          </div>
        </div>

        {/* KPI STRIP */}
        {loadingLb ? (
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl animate-pulse" style={{ background: p.cardBg, border: `1px solid ${p.border}`, height: 82 }} />
            ))}
          </div>
        ) : leaderboard.length > 0 && (
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { key: "best",    label: "Best",    color: "#22c55e", bg: "rgba(34,197,94,0.08)",   border: "rgba(34,197,94,0.18)"   },
              { key: "good",    label: "Good",    color: "#5b8df8", bg: "rgba(91,141,248,0.08)",  border: "rgba(91,141,248,0.18)"  },
              { key: "average", label: "Average", color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.18)"  },
              { key: "worst",   label: "Worst",   color: "#ef4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.18)"   },
            ].map(({ key, label, color, bg, border }, i) => {
              const count = leaderboard.filter(e => (e.performance_status || "").toLowerCase() === key).length;
              const pct   = leaderboard.length ? Math.round((count / leaderboard.length) * 100) : 0;
              return (
                <div
                  key={key}
                  className="fade-up rounded-2xl px-5 py-4 flex items-center justify-between transition-colors duration-300"
                  style={{ background: p.cardBg, border: `1px solid ${p.border}`, animationDelay: `${i * 0.06}s` }}
                >
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                      <span className="text-[10px] font-black tracking-[0.16em] uppercase" style={{ color }}>{label}</span>
                    </div>
                    <span className="text-2xl font-black" style={{ color }}>{count}</span>
                    <span className="text-xs font-bold ml-1.5" style={{ color: p.faint }}>{pct}%</span>
                  </div>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: bg, border: `1px solid ${border}` }}>
                    <span className="text-xs font-black" style={{ color }}>{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB SWITCHER */}
        <div
          className="fade-up flex gap-0.5 mb-5 p-1 rounded-xl w-fit relative"
          style={{ background: p.cardBg, border: `1px solid ${p.border}`, animationDelay: "0.1s" }}
        >
          <div
            ref={pillRef}
            className="absolute top-1 bottom-1 rounded-lg transition-all duration-200 pointer-events-none"
            style={{ background: "#1e2d52", left: 0, width: 0 }}
          />
          {tabs.map(({ key, label, Icon }) => (
            <button
              key={key}
              ref={el => { tabRefs.current[key] = el; }}
              onClick={() => { setTab(key); setPerfNameFilter(""); setStatusFilter(""); }}
              className="relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold z-10 transition-colors duration-150"
              style={{ color: tab === key ? "#5b8df8" : p.muted }}
            >
              <Icon size={14} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* TAB CONTENT */}
        {tab === "leaderboard" && (
          <LeaderboardTab key="leaderboard" sorted={sorted} month={month} p={p} t={t} sortKey={sortKey} sortDir={sortDir} onSort={sort} />
        )}
        {tab === "records" && (
          <RecordsTab key="records" perfRecords={perfRecords} filteredPerf={filteredPerf} statusFilter={statusFilter} setStatusFilter={setStatusFilter} perfNameFilter={perfNameFilter} setPerfNameFilter={setPerfNameFilter} handleDelete={handleDelete} p={p} t={t} />
        )}
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={t("performance.addTitle")} subtitle="Record quarterly performance rating" accentColor="#5b8df8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <PerformanceForm />
          <button
            type="submit"
            className="w-full py-3 rounded-xl text-sm font-black text-white mt-2 transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
            style={{ background: "#3b6fd4" }}
          >
            {t("performance.saveRecord")}
          </button>
        </form>
      </Drawer>
    </main>
  );
}
