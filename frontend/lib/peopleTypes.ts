export type Employee = {
  id: number;
  name: string;
  title: string;
  startsOn: string;
  endsOn: string | null;
  salary: number;
};
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";
export type Leave = {
  id: number;
  employeeId: number;
  from: string;
  to: string;
  kind: "paid" | "unpaid";
  half: boolean;
  reason: string;
  status: LeaveStatus;
  days: number;
  reviewedAt: string | null;
};
export type PayrollRules = {
  basis: "calendar" | "working" | "fixed30";
  weeklyOff: number[];
  holidays: string[];
  paidLeaveDays?: number;
};
export type PayrollAdjustment = { bonus: number; deduction: number; note: string };
export type PayrollRow = PayrollAdjustment & {
  employeeId: number;
  name: string;
  salary: number;
  divisor: number;
  eligible: number;
  paidDays: number;
  unpaidDays: number;
  earned: number;
  unpaidDeduction: number;
  net: number;
};
export type PeopleMonth = {
  month: string;
  employees: Employee[];
  leaves: Leave[];
  rules: PayrollRules;
  rows: PayrollRow[];
  finalizedAt: string | null;
};
