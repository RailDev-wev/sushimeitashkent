"use client";

import { useState } from "react";
import { distanceKm } from "@/config/branches";
import { useCustomer, useLocationStore } from "./cart-store";
import type { BranchInfo, StopList } from "./menu-types";
import { requestLocation, type LocationResult } from "./telegram";

function nearest(branches: BranchInfo[], point: { lat: number; lng: number }) {
  return branches.reduce((best, b) => (distanceKm(point, b) < distanceKm(point, best) ? b : best));
}

/** Selected branch (falls back to the first one) and the items it has switched off. */
export function useBranch(branches: BranchInfo[], stopList: StopList) {
  const branchId = useCustomer((s) => s.branchId);
  const branch = branches.find((b) => b.id === branchId) ?? branches[0];
  const unavailable = new Set(stopList[branch.id] ?? []);
  const select = (id: string) => useCustomer.getState().update({ branchId: id, branchManual: true });
  return { branch, unavailable, select };
}

/**
 * Asks for the customer's location (Telegram-native in the Mini App). Unless the customer already
 * picked a branch by hand, the nearest one becomes selected.
 */
export function useDetectLocation(branches: BranchInfo[]) {
  const location = useLocationStore((s) => s.location);
  const [status, setStatus] = useState<"idle" | "loading" | Extract<LocationResult, { ok: false }>["reason"]>("idle");

  async function detect({ pickNearest = true } = {}) {
    setStatus("loading");
    const res = await requestLocation();
    if (!res.ok) {
      setStatus(res.reason);
      return null;
    }
    const point = { lat: res.lat, lng: res.lng };
    useLocationStore.getState().setLocation(point);
    const customer = useCustomer.getState();
    if (pickNearest && branches.length > 1) {
      // A deliberate "find nearest" overrides the manual choice; a passive detect doesn't.
      customer.update({ branchId: nearest(branches, point).id, branchManual: false });
    } else if (!customer.branchManual && branches.length > 1) {
      customer.update({ branchId: nearest(branches, point).id });
    }
    setStatus("idle");
    return point;
  }

  const distanceTo = (b: BranchInfo) => (location ? distanceKm(location, b) : null);
  return { location, status, detect, distanceTo };
}
