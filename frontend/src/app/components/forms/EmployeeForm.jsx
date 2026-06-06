"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ImageOff, LinkIcon } from "lucide-react";
import { useAppSettings } from "@/lib/useAppSettings";

const DEPT_COLORS = {
  production: "#3b6fd4", engineering: "#8b5cf6", qc: "#f59e0b",
  maintenance: "#ef4444", warehouse: "#10b981", hr: "#5b8df8",
  ga: "#f97316", it: "#06b6d4",
};
function deptColor(d) { return DEPT_COLORS[(d || "").toLowerCase()] || "#4a5568"; }

function getDrivePreview(url) {
  if (!url) return "";
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  const fileId = match ? match[1] : null;
  return fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=s400` : url;
}

function Field({ label, labelStyle, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

const EmployeeForm = ({ formData, onChange }) => {
  const { p } = useAppSettings();
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError]   = useState(false);

  const photoUrl   = formData?.link_image || "";
  const previewSrc = getDrivePreview(photoUrl);
  const name       = formData?.name || "";
  const dept       = formData?.departement || "";
  const initials   = name ? name.trim()[0].toUpperCase() : "?";
  const color      = deptColor(dept);

  const handleChange = (e) => onChange(e.target.name, e.target.value);
  const handlePhotoChange = (e) => {
    setImgLoaded(false);
    setImgError(false);
    onChange(e.target.name, e.target.value);
  };

  const inputStyle = {
    background: p.inputBg,
    border: `1px solid ${p.border2}`,
    color: p.text,
    borderRadius: "0.75rem",
    padding: "0.625rem 1rem",
    fontSize: "0.875rem",
    width: "100%",
    outline: "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
  };

  const labelStyle = {
    fontSize: "0.68rem",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "0.15em",
    color: p.faint,
    display: "block",
  };

  const onFocus = (e) => { e.target.style.borderColor = "#5b8df8"; e.target.style.boxShadow = "0 0 0 3px rgba(91,141,248,0.1)"; };
  const onBlur  = (e) => { e.target.style.borderColor = p.border2;   e.target.style.boxShadow = "none"; };
  const selectStyle = { ...inputStyle, appearance: "none" };

  return (
    <div className="grid grid-cols-1 gap-4">

      {/* Photo preview */}
      <div className="flex items-center gap-4 p-4 rounded-2xl transition-colors duration-200" style={{ background: p.inputBg, border: `1px solid ${p.border}` }}>
        {/* Avatar / photo */}
        <div className="relative shrink-0 w-16 h-16 rounded-2xl overflow-hidden" style={{ background: `${color}20`, border: `1.5px solid ${color}40` }}>
          {/* Initials fallback */}
          <div className="absolute inset-0 flex items-center justify-center text-2xl font-black" style={{ color }}>
            {initials}
          </div>

          {/* Actual photo overlaid when URL exists */}
          <AnimatePresence>
            {previewSrc && !imgError && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <motion.img
                key={previewSrc}
                src={previewSrc}
                alt="Preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: imgLoaded ? 1 : 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 w-full h-full object-cover"
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Photo URL input */}
        <div className="flex-1 min-w-0">
          <label style={{ ...labelStyle, marginBottom: "0.375rem" }}>Photo URL</label>
          <div className="relative">
            <LinkIcon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: p.faint }} />
            <input
              name="link_image"
              type="text"
              placeholder="Google Drive URL…"
              value={photoUrl}
              style={{ ...inputStyle, paddingLeft: "2rem" }}
              onChange={handlePhotoChange}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </div>
          {imgError && (
            <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-semibold" style={{ color: "#f59e0b" }}>
              <ImageOff size={11} /> Preview unavailable — URL may be invalid or private
            </div>
          )}
          {previewSrc && imgLoaded && !imgError && (
            <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-semibold" style={{ color: "#22c55e" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#22c55e" }} /> Photo loaded
            </div>
          )}
        </div>
      </div>

      <Field label="NIK" labelStyle={labelStyle}>
        <input
          required name="nik" type="text"
          value={formData?.nik || ""} placeholder="e.g. 100234"
          style={inputStyle} onChange={handleChange}
          onFocus={onFocus} onBlur={onBlur}
        />
      </Field>

      <Field label="Full Name" labelStyle={labelStyle}>
        <input
          required name="name" type="text"
          value={formData?.name || ""} placeholder="Full name"
          style={inputStyle} onChange={handleChange}
          onFocus={onFocus} onBlur={onBlur}
        />
      </Field>

      <Field label="Join Date" labelStyle={labelStyle}>
        <input
          required name="join_date" type="date"
          value={formData?.join_date?.slice(0, 10) || ""}
          style={{ ...inputStyle, colorScheme: "dark" }}
          onChange={handleChange} onFocus={onFocus} onBlur={onBlur}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Status" labelStyle={labelStyle}>
          <select
            name="status" value={formData?.status || ""}
            style={selectStyle} onChange={handleChange}
            onFocus={onFocus} onBlur={onBlur}
          >
            <option value="">Select status</option>
            <option value="aktif">Aktif</option>
            <option value="non-aktif">Non-Aktif</option>
          </select>
        </Field>

        <Field label="Worker Status" labelStyle={labelStyle}>
          <select
            name="worker_stats" value={formData?.worker_stats || ""}
            style={selectStyle} onChange={handleChange}
            onFocus={onFocus} onBlur={onBlur}
          >
            <option value="">Select</option>
            <option value="magang">Magang</option>
            <option value="borongan">Borongan</option>
            <option value="pkwt">PKWT</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Position" labelStyle={labelStyle}>
          <select
            name="section" value={formData?.section || ""}
            style={selectStyle} onChange={handleChange}
            onFocus={onFocus} onBlur={onBlur}
          >
            <option value="">Select</option>
            <option value="manager">Manager</option>
            <option value="spv">Supervisor</option>
            <option value="admin">Admin</option>
            <option value="operator">Operator</option>
          </select>
        </Field>

        <Field label="Department" labelStyle={labelStyle}>
          <select
            name="departement" value={formData?.departement || ""}
            style={selectStyle} onChange={handleChange}
            onFocus={onFocus} onBlur={onBlur}
          >
            <option value="">Select</option>
            <option value="production">Production</option>
            <option value="engineering">Engineering</option>
            <option value="qc">Quality Control</option>
            <option value="maintenance">Maintenance</option>
            <option value="warehouse">Warehouse</option>
            <option value="hr">HR</option>
            <option value="ga">GA</option>
            <option value="it">IT</option>
          </select>
        </Field>
      </div>

    </div>
  );
};

export default EmployeeForm;
