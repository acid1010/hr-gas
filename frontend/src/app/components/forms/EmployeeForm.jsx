"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ImageOff, LinkIcon, ChevronDown, UploadCloud, Loader2 } from "lucide-react";
import { useAppSettings } from "@/lib/useAppSettings";
import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";

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

function SelectField({ label, name, value, onChange, labelStyle, selectStyle, onFocus, onBlur, iconColor, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label style={labelStyle}>{label}</label>
      <div className="relative">
        <select
          name={name}
          value={value}
          style={selectStyle}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
        >
          {children}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: iconColor }} />
      </div>
    </div>
  );
}

const EmployeeForm = ({ formData, onChange }) => {
  const { p } = useAppSettings();
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError]   = useState(false);
  const [shifts, setShifts]       = useState([]);
  const [dragging, setDragging]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);
  useEffect(() => {
    fetchWithAuth(`${apiBaseUrl}/api/shifts`).then((r) => setShifts(r.data || [])).catch(() => setShifts([]));
  }, []);

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
    setUploadError("");
    onChange(e.target.name, e.target.value);
  };

  const uploadPhoto = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Only image files are allowed");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError("Image must be 2 MB or smaller");
      return;
    }

    const body = new FormData();
    body.append("photo", file);
    setUploading(true);
    setUploadError("");
    setImgLoaded(false);
    setImgError(false);

    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/members/upload-photo`, { method: "POST", body });
      onChange("link_image", res.url || "");
    } catch (err) {
      setUploadError(err.message || "Photo upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    uploadPhoto(e.dataTransfer.files?.[0]);
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
  const selectStyle = { ...inputStyle, appearance: "none", paddingRight: "2.25rem" };

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
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
            onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
            onDrop={handleDrop}
            className="mt-2 flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-[11px] font-black transition-all cursor-pointer"
            style={{
              background: dragging ? `${p.primary}18` : p.cardBg,
              border: `1px dashed ${dragging ? p.primary : p.border2}`,
              color: dragging ? p.primary : p.muted,
            }}
          >
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />}
            {uploading ? "Uploading photo..." : "Upload file or drag photo here"}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => uploadPhoto(e.target.files?.[0])}
            />
          </div>
          {uploadError && (
            <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-semibold" style={{ color: "#ef4444" }}>
              <ImageOff size={11} /> {uploadError}
            </div>
          )}
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
        <SelectField label="Status" name="status" value={formData?.status || ""} onChange={handleChange} labelStyle={labelStyle} selectStyle={selectStyle} onFocus={onFocus} onBlur={onBlur} iconColor={p.faint}>
          <option value="">Select status</option>
          <option value="aktif">Aktif</option>
          <option value="non-aktif">Non-Aktif</option>
        </SelectField>

        <SelectField label="Worker Status" name="worker_stats" value={formData?.worker_stats || ""} onChange={handleChange} labelStyle={labelStyle} selectStyle={selectStyle} onFocus={onFocus} onBlur={onBlur} iconColor={p.faint}>
          <option value="">Select</option>
          <option value="magang">Magang</option>
          <option value="borongan">Borongan</option>
          <option value="pkwt">PKWT</option>
        </SelectField>

        <SelectField label="Shift" name="shift_id" value={formData?.shift_id || ""} onChange={handleChange} labelStyle={labelStyle} selectStyle={selectStyle} onFocus={onFocus} onBlur={onBlur} iconColor={p.faint}>
          <option value="">No shift</option>
          {shifts.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </SelectField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label style={labelStyle}>Position</label>
          <input
            name="section"
            type="text"
            list="position-list"
            placeholder="e.g. Operator, Supervisor…"
            value={formData?.section || ""}
            style={inputStyle}
            onChange={handleChange}
            onFocus={onFocus}
            onBlur={onBlur}
          />
          <datalist id="position-list">
            <option value="Manager" />
            <option value="Supervisor" />
            <option value="Admin" />
            <option value="Operator" />
            <option value="Technician" />
            <option value="Staff" />
            <option value="Security" />
            <option value="Driver" />
          </datalist>
        </div>

        <div className="flex flex-col gap-1.5">
          <label style={labelStyle}>Department</label>
          <div className="relative">
            <select
              name="departement"
              value={formData?.departement || ""}
              style={selectStyle}
              onChange={handleChange}
              onFocus={onFocus}
              onBlur={onBlur}
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
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: p.faint }} />
          </div>
          {dept && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color }}>{dept}</span>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default EmployeeForm;
