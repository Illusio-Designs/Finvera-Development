"use client";
import { createContext, useContext } from "react";
import type { Me } from "@/components/admin/UserMenu";

/* What the admin shell already knows, shared with pages so they don't
   ask again: who is signed in, their roles, and the latest sidebar counts
   (from the shell's /badges poll). `roles` is empty until known. */
export type Badges = {
  inboxUnread?: number; socialOverdue?: number; approvals?: number;
  leadsFollowUpToday?: number; leadsFollowUpOverdue?: number;
};
export type ShellState = { me: Me; roles: string[]; rolesReady: boolean; badges: Badges | null };

export const ShellContext = createContext<ShellState>({ me: null, roles: [], rolesReady: false, badges: null });
export const useShell = () => useContext(ShellContext);
