"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, SearchX } from "lucide-react";
import { useAppSettings } from "@/lib/useAppSettings";

export default function NotFound() {
  const { p } = useAppSettings();
  const router = useRouter();

  return (
    <main className="overflow-x-hidden w-full max-w-full">
      <div
        className="flex items-center justify-center min-h-screen px-8 transition-colors duration-300"
        style={{ background: p.pageBg }}
      >
        <div className="fade-up relative flex flex-col items-center text-center max-w-sm w-full">
          {/* Ambient glow behind icon */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(91,141,248,0.07), transparent 70%)" }}
          />

          {/* Icon */}
          <div
            className="fade-up relative z-10 w-20 h-20 rounded-3xl flex items-center justify-center mb-8"
            style={{ background: p.cardBg, border: `1px solid ${p.border}`, animationDelay: "0.1s" }}
          >
            <SearchX size={34} style={{ color: p.faint }} />
          </div>

          {/* 404 numeral */}
          <p
            className="fade-up font-black tabular-nums leading-none mb-3"
            style={{ fontSize: "clamp(4rem, 12vw, 7rem)", color: "rgba(91,141,248,0.18)", letterSpacing: "-0.04em", animationDelay: "0.18s" }}
          >
            404
          </p>

          <h1
            className="fade-up text-xl font-black tracking-tight mb-2"
            style={{ color: p.text, animationDelay: "0.24s" }}
          >
            Page Not Found
          </h1>

          <p
            className="fade-up text-sm leading-relaxed mb-9"
            style={{ color: p.muted, animationDelay: "0.32s" }}
          >
            The page you are looking for does not exist or has been moved.
          </p>

          {/* Action */}
          <button
            className="fade-up flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-black text-white"
            style={{ background: "#3b6fd4", animationDelay: "0.4s" }}
            onClick={() => router.push("/dashboard")}
          >
            <ArrowLeft size={15} />
            Back to Dashboard
          </button>

        </div>
      </div>
    </main>
  );
}
