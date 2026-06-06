// Lightweight event-based toast — no context needed.
// Usage: import { toast } from "@/lib/toast"; toast("Saved", "success");

export function toast(msg, type = "success", duration = 4000) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("gas:toast", { detail: { msg, type, duration, id: Date.now() + Math.random() } })
  );
}
