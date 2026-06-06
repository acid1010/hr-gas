"use client";
import { useAppSettings } from "@/lib/useAppSettings";

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    onChange(name, value);
  };

  const onFocus = (e) => { e.target.style.borderColor = "#5b8df8"; e.target.style.boxShadow = "0 0 0 3px rgba(91,141,248,0.1)"; };
  const onBlur  = (e) => { e.target.style.borderColor = p.border2;   e.target.style.boxShadow = "none"; };

  const selectStyle = { ...inputStyle, appearance: "none" };

  return (
    <div className="grid grid-cols-1 gap-4">
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

      <Field label="Photo URL" labelStyle={labelStyle}>
        <input
          name="link_image" type="text" placeholder="https://..."
          value={formData?.link_image || ""}
          style={inputStyle} onChange={handleChange}
          onFocus={onFocus} onBlur={onBlur}
        />
      </Field>
    </div>
  );
};

export default EmployeeForm;
