"use client";
import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAppSettings } from "@/lib/useAppSettings";
import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";

const emptyLine = () => ({ user_id: "", start_time: "", end_time: "", reason: "" });

export default function OvertimeForm({ onSuccess }) {
  const { p } = useAppSettings();
  const [employees, setEmployees] = useState([]);
  const [date, setDate] = useState("");
  const [shift, setShift] = useState("");
  const [departement, setDepartement] = useState("");
  const [lines, setLines] = useState([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchWithAuth(`${apiBaseUrl}/members?limit=1000`)
      .then((r) => setEmployees(r.data || []))
      .catch(() => setEmployees([]));
  }, []);

  const setLine = (i, key, val) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, [key]: val } : l)));
  const addLine = () => setLines((ls) => [...ls, emptyLine()]);
  const removeLine = (i) => setLines((ls) => ls.filter((_, idx) => idx !== i));

  const submit = async () => {
    setError("");
    if (!date || lines.some((l) => !l.user_id || !l.start_time || !l.end_time)) {
      setError("Date and every worker row (worker, start, end) are required.");
      return;
    }
    setSaving(true);
    try {
      const toISO = (d, t) => new Date(`${d}T${t}:00`).toISOString();
      await fetchWithAuth(`${apiBaseUrl}/api/overtime`, {
        method: "POST",
        body: JSON.stringify({
          departement: departement || null,
          date,
          shift: shift || null,
          lines: lines.map((l) => ({
            user_id: l.user_id,
            start_time: toISO(date, l.start_time),
            end_time: toISO(date, l.end_time),
            reason: l.reason || null,
          })),
        }),
      });
      onSuccess?.();
    } catch (e) {
      setError(e?.error || "Failed to submit overtime.");
    } finally {
      setSaving(false);
    }
  };

  const label = { fontSize: 11, fontWeight: 700, color: p.muted, marginBottom: 4, display: "block" };
  const input = { width: "100%", background: p.inputBg, border: `1px solid ${p.border}`, color: p.text, borderRadius: 10, padding: "8px 10px", fontSize: 13 };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div><span style={label}>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={input} /></div>
        <div><span style={label}>Shift</span>
          <input type="number" value={shift} onChange={(e) => setShift(e.target.value)} placeholder="1" style={input} /></div>
      </div>
      <div><span style={label}>Department</span>
        <input value={departement} onChange={(e) => setDepartement(e.target.value)} placeholder="Production" style={input} /></div>

      <div className="flex items-center justify-between mt-1">
        <span style={{ ...label, marginBottom: 0 }}>Workers</span>
        <button onClick={addLine} className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg"
          style={{ background: p.inputBg, border: `1px solid ${p.border}`, color: p.accent }}>
          <Plus size={13} /> Add worker
        </button>
      </div>

      {lines.map((l, i) => (
        <div key={i} className="flex flex-col gap-2 p-3 rounded-xl" style={{ border: `1px solid ${p.border}` }}>
          <select value={l.user_id} onChange={(e) => setLine(i, "user_id", e.target.value)} style={input}>
            <option value="">Select worker…</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.name} {emp.nik ? `(${emp.nik})` : ""}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="time" value={l.start_time} onChange={(e) => setLine(i, "start_time", e.target.value)} style={input} />
            <input type="time" value={l.end_time} onChange={(e) => setLine(i, "end_time", e.target.value)} style={input} />
          </div>
          <div className="flex gap-2">
            <input value={l.reason} onChange={(e) => setLine(i, "reason", e.target.value)} placeholder="Reason (optional)" style={input} />
            {lines.length > 1 && (
              <button onClick={() => removeLine(i)} className="px-2 rounded-lg" style={{ border: `1px solid ${p.border}`, color: "#e06666" }}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      ))}

      {error && <p className="text-[12px]" style={{ color: "#e06666" }}>{error}</p>}

      <button onClick={submit} disabled={saving}
        className="mt-2 py-2.5 rounded-xl text-[13px] font-black disabled:opacity-60"
        style={{ background: p.primary, color: "#fff" }}>
        {saving ? "Submitting…" : "Submit Overtime"}
      </button>
    </div>
  );
}
