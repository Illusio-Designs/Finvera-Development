"use client";
import { useCallback, useState } from "react";
import type { Update } from "./dialogMachine";
export function useActivity(initial = false): [boolean, (update: Update<boolean>) => void] {
  const [phase, setPhase] = useState<"idle" | "running">(initial ? "running" : "idle");
  const update = useCallback((value: Update<boolean>) => setPhase(current => (typeof value === "function" ? value(current === "running") : value) ? "running" : "idle"), []);
  return [phase === "running", update];
}
