"use client";
import apiBaseUrl from "@/lib/urlEndPoint";

export default function Login() {
  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    try {
      const result = await fetch(`${apiBaseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      const resData = await result.text();
      sessionStorage.setItem("authToken", resData);
      if (!result.ok) {
        alert(resData || "Login failed");
        return;
      }
      window.location.href = "/dashboard";
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  return (
    <div
      className="w-screen h-screen flex items-center justify-center"
      style={{ background: "#0b0d14" }}
    >
      <div className="w-full max-w-sm px-4">
        {/* Brand header */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0"
            style={{ background: "#3b6fd4" }}
          >
            GAS
          </div>
          <div>
            <p className="text-sm font-black text-white tracking-widest uppercase leading-tight">
              PT. Global Anugerah Setia
            </p>
            <p className="text-[11px] tracking-widest uppercase mt-0.5" style={{ color: "#4a5568" }}>
              HR Management System
            </p>
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{ background: "#10131c", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <h2 className="text-xl font-bold text-white mb-1">Sign in</h2>
          <p className="text-sm mb-6" style={{ color: "#4a5568" }}>
            Enter your credentials to access the portal
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold tracking-widest uppercase" style={{ color: "#6b7a99" }}>
                Username
              </label>
              <input
                name="username"
                type="text"
                id="username"
                required
                autoComplete="username"
                placeholder="Enter username"
                className="w-full px-4 py-3 rounded-lg text-sm text-white outline-none transition-all"
                style={{
                  background: "#161c2b",
                  border: "1px solid rgba(255,255,255,0.08)",
                  caretColor: "#5b8df8",
                }}
                onFocus={e => { e.target.style.borderColor = "#5b8df8"; e.target.style.boxShadow = "0 0 0 2px rgba(91,141,248,0.15)"; }}
                onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.boxShadow = "none"; }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold tracking-widest uppercase" style={{ color: "#6b7a99" }}>
                Password
              </label>
              <input
                name="password"
                type="password"
                id="password"
                required
                autoComplete="current-password"
                placeholder="Enter password"
                className="w-full px-4 py-3 rounded-lg text-sm text-white outline-none transition-all"
                style={{
                  background: "#161c2b",
                  border: "1px solid rgba(255,255,255,0.08)",
                  caretColor: "#5b8df8",
                }}
                onFocus={e => { e.target.style.borderColor = "#5b8df8"; e.target.style.boxShadow = "0 0 0 2px rgba(91,141,248,0.15)"; }}
                onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.boxShadow = "none"; }}
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-lg text-sm font-bold text-white transition-all mt-1"
              style={{ background: "#3b6fd4" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#2f5cb8"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#3b6fd4"; }}
            >
              Sign In
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "#2a3248" }}>
          PT. Global Anugerah Setia · Internal Portal
        </p>
      </div>
    </div>
  );
}
