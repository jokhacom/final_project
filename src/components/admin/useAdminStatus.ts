"use client";

import { useEffect, useState } from "react";

export type LevelStatus = { id: string; choice: number; open: number; total: number; ready: boolean; balanced: boolean };
export type AdminStatus = {
  superadmin: boolean;
  employees: number;
  materials: number;
  pendingReviews: number;
  levels: LevelStatus[];
  ai: { provider: string; configured: boolean; chain: string[]; keyEnv: string; gradingMode: "ai" | "keyword" };
  email: boolean;
};

export function useAdminStatus(deps: unknown[] = []) {
  const [status, setStatus] = useState<AdminStatus | null>(null);
  useEffect(() => {
    fetch("/api/admin/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return status;
}
