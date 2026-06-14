"use client";
import { useState, useEffect } from "react";
import { useAppSettings } from "@/lib/useAppSettings";
import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";

const LEAVE_TYPE_OPTIONS = [
  { value: "annual",    label: "Cuti Tahunan" },
  { value: "sick",      label: "Sakit" },
  { value: "personal",  label: "Cuti Pribadi" },
  { value: "maternity", label: "Melahirkan" },
  { value: "unpaid",    label: "Tanpa Bayar" },
];

export default function LeaveForm({ isAdmin, onSuccess }) {
  const { p } = useAppSettings();
  const [employees, setEmployees] = useState([]);
  const [userId, setUserId] = useState("");
  const [leaveType, setLeaveType] = useState("annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Admins need the employee picker; supervisors submit for self.
  useEffect(() => {
    if (!isAdmin) return;
    fetchWithAuth(`${apiBaseUrl}/members?limit=1000`)
      .then((r) => setEmployees(r.data || []))
      .catch(() => setEmployees([]));
  }, [isAdmin]);

  const submit = async () => {
    setError("");
    if (!leaveType || !startDate || !endDate) {
      setError("Jenis cuti, tanggal mulai, dan tanggal selesai wajib diisi.");
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setError("Tanggal selesai harus pada atau setelah tanggal mulai.");
      return;
    }
    if (isAdmin && !userId) {
      setError("Pilih karyawan yang akan mengambil cuti.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim() || null,
      };
      if (isAdmin && userId) body.user_id = userId;
      await fetchWithAuth(`${apiBaseUrl}/api/leave`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      onSuccess?.();
    } catch (e) {
      setError(e?.error || "Gagal mengajukan cuti.");
    } finally {
      setSaving(false);
    }
  };

  const label = { fontSize: 11, fontWeight: 700, color: p.muted, marginBottom: 4, display: "block" };
  const input = { width: "100%", background: p.inputBg, border: `1px solid ${p.border}`, color: p.text, borderRadius: 10, padding: "8px 10px", fontSize: 13 };

  return (
    <div className="flex flex-col gap-4">
      {isAdmin && (
        <div>
          <span style={label}>Karyawan</span>
          <select value={userId} onChange={(e) => setUserId(e.target.value)} style={input}>
            <option value="">Pilih karyawan…</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.name} {emp.nik ? `(${emp.nik})` : ""}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <span style={label}>Jenis Cuti</span>
        <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} style={input}>
          {LEAVE_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <span style={label}>Tanggal Mulai</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={input} />
        </div>
        <div>
          <span style={label}>Tanggal Selesai</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={input} />
        </div>
      </div>

      <div>
        <span style={label}>Keterangan</span>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
          placeholder="Alasan cuti (opsional)"
          style={{ ...input, resize: "vertical", fontFamily: "inherit" }} />
      </div>

      <p className="text-[11px]" style={{ color: p.faint }}>
        Hari libur nasional dan akhir pekan otomatis dikecualikan saat menghitung jumlah hari kerja.
      </p>

      {error && <p className="text-[12px]" style={{ color: "#e06666" }}>{error}</p>}

      <button onClick={submit} disabled={saving}
        className="mt-2 py-2.5 rounded-xl text-[13px] font-black disabled:opacity-60"
        style={{ background: p.primary, color: "#fff" }}>
        {saving ? "Mengirim…" : "Ajukan Cuti"}
      </button>
    </div>
  );
}
