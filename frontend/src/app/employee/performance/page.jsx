"use client";

import PerformanceForm from "@/app/components/forms/PerformanceForm";
import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Performance() {
  const [performData, setPerformData] = useState([]);

  const handleGetData = async () => {
    const endPointPerformance = `${apiBaseUrl}/api/performance/`;

    try {
      const resultPerform = await fetchWithAuth(endPointPerformance);
      setPerformData(resultPerform);
    } catch (error) {
      console.log(error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const data = Object.fromEntries(form.entries());
    const endpoint = `${apiBaseUrl}/api/performance/post`;

    try {
      const result = await fetchWithAuth(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!result.ok) {
        console.log("terjadi kesalahan", result);
      }

      e.target.reset();
      handleGetData();
      document.getElementById("createPerformance").closest("dialog").close();
    } catch (error) {
      console.log("terjadi masalah", error.message);
      document.getElementById("createPerformance").closest("dialog").close();
    }
  };

  const handleDelete = async (id) => {
    const endpoint = `${apiBaseUrl}/api/performance/delete/${id}`;

    const isConfirm = confirm("Apakah anda yakin ingin menghapus data ini?");

    if (!isConfirm) {
      return;
    }
    try {
      const result = await fetchWithAuth(endpoint, {
        method: "DELETE",
      });

      if (result.status !== 200) {
        console.log("terjadi kesalahan", result);
      }
      handleGetData();
    } catch (error) {
      console.log("terjadi masalah", error.message);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await handleGetData();
    };

    loadData();
  }, []);
  return (
    <div className=" w-[100vw] h-[100%] p-4">
      <div className="w-full flex justify-between items-center">
        <h1 className="text-2xl font-bold">Performance</h1>
        <div>
          <div className="flex gap-2">
            <button
              onClick={() =>
                document.getElementById("createPerformance").showModal()
              }
              className="btn btn-primary"
            >
              create
            </button>

            <Link className="btn btn-primary" href="/dashboard/performance">
              Dashboard
            </Link>
          </div>
        </div>
      </div>

      <div>
        <div>
          <table className="table">
            <thead>
              <tr>
                <th>Quarter</th>
                <th>Nik</th>
                <th>Employee</th>
                <th>Status</th>
                <th>Desc</th>
                <th>Act</th>
              </tr>
            </thead>
            <tbody>
              {performData?.data?.map((item) => {
                return (
                  <tr key={item.id}>
                    <td>{item.quarter}</td>
                    <td>{item.users.nik}</td>
                    <td>{item.users.name}</td>
                    <td>{item.status}</td>
                    <td>{item.description}</td>
                    <td className="flex gap-2">
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="btn btn-danger"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Open the modal using document.getElementById('ID').showModal() method */}

      <dialog id="createPerformance" className="modal">
        <div className="modal-box">
          <div className="modal-action">
            <PerformanceForm onSubmit={handleSubmit} />
          </div>
        </div>
      </dialog>
    </div>
  );
}
