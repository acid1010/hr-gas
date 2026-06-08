"use client";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Clock, CalendarDays } from "lucide-react";
import { useAppSettings } from "@/lib/useAppSettings";
import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";
import Drawer from "@/app/components/Drawer";
import ShiftForm from "./ShiftForm";

const hhmm = (v) => (v ? new Date(v).toISOString().slice(11, 16) : "");

export default function ShiftsPage() {
  const { p } = useAppSettings();
  const [role, setRole] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");

  const isAdmin = role === "admin";

  const loadShifts = useCallback(async () => {
    try { const r = await fetchWithAuth(`${apiBaseUrl}/api/shifts`); setShifts(r.data || []); }
    catch { setShifts([]); }
  }, []);
  const loadHolidays = useCallback(async () => {
    try { const r = await fetchWithAuth(`${apiBaseUrl}/api/holidays?year=${year}`); setHolidays(r.data || []); }
    catch { setHolidays([]); }
  }, [year]);

  useEffect(() => {
    fetchWithAuth(`${apiBaseUrl}/auth/me`).then((u) => setRole(u.roleuser)).catch(() => setRole(null));
  }, []);
  useEffect(() => { loadShifts(); }, [loadShifts]);
  useEffect(() => { loadHolidays(); }, [loadHolidays]);

  const deleteShift = async (id) => {
    if (!confirm("Delete this shift?")) return;
    try { await fetchWithAuth(`${apiBaseUrl}/api/shifts/${id}`, { method: "DELETE" }); loadShifts(); }
    catch (e) { alert(e?.error || "Delete failed"); }
  };
  const addHoliday = async () => {
    if (!newHolidayDate) return;
    try {
      await fetchWithAuth(`${apiBaseUrl}/api/holidays`, { method: "POST", body: JSON.stringify({ date: newHolidayDate, name: newHolidayName || null }) });
      setNewHolidayDate(""); setNewHolidayName(""); loadHolidays();
    } catch (e) { alert(e?.error || "Add failed"); }
  };
  const deleteHoliday = async (id) => {
    try { await fetchWithAuth(`${apiBaseUrl}/api/holidays/${id}`, { method: "DELETE" }); loadHolidays(); }
    catch (e) { alert(e?.error || "Delete failed"); }
  };

  const card = { background: p.cardBg, border: `1px solid ${p.border}` };
  const input = { background: p.inputBg, border: `1px solid ${p.border}`, color: p.text, borderRadius: 10, padding: "8px 10px", fontSize: 13 };

  return (
    <main className="overflow-x-hidden w-full max-w-full">
      <div className="p-8 min-h-screen" style={{ background: p.pageBg }}>
        <div className="mb-8">
          <p className="text-[10px] font-black tracking-[0.25em] uppercase mb-1" style={{ color: p.primary }}>HR Management</p>
          <h1 className="text-[1.8rem] font-black tracking-tight leading-none" style={{ color: p.text }}>Shifts &amp; Calendar</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Shifts panel */}
          <div className="p-5 rounded-2xl" style={card}>
            <div className="flex items-center justify-between mb-4">
              <span className="flex items-center gap-2 text-[13px] font-black" style={{ color: p.text }}><Clock size={15} /> Shifts</span>
              {isAdmin && (
                <button onClick={() => { setEditing(null); setDrawerOpen(true); }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-black" style={{ background: p.primary, color: "#fff" }}>
                  <Plus size={13} /> Add
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {shifts.length === 0 ? (
                <p className="text-[12px]" style={{ color: p.faint }}>No shifts defined.</p>
              ) : shifts.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: p.inputBg }}>
                  <div>
                    <span className="text-[13px] font-bold" style={{ color: p.text }}>{s.name}</span>
                    <span className="text-[11px] ml-2" style={{ color: p.muted }}>{hhmm(s.start_time)}–{hhmm(s.end_time)}</span>
                    <span className="text-[11px] ml-2" style={{ color: p.faint }}>{s.worker_count} worker(s)</span>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button onClick={() => { setEditing(s); setDrawerOpen(true); }} className="p-1.5 rounded-lg" style={{ border: `1px solid ${p.border}`, color: p.muted }}><Pencil size={13} /></button>
                      <button onClick={() => deleteShift(s.id)} className="p-1.5 rounded-lg" style={{ border: `1px solid ${p.border}`, color: "#e06666" }}><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Holidays panel */}
          <div className="p-5 rounded-2xl" style={card}>
            <div className="flex items-center justify-between mb-4">
              <span className="flex items-center gap-2 text-[13px] font-black" style={{ color: p.text }}><CalendarDays size={15} /> Holidays</span>
              <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ ...input, width: 90 }} />
            </div>
            {isAdmin && (
              <div className="flex gap-2 mb-3">
                <input type="date" value={newHolidayDate} onChange={(e) => setNewHolidayDate(e.target.value)} style={{ ...input, flex: 1 }} />
                <input value={newHolidayName} onChange={(e) => setNewHolidayName(e.target.value)} placeholder="Name" style={{ ...input, flex: 1 }} />
                <button onClick={addHoliday} className="px-3 rounded-lg text-[12px] font-black" style={{ background: p.primary, color: "#fff" }}>Add</button>
              </div>
            )}
            <div className="flex flex-col gap-2">
              {holidays.length === 0 ? (
                <p className="text-[12px]" style={{ color: p.faint }}>No holidays for {year}.</p>
              ) : holidays.map((h) => (
                <div key={h.id} className="flex items-center justify-between p-2.5 rounded-xl" style={{ background: p.inputBg }}>
                  <div>
                    <span className="text-[12px] font-bold" style={{ color: p.text }}>{new Date(h.date).toISOString().slice(0, 10)}</span>
                    {h.name && <span className="text-[11px] ml-2" style={{ color: p.muted }}>{h.name}</span>}
                  </div>
                  {isAdmin && (
                    <button onClick={() => deleteHoliday(h.id)} className="p-1.5 rounded-lg" style={{ border: `1px solid ${p.border}`, color: "#e06666" }}><Trash2 size={13} /></button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={editing ? "Edit Shift" : "New Shift"} subtitle="Company-wide shift definition">
        <ShiftForm existing={editing} onSuccess={() => { setDrawerOpen(false); loadShifts(); }} />
      </Drawer>
    </main>
  );
}
