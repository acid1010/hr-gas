"use client";
import { useState } from "react";
import { useAppSettings } from "@/lib/useAppSettings";
import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";

// existing: optional shift being edited ({id,name,start_time,end_time})
export default function ShiftForm({ existing, onSuccess }) {
  const { p } = useAppSettings();
  const hhmm = (v) => (v ? new Date(v).toISOString().slice(11, 16) : "");
  const [name, setName] = useState(existing?.name || "");
  const [startTime, setStartTime] = useState(hhmm(existing?.start_time));
  const [endTime, setEndTime] = useState(hhmm(existing?.end_time));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!name || !startTime || !endTime) {
      setError("Name, start and end time are required.");
      return;
    }
    setSaving(true);
    try {
      const body = JSON.stringify({ name, start_time: startTime, end_time: endTime });
      if (existing?.id) {
        await fetchWithAuth(`${apiBaseUrl}/api/shifts/${existing.id}`, { method: "PUT", body });
      } else {
        await fetchWithAuth(`${apiBaseUrl}/api/shifts`, { method: "POST", body });
      }
      onSuccess?.();
    } catch (e) {
      setError(e?.error || "Failed to save shift.");
    } finally {
      setSaving(false);
    }
  };

  const label = { fontSize: 11, fontWeight: 700, color: p.muted, marginBottom: 4, display: "block" };
  const input = { width: "100%", background: p.inputBg, border: `1px solid ${p.border}`, color: p.text, borderRadius: 10, padding: "8px 10px", fontSize: 13 };

  return (
    <div className="flex flex-col gap-4">
      <div><span style={label}>Shift Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Shift 1" style={input} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><span style={label}>Start</span>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={input} /></div>
        <div><span style={label}>End</span>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={input} /></div>
      </div>
      {error && <p className="text-[12px]" style={{ color: "#e06666" }}>{error}</p>}
      <button onClick={submit} disabled={saving}
        className="mt-2 py-2.5 rounded-xl text-[13px] font-black disabled:opacity-60"
        style={{ background: p.primary, color: "#fff" }}>
        {saving ? "Saving…" : existing?.id ? "Update Shift" : "Create Shift"}
      </button>
    </div>
  );
}
