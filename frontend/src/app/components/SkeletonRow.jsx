"use client";
import { useAppSettings } from "@/lib/useAppSettings";

/* Skeleton cell widths to vary per column position */
const WIDTHS = ["w-12", "w-32", "w-20", "w-16", "w-14", "w-16", "w-8"];

export function SkeletonRow({ cols = 7, p: pProp }) {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { p: pCtx } = useAppSettings();
  const p = pProp || pCtx;

  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-5 py-4">
          <div
            className={`h-3 rounded-full ${WIDTHS[i % WIDTHS.length]} skeleton-pulse`}
            style={{ background: p.border2 }}
          />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonTable({ rows = 6, cols = 7 }) {
  const { p } = useAppSettings();
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} cols={cols} p={p} />
      ))}
    </>
  );
}
