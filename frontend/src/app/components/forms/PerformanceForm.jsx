"use client";

import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";
import { Save, X, Trophy, User, Calendar, Activity } from "lucide-react";
import { useEffect, useState } from "react";

const PerformanceForm = ({ onSubmit }) => {
  const [nikData, setNikData] = useState([]);

  const getData = async () => {
    const endPointEmployee = `${apiBaseUrl}/members?limit=10000`;

    try {
      const resultNik = await fetchWithAuth(endPointEmployee);
      setNikData(resultNik);
    } catch (error) {
      console.log("terjadi kesalahan", error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await getData();
    };

    loadData();
  }, []);

  return (
    <div className="card w-full max-w-2xl bg-base-100 shadow-2xl mx-auto border border-base-200">
      {/* Header */}
      <div className="p-6 bg-neutral text-neutral-content rounded-t-2xl flex items-center gap-4">
        <div className="p-3 bg-primary rounded-xl text-primary-content shadow-lg">
          <Trophy size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-black italic tracking-tight">
            INPUT PERFORMANCE
          </h2>
          <p className="text-xs opacity-70 uppercase tracking-widest font-bold">
            Kuartal Karyawan
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="card-body gap-6">
        {/* User Selection */}
        <div className="form-control w-full">
          <label className="label">
            <span className="label-text font-bold flex items-center gap-2">
              <User size={16} className="text-primary" /> Pilih Karyawan
            </span>
          </label>
          <select
            name="user_id"
            className="select select-bordered w-full focus:select-primary"
            required
            defaultValue=""
          >
            <option value="" disabled>
              Cari nama atau NIK...
            </option>
            {nikData?.data?.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} - {user.nik} - {user.departement}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Quarter */}
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text font-bold flex items-center gap-2">
                <Calendar size={16} className="text-primary" /> Kuartal
              </span>
            </label>
            <select
              name="quarter"
              className="select select-bordered w-full"
              required
              defaultValue=""
            >
              <option value="" disabled>
                Pilih Periode
              </option>
              <option value="1">Q1 - Januari s/d Maret</option>
              <option value="2">Q2 - April s/d Juni</option>
              <option value="3">Q3 - Juli s/d September</option>
              <option value="4">Q4 - Oktober s/d Desember</option>
            </select>
          </div>

          {/* Status */}
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text font-bold flex items-center gap-2">
                <Activity size={16} className="text-primary" /> Status Performa
              </span>
            </label>
            <select
              name="status"
              className="select select-bordered w-full"
              required
              defaultValue=""
            >
              <option value="" disabled>
                Pilih Status
              </option>
              <option value="best">Best</option>
              <option value="worst">Worst</option>
            </select>
          </div>
        </div>

        {/* Description */}
        <div className="form-control w-full">
          <label className="label">
            <span className="label-text font-bold">
              Deskripsi / Catatan Tambahan
            </span>
          </label>
          <textarea
            name="description"
            className="textarea textarea-bordered h-32 focus:textarea-primary"
            placeholder="Tuliskan detail pencapaian atau alasan penilaian di sini..."
          ></textarea>
        </div>

        {/* Actions */}
        <div className="card-actions justify-end mt-4 pt-6 border-t border-base-200 gap-3">
          <button
            type="button"
            className="btn btn-ghost font-bold"
            onClick={() =>
              document
                .getElementById("createPerformance")
                .closest("dialog")
                .close()
            }
          >
            <X size={18} /> Batal
          </button>
          <button
            type="submit"
            className="btn btn-neutral px-8 font-black shadow-xl hover:btn-primary transition-all active:scale-95"
          >
            <Save size={18} /> SIMPAN DATA
          </button>
        </div>
      </form>
    </div>
  );
};

export default PerformanceForm;
