"use client";
import { useAppSettings } from "@/lib/useAppSettings";

/* Varying widths per column for realistic skeleton shape */
const WIDTHS = [
  ["w-12"],
  ["w-8", "w-28", "w-20", "w-16", "w-24", "w-10", "w-32"],
  ["w-20", "w-14", "w-24", "w-12", "w-18", "w-20", "w-10"],
];

function cellWidth(col, row) {
  return WIDTHS[(row + col) % WIDTHS.length][(col) % WIDTHS[0].length] || "w-16";
}

export function SkeletonRow({ cols = 7, rowIndex = 0, p: pProp }) {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { p: pCtx } = useAppSettings();
  const p = pProp || pCtx;

  return (
    <tr style={{ borderBottom: `1px solid ${p.border}` }}>
      {/* First col: avatar + line combo for name columns */}
      {cols >= 1 && (
        <td className="px-5 py-4">
          <div className="skeleton-pulse h-3 rounded-full w-12" />
        </td>
      )}
      {/* Second col: avatar circle + text lines */}
      {cols >= 2 && (
        <td className="px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="skeleton-pulse rounded-full shrink-0" style={{ width: 32, height: 32 }} />
            <div className="flex flex-col gap-1.5">
              <div className="skeleton-pulse h-2.5 rounded-full" style={{ width: 80 + (rowIndex % 3) * 20 }} />
              <div className="skeleton-pulse h-2 rounded-full" style={{ width: 48 }} />
            </div>
          </div>
        </td>
      )}
      {/* Remaining cols: simple bars with width variation */}
      {Array.from({ length: Math.max(0, cols - 2) }).map((_, i) => {
        const widths = [56, 72, 48, 64, 40, 80, 32];
        const w = widths[(i + rowIndex) % widths.length];
        return (
          <td key={i} className="px-5 py-4">
            <div className="skeleton-pulse h-3 rounded-full" style={{ width: w }} />
          </td>
        );
      })}
    </tr>
  );
}

export function SkeletonTable({ rows = 6, cols = 7 }) {
  const { p } = useAppSettings();
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} cols={cols} rowIndex={i} p={p} />
      ))}
    </>
  );
}
