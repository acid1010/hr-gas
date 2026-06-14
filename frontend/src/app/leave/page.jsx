"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Check, X, FileSpreadsheet, CalendarDays } from "lucide-react";
import { useAppSettings } from "@/lib/useAppSettings";
import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";
import Drawer from "@/app/components/Drawer";
import LeaveForm from "./LeaveForm";

const STATUS_COLOR = { pending: "#d6a23e", approved: "#3fa66a", rejected: "#e06666" };

const LEAVE_TYPE_LABEL = {
  annual:    "Cuti Tahunan",
  sick:      "Sakit",
  personal:  "Cuti Pribadi",
  maternity: "Melahirkan",
  unpaid:    "Tanpa Bayar",
};

const LEAVE_TYPE_COLOR = {
  annual:    "#3b6fd4",
  sick:      "#e06666",
  personal:  "#8b5cf6",
  maternity: "#ec4899",
  unpaid:    "#6b7a99",
};

function formatDate(d) {
  return new Date(d).toISOString().slice(0, 10);
}

export default function LeavePage() {
  const { p } = useAppSettings();
  const [role, setRole] = useState(null);
  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const isAdmin = role === "admin";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter)   params.set("leave_type", typeFilter);
      const q = params.toString() ? `?${params.toString()}` : "";
      const r = await fetchWithAuth(`${apiBaseUrl}/api/leave${q}`);
      setRequests(r.data || []);
    } catch { setRequests([]); }
    finally { setLoading(false); }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    fetchWithAuth(`${apiBaseUrl}/auth/me`).then((u) => setRole(u.roleuser)).catch(() => setRole(null));
  }, []);
  useEffect(() => { load(); }, [load]);

  const approve = async (id) => {
    try { await fetchWithAuth(`${apiBaseUrl}/api/leave/${id}/approve`, { method: "PATCH" }); load(); }
    catch (e) { alert(e?.error || "Approve failed"); }
  };
  const reject = async (id) => {
    const reason = prompt("Alasan penolakan:");
    if (!reason) return;
    try { await fetchWithAuth(`${apiBaseUrl}/api/leave/${id}/reject`, { method: "PATCH", body: JSON.stringify({ reason }) }); load(); }
    catch (e) { alert(e?.error || "Reject failed"); }
  };
  const exportExcel = () => {
    const month = new Date().toISOString().slice(0, 7);
    window.open(`${apiBaseUrl}/api/leave/export/excel?month=${month}`, "_blank");
  };

  return (
    <main className="overflow-x-hidden w-full max-w-full">
      <div className="p-8 min-h-screen" style={{ background: p.pageBg }}>
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black tracking-[0.25em] uppercase mb-1" style={{ color: p.primary }}>Manajemen SDM</p>
            <h1 className="text-[1.8rem] font-black tracking-tight leading-none" style={{ color: p.text }}>Cuti</h1>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <button onClick={exportExcel} className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-bold"
                style={{ background: p.cardBg, border: `1px solid ${p.border}`, color: p.text }}>
                <FileSpreadsheet size={14} /> Ekspor
              </button>
            )}
            <button onClick={() => setDrawerOpen(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-black"
              style={{ background: p.primary, color: "#fff" }}>
              <Plus size={14} /> Pengajuan Cuti
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-5">
          {["", "pending", "approved", "rejected"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold capitalize"
              style={{
                background: statusFilter === s ? p.primary : p.cardBg,
                color: statusFilter === s ? "#fff" : p.muted,
                border: `1px solid ${p.border}`,
              }}>
              {s || "semua"}
            </button>
          ))}
          <span className="mx-2" style={{ color: p.faint }}>·</span>
          {["", ...Object.keys(LEAVE_TYPE_LABEL)].map((tp) => (
            <button key={tp || "all"} onClick={() => setTypeFilter(tp)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold"
              style={{
                background: typeFilter === tp ? p.accent : p.cardBg,
                color: typeFilter === tp ? "#fff" : p.muted,
                border: `1px solid ${p.border}`,
              }}>
              {tp ? LEAVE_TYPE_LABEL[tp] : "semua jenis"}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <p style={{ color: p.muted }} className="text-sm">Memuat…</p>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20" style={{ color: p.faint }}>
            <CalendarDays size={32} className="mb-3 opacity-50" />
            <p className="text-sm">Belum ada pengajuan cuti.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {requests.map((r) => {
              const typeColor = LEAVE_TYPE_COLOR[r.leave_type] || p.muted;
              const typeLabel = LEAVE_TYPE_LABEL[r.leave_type] || r.leave_type;
              return (
                <div key={r.id} className="fade-up p-4 rounded-2xl" style={{ background: p.cardBg, border: `1px solid ${p.border}` }}>
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[13px] font-black" style={{ color: p.text }}>
                        {formatDate(r.start_date)} → {formatDate(r.end_date)}
                      </span>
                      <span className="text-[11px] font-bold" style={{ color: p.text }}>
                        {Number(r.days)} hari kerja
                      </span>
                      <span className="text-[11px] font-medium" style={{ color: p.muted }}>
                        {r.taker?.name || "—"}
                        {r.taker?.departement ? ` · ${r.taker.departement}` : ""}
                      </span>
                      {isAdmin && r.submitter?.name && r.submitter.name !== r.taker?.name && (
                        <span className="text-[11px]" style={{ color: p.faint }}>diajukan oleh {r.submitter.name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide"
                        style={{ background: `${typeColor}22`, color: typeColor }}>
                        {typeLabel}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide"
                        style={{ background: `${STATUS_COLOR[r.status]}22`, color: STATUS_COLOR[r.status] }}>
                        {r.status}
                      </span>
                      {isAdmin && r.status === "pending" && (
                        <>
                          <button onClick={() => approve(r.id)} className="p-1.5 rounded-lg" style={{ border: `1px solid ${p.border}`, color: "#3fa66a" }}><Check size={14} /></button>
                          <button onClick={() => reject(r.id)} className="p-1.5 rounded-lg" style={{ border: `1px solid ${p.border}`, color: "#e06666" }}><X size={14} /></button>
                        </>
                      )}
                    </div>
                  </div>
                  {r.reason && (
                    <p className="text-[12px] mt-1" style={{ color: p.muted }}>
                      <span style={{ color: p.faint }}>Keterangan:</span> {r.reason}
                    </p>
                  )}
                  {r.status === "rejected" && r.reject_reason && (
                    <p className="text-[11px] mt-2" style={{ color: "#e06666" }}>Ditolak: {r.reject_reason}</p>
                  )}
                  {r.status === "approved" && r.approver?.name && (
                    <p className="text-[11px] mt-2" style={{ color: "#3fa66a" }}>Disetujui oleh {r.approver.name}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Pengajuan Cuti" subtitle="Ajukan cuti untuk persetujuan">
        <LeaveForm isAdmin={isAdmin} onSuccess={() => { setDrawerOpen(false); load(); }} />
      </Drawer>
    </main>
  );
}
