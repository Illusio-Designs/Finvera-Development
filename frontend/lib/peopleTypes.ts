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

export type EmployeeLinkSelection = { userId: number | null; teamMemberId: number | null };
export type EmployeeLinks = {
  employees: Pick<Employee, "id" | "name" | "title" | "endsOn">[];
  users: { id: number; name: string; email: string; roles: string[]; active: boolean }[];
  profiles: { id: number; name: string; role: string | null; status: "draft" | "published" }[];
  links: (EmployeeLinkSelection & { employeeId: number })[];
};

type ExistingRecord = { mode: "existing"; id: number };
type SkipRecord = { mode: "none" };
export type EmployeeOnboardingInput = Omit<Employee, "id"> & {
  login: ExistingRecord | SkipRecord | { mode: "create"; email: string; roles: string[]; brandIds: number[] };
  team: ExistingRecord | SkipRecord | { mode: "create"; name: string; role: string; bio: string; initials: string; photo: string };
};
export type EmployeeOnboardingResult = EmployeeLinkSelection & {
  employeeId: number;
  invite: { link: string; email: string; expiresAt: string } | null;
};
