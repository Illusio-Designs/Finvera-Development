"use client";
import { useCallback, useState } from "react";
import { dialogValue, updateDialog, importTeamValue, updateImport, type BusyDialog, type ImportWizard, type Update } from "./dialogMachine";

export function useWorkflowDialog<T extends { busy: boolean }>(): [T | null, (update: Update<T | null>) => void] {
  const [state, setState] = useState<BusyDialog<T>>({ phase: "closed" });
  const update = useCallback((value: Update<T | null>) => setState(current => updateDialog(current, value)), []);
  return [dialogValue(state), update];
}
export function useImportWizard<B, T extends { busy: boolean }>() {
  const [state, setState] = useState<ImportWizard<B, T>>({ phase: "closed" });
  const setBrand = useCallback((update: Update<B | null>) => setState(current => updateImport(current, { kind: "brand", update })), []);
  const setTeam = useCallback((update: Update<T | null>) => setState(current => updateImport(current, { kind: "team", update })), []);
  return { brand: state.phase === "brand" ? state.data : null, team: importTeamValue(state), setBrand, setTeam };
}
