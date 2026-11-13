"use client";
import { useCallback, useState } from "react";
import { resourceTransition, resourcePhase, type ResourceState } from "./resourceMachine";
import type { Update } from "./dialogMachine";
export function useResourceState<T, E = string>(initialData: T, initialLoading = true, initialError: E = "" as E) {
  const [state, setState] = useState<ResourceState<T, E>>({ data: initialData, request: initialLoading ? "loading" : "idle", error: initialError });
  const setData = useCallback((update: Update<T>) => setState(current => resourceTransition(current, { type: "DATA", data: typeof update === "function" ? (update as (data: T) => T)(current.data) : update })), []);
  const setError = useCallback((update: Update<E>) => setState(current => resourceTransition(current, { type: "ERROR", error: typeof update === "function" ? (update as (error: E) => E)(current.error) : update })), []);
  const setLoading = useCallback((update: Update<boolean>) => setState(current => resourceTransition(current, { type: "LOADING", value: typeof update === "function" ? update(["loading", "both"].includes(current.request)) : update })), []);
  const setMore = useCallback((update: Update<boolean>) => setState(current => resourceTransition(current, { type: "MORE", value: typeof update === "function" ? update(["more", "both"].includes(current.request)) : update })), []);
  return { data: state.data, error: state.error, loading: ["loading", "both"].includes(state.request), more: ["more", "both"].includes(state.request), phase: resourcePhase(state), setData, setError, setLoading, setMore };
}
