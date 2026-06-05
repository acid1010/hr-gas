"use client";

import React, { useState, useEffect } from "react";
import {
  AlertCircle,
  Fingerprint,
  Building2,
  Monitor,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import apiBaseUrl from "@/lib/urlEndPoint";
import fetchWithAuth from "@/lib/fetchWithAuth";
import Image from "next/image";

const getDrivePreview = (url) => {
  if (!url) return "";
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  const fileId = match ? match[1] : null;
  return fileId
    ? `https://drive.google.com/thumbnail?id=${fileId}&sz=s400`
    : url;
};

const ITEMS_PER_PAGE = 5;

const DashboardTV = () => {
  const [data, setData] = useState([]);
  const [worstPage, setWorstPage] = useState(0);

  const handleGetData = async () => {
    try {
      const result = await fetchWithAuth(`${apiBaseUrl}/api/performance/`);
      const rawData = result?.data || result || [];
      const formatted = rawData.map((item) => ({
        id: item.id,
        name: item.users?.name || item.name || "-",
        nik: item.users?.nik || item.nik || "-",
        departement: item.users?.departement || "-",
        description: item.description || "-",
        status: (item.status || "").toLowerCase(),
        photo: item.users?.link_image || "",
      }));
      setData(formatted);
    } catch (error) {
      console.error("ERROR FETCH:", error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await handleGetData();
    };

    loadData();
    const interval = setInterval(handleGetData, 60000);
    return () => clearInterval(interval);
  }, []);

  const worst10 = data.filter((d) => d.status === "worst").slice(0, 10);
  const worstPages = Math.ceil(worst10.length / ITEMS_PER_PAGE);
  const currentWorst = worst10.slice(
    worstPage * ITEMS_PER_PAGE,
    worstPage * ITEMS_PER_PAGE + ITEMS_PER_PAGE,
  );

  // Auto-slide
  useEffect(() => {
    if (worstPages <= 1) return;
    const timer = setInterval(() => {
      setWorstPage((p) => (p + 1) % worstPages);
    }, 5000);
    return () => clearInterval(timer);
  }, [worstPages]);

  return (
    <div className="z-50 absolute h-screen w-full bg-slate-950 text-white flex flex-col overflow-hidden">
      {/* HEADER */}
      <header className="flex justify-between items-center px-8 py-4 border-b border-slate-800/60 bg-slate-900/40 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2.5 rounded-xl">
            <Monitor className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tighter italic">
            PERFORMANCE <span className="text-blue-500">MONITOR</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 px-4 py-2 rounded-xl">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span className="text-sm font-black text-rose-400 italic uppercase tracking-wide">
              Worst 10 — Need Evaluation
            </span>
          </div>
          <div className="text-right">
            <p className="text-slate-500 text-[10px] font-bold tracking-widest uppercase">
              Live
            </p>
            <p className="text-slate-300 font-mono text-sm">
              {new Date().toLocaleDateString("id-ID", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main className="flex-1 min-h-0 px-8 py-6 flex flex-col gap-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={worstPage}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35 }}
            className="flex-1 min-h-0 grid grid-rows-5 gap-4"
          >
            {currentWorst.map((emp, i) => (
              <EmployeeCard
                key={emp.id}
                emp={emp}
                index={worstPage * ITEMS_PER_PAGE + i}
              />
            ))}
            {currentWorst.length === 0 && (
              <div className="row-span-5 flex items-center justify-center border-2 border-dashed border-slate-800 rounded-3xl opacity-30">
                <p className="text-xl font-black italic uppercase tracking-widest text-slate-400">
                  No Data Found
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* FOOTER PAGINATION */}
      {worstPages > 1 && (
        <footer className="flex items-center justify-center gap-6 py-3 border-t border-slate-800/60 bg-slate-900/40 flex-shrink-0">
          <button
            onClick={() => setWorstPage((p) => Math.max(0, p - 1))}
            disabled={worstPage === 0}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-20 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex gap-2">
            {Array.from({ length: worstPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setWorstPage(i)}
                className={`h-2 rounded-full transition-all duration-300 ${i === worstPage ? "bg-rose-500 w-8" : "bg-slate-700 w-2"}`}
              />
            ))}
          </div>
          <button
            onClick={() => setWorstPage((p) => Math.min(worstPages - 1, p + 1))}
            disabled={worstPage === worstPages - 1}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-20 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </footer>
      )}
    </div>
  );
};

const EmployeeCard = ({ emp, index }) => (
  <div className="bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center gap-5 px-6 overflow-hidden hover:border-slate-700 transition-colors h-full">
    {/* Rank */}
    <span className="text-5xl font-black italic text-rose-500/20 w-16 text-center flex-shrink-0 leading-none">
      #{index + 1}
    </span>

    {/* FOTO BESAR */}
    <div className="h-[85%] aspect-square flex-shrink-0 rounded-2xl border-2 border-slate-700 overflow-hidden bg-slate-800">
      {emp.photo ? (
        <Image
          src={getDrivePreview(emp.photo)}
          alt={emp.name}
          width={120}
          height={120}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center text-4xl font-black text-slate-600">
          {emp.name?.[0] || "?"}
        </div>
      )}
    </div>

    {/* INFO */}
    <div className="flex-1 min-w-0">
      <p className="text-2xl font-black uppercase text-white truncate leading-tight">
        {emp.name}
      </p>
      <div className="flex gap-4 mt-1.5">
        <div className="flex items-center gap-1.5">
          <Fingerprint size={14} className="text-blue-500 flex-shrink-0" />
          <span className="text-sm font-mono text-slate-400 font-bold">
            {emp.nik}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Building2 size={14} className="text-blue-500 flex-shrink-0" />
          <span className="text-sm uppercase text-slate-400 font-bold truncate max-w-[120px]">
            {emp.departement}
          </span>
        </div>
      </div>
    </div>

    {/* DESCRIPTION BADGE — diperbesar */}
    <div className="flex-shrink-0 bg-rose-500/10 border border-rose-500/25 rounded-xl px-6 py-3 text-center">
      <p className="text-rose-400 font-black italic uppercase text-base leading-tight">
        {emp.description}
      </p>
    </div>
  </div>
);

export default DashboardTV;
