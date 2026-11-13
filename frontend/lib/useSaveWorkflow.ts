"use client";
import { useCallback, useState } from "react";
import { saveTransition, type SaveState } from "./editorMachine";
import type { Update } from "./dialogMachine";

export function useSaveWorkflow<E = string>(initialError: E = "" as E) {
  const [state, setState] = useState<SaveState<E>>({ activity: "idle", outcome: "none", error: initialError });
  const setSaving = useCallback((update: Update<boolean>) => setState(current => saveTransition(current, { type: "ACTIVITY", saving: typeof update === "function" ? update(current.activity === "saving") : update })), []);
  const setError = useCallback((update: Update<E>) => setState(current => saveTransition(current, { type: "ERROR", error: typeof update === "function" ? (update as (error: E) => E)(current.error) : update })), []);
  const setConflict = useCallback((update: Update<boolean>) => setState(current => saveTransition(current, { type: "CONFLICT", value: typeof update === "function" ? update(current.outcome === "conflict") : update })), []);
  return { saving: state.activity === "saving", error: state.error, conflict: state.outcome === "conflict", setSaving, setError, setConflict };
}
