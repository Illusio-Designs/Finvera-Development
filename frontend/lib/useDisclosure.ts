"use client";
import { useCallback, useState } from "react";
import { disclosureTransition, type DisclosureState } from "./presentationMachine";
import type { Update } from "./dialogMachine";
export function useDisclosure(initialOpen = false): [boolean, (update: Update<boolean>) => void] {
  const [state, setState] = useState<DisclosureState>(initialOpen ? "open" : "closed");
  const update = useCallback((value: Update<boolean>) => setState(current => disclosureTransition(current, (typeof value === "function" ? value(current === "open") : value) ? "OPEN" : "CLOSE")), []);
  return [state === "open", update];
}
