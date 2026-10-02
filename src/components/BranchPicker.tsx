"use client";

import { useEffect, useState } from "react";
import { format } from "@/i18n/dictionaries";
import type { BranchInfo } from "@/lib/menu-types";
import { haptic } from "@/lib/telegram";
import { useDetectLocation } from "@/lib/use-branch";
import { useI18n } from "./Providers";

type Props = { branches: BranchInfo[]; current: BranchInfo; onSelect: (id: string) => void; className?: string };

/** "Branch: X ▾" chip opening a sheet with all branches. Renders nothing when there's only one branch. */
export function BranchPicker({ branches, current, onSelect, className = "" }: Props) {
  const { dict } = useI18n();
  const [open, setOpen] = useState(false);
  const { status, detect, distanceTo } = useDetectLocation(branches);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (branches.length < 2) return null;

  const sorted = [...branches].sort((a, b) => (distanceTo(a) ?? 0) - (distanceTo(b) ?? 0));
  const nearestId = distanceTo(sorted[0]) !== null ? sorted[0].id : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex items-center gap-2 rounded-full bg-surface px-3 py-2 text-sm ring-1 ring-line hover:ring-text/30 ${className}`}
      >
        <PinIcon />
        <span className="text-muted">{dict.branch.title}:</span>
        <span className="font-semibold">{current.name}</span>
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-muted" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={dict.branch.choose}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl bg-bg p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-3xl"
          >
            <h2 className="px-1 pb-3 text-lg font-extrabold">{dict.branch.choose}</h2>
            <ul className="space-y-2">
              {sorted.map((b) => {
                const km = distanceTo(b);
                const selected = b.id === current.id;
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(b.id);
                        haptic();
                        setOpen(false);
                      }}
                      aria-pressed={selected}
                      className={`w-full rounded-2xl bg-surface p-4 text-left ring-1 transition-shadow ${
                        selected ? "ring-2 ring-accent" : "ring-line hover:ring-text/30"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{b.name}</span>
                        {km !== null && (
                          <span className="text-sm text-muted tabular-nums">
                            {b.id === nearestId && <span className="mr-1 text-accent">{dict.branch.nearest} ·</span>}
                            {format(dict.branch.km, { n: km.toFixed(1) })}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-sm text-muted">{b.address}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={async () => {
                if (await detect()) setOpen(false);
              }}
              disabled={status === "loading"}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-accent hover:bg-accent-soft disabled:opacity-60"
            >
              <PinIcon />
              {status === "loading" ? dict.branch.detecting : dict.branch.detect}
            </button>
            {(status === "denied" || status === "unavailable") && (
              <p className="px-1 text-center text-sm text-danger">{dict.branch[status]}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function PinIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}
