"use client";

const inputStyle = {
  background: "#161c2b",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#c9d1e0",
  borderRadius: "0.5rem",
  padding: "0.625rem 1rem",
  fontSize: "0.875rem",
  width: "100%",
  outline: "none",
  transition: "border-color 0.15s",
};

const labelStyle = {
  fontSize: "0.7rem",
  fontWeight: "700",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  color: "#6b7a99",
  marginBottom: "0.25rem",
  display: "block",
};

const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1">
    <label style={labelStyle}>{label}</label>
    {children}
  </div>
);

const EmployeeForm = ({ formData, onChange }) => {
  const handleChange = (e) => {
    const { name, value } = e.target;
    onChange(name, value);
  };

  const focusStyle = (e) => { e.target.style.borderColor = "#5b8df8"; };
  const blurStyle = (e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; };

  return (
    <div className="p-8 w-full" style={{ background: "#10131c" }}>
      <div className="mb-6">
        <h2 className="text-xl font-black text-white">
          {formData?.id ? "Edit" : "Add"} Employee
        </h2>
        <p className="text-sm mt-1" style={{ color: "#4a5568" }}>
          {formData?.id ? "Update" : "Register"} staff data in the HR system
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="NIK">
          <input
            required name="nik" type="text"
            value={formData?.nik || ""} placeholder="e.g. 100234"
            style={inputStyle} onChange={handleChange}
            onFocus={focusStyle} onBlur={blurStyle}
          />
        </Field>

        <Field label="Full Name">
          <input
            required name="name" type="text"
            value={formData?.name || ""} placeholder="Full name"
            style={inputStyle} onChange={handleChange}
            onFocus={focusStyle} onBlur={blurStyle}
          />
        </Field>

        <Field label="Join Date">
          <input
            required name="join_date" type="date"
            value={formData?.join_date?.slice(0, 10) || ""}
            style={{ ...inputStyle, colorScheme: "dark" }}
            onChange={handleChange} onFocus={focusStyle} onBlur={blurStyle}
          />
        </Field>

        <Field label="Status">
          <select
            name="status" value={formData?.status || ""}
            style={{ ...inputStyle, appearance: "none" }}
            onChange={handleChange} onFocus={focusStyle} onBlur={blurStyle}
          >
            <option value="">Select status</option>
            <option value="aktif">Aktif</option>
            <option value="non-aktif">Non-Aktif</option>
          </select>
        </Field>

        <Field label="Position">
          <select
            name="section" value={formData?.section || ""}
            style={{ ...inputStyle, appearance: "none" }}
            onChange={handleChange} onFocus={focusStyle} onBlur={blurStyle}
          >
            <option value="">Select position</option>
            <option value="manager">Manager</option>
            <option value="spv">Supervisor</option>
            <option value="admin">Admin</option>
            <option value="operator">Operator</option>
          </select>
        </Field>

        <Field label="Department">
          <select
            name="departement" value={formData?.departement || ""}
            style={{ ...inputStyle, appearance: "none" }}
            onChange={handleChange} onFocus={focusStyle} onBlur={blurStyle}
          >
            <option value="">Select department</option>
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

        <Field label="Worker Status">
          <select
            name="worker_stats" value={formData?.worker_stats || ""}
            style={{ ...inputStyle, appearance: "none" }}
            onChange={handleChange} onFocus={focusStyle} onBlur={blurStyle}
          >
            <option value="">Select worker status</option>
            <option value="magang">Magang</option>
            <option value="borongan">Borongan</option>
            <option value="pkwt">PKWT</option>
          </select>
        </Field>

        <Field label="Photo URL">
          <input
            name="link_image" type="text" placeholder="Image link"
            value={formData?.link_image || ""}
            style={inputStyle} onChange={handleChange}
            onFocus={focusStyle} onBlur={blurStyle}
          />
        </Field>
      </div>

      <div className="flex gap-3 mt-7">
        <button
          type="submit"
          className="flex-1 py-3 rounded-lg text-sm font-bold text-white transition-all"
          style={{ background: "#3b6fd4" }}
          onMouseEnter={e => { e.currentTarget.style.background = "#2f5cb8"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#3b6fd4"; }}
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            document.getElementById("form-create").reset();
            document.getElementById("create").closest("dialog").close();
          }}
          className="px-6 py-3 rounded-lg text-sm font-bold transition-all"
          style={{ background: "#161c2b", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7a99" }}
          onMouseEnter={e => { e.currentTarget.style.color = "#c9d1e0"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "#6b7a99"; }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default EmployeeForm;
