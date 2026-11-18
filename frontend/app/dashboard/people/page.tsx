"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { WorkspaceHero } from "@/components/admin/Workspace";
import PageLoading from "@/components/admin/PageLoading";
import { useShell } from "@/components/admin/shell/ShellContext";
import Select from "@/components/Select";
import { apiErr, peopleApi } from "@/lib/adminApi";
import { dialog } from "@/lib/dialog";
import { indiaToday } from "@/lib/socialWorkflow";
import type { Employee, Leave, PayrollRow, PeopleMonth } from "@/lib/peopleTypes";
import "./people.css";

const tabs = ["Employees", "Leave management", "Salary calculation", "Rules"] as const;
type Tab = typeof tabs[number];
type Save = (run: () => Promise<unknown>, message: string, close?: () => void) => Promise<void>;
const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
const inr = (paise: number) => currency.format(paise / 100);
const displayDate = (day: string) => new Date(day + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const bases = [{ value: "calendar", label: "Actual calendar days" }, { value: "working", label: "Working days" }, { value: "fixed30", label: "Fixed 30 days" }];
const formData = (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  return new FormData(event.currentTarget);
};
const string = (form: FormData, key: string) => String(form.get(key) ?? "");
const paise = (form: FormData, key: string) => Math.round(Number(form.get(key)) * 100);
const amountProps = { type: "number", min: 0, max: 10000000, step: "0.01", required: true } as const;

function Panel({ title, detail, action, children }: { title: string; detail?: string; action?: ReactNode; children: ReactNode }) {
  return <section className="people-panel">
    <header className="fw-section-title people-panel-head"><div><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{action}</header>
    {children}
  </section>;
}

function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return <div className="people-table"><table><thead><tr>{headers.map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}

function EmployeeEditor({ row, busy, save, close }: { row?: Employee; busy: boolean; save: Save; close: () => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    const form = formData(event);
    void save(() => peopleApi.employee({
      name: string(form, "name"), title: string(form, "title"), startsOn: string(form, "startsOn"),
      endsOn: string(form, "endsOn") || null, salary: paise(form, "salary"),
    }, row?.id), row ? "Employee updated." : "Employee added.", close);
  }
  return <form onSubmit={submit}>
    <fieldset className="people-fields" disabled={busy}>
      <label className="adm-field">Employee name<input name="name" autoFocus required maxLength={120} defaultValue={row?.name} /></label>
      <label className="adm-field">Job title<input name="title" maxLength={120} defaultValue={row?.title} /></label>
      <label className="adm-field">Joining date<input type="date" name="startsOn" required defaultValue={row?.startsOn || indiaToday()} /></label>
      <label className="adm-field">Last working date <small>(optional)</small><input type="date" name="endsOn" defaultValue={row?.endsOn || ""} /></label>
      <label className="adm-field">Monthly salary (₹)<input name="salary" {...amountProps} defaultValue={row ? row.salary / 100 : undefined} /></label>
      <p className="fw-caption">Salary edits apply to draft months. Finalized payroll keeps its recorded amounts.</p>
      <div className="people-actions people-wide"><button className="sh-btn pri" type="submit">Save employee</button><button className="sh-btn" type="button" onClick={close}>Cancel</button></div>
    </fieldset>
  </form>;
}

function LeaveEditor({ data, busy, save, close }: { data: PeopleMonth; busy: boolean; save: Save; close: () => void }) {
  const [person, setPerson] = useState(String(data.employees[0]?.id || ""));
  const [kind, setKind] = useState("paid");
  function submit(event: FormEvent<HTMLFormElement>) {
    const form = formData(event);
    void save(() => peopleApi.recordLeave({
      employeeId: Number(person), from: string(form, "from"), to: string(form, "to"),
      kind: kind as Leave["kind"], half: form.has("half"), reason: string(form, "reason"),
    }), "Leave added for review.", close);
  }
  return <form onSubmit={submit}>
    <fieldset className="people-fields" disabled={busy}>
      <div className="adm-field"><label>Employee</label><Select ariaLabel="Employee" value={person} onChange={setPerson} disabled={busy} options={data.employees.map(row => ({ value: String(row.id), label: row.name }))} /></div>
      <div className="adm-field"><label>Leave type</label><Select ariaLabel="Leave type" value={kind} onChange={setKind} disabled={busy} options={[{ value: "paid", label: "Use paid leave allowance" }, { value: "unpaid", label: "Unpaid leave" }]} /></div>
      <label className="adm-field">From<input type="date" name="from" required defaultValue={data.month + "-01"} /></label>
      <label className="adm-field">To<input type="date" name="to" required defaultValue={data.month + "-01"} /></label>
      <label className="adm-field">Reason<input name="reason" required maxLength={255} /></label>
      <label className="people-check"><input type="checkbox" name="half" /> Half day on one date</label>
      <div className="people-actions people-wide"><button className="sh-btn pri" type="submit">Add to review</button><button className="sh-btn" type="button" onClick={close}>Cancel</button></div>
    </fieldset>
  </form>;
}

function RulesEditor({ data, busy, save }: { data: PeopleMonth; busy: boolean; save: Save }) {
  const [holidays, setHolidays] = useState(data.rules.holidays);
  const [holiday, setHoliday] = useState("");
  const disabled = busy || !!data.finalizedAt;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save(() => peopleApi.rules(data.month, { holidays }), "Monthly holidays saved.");
  }
  return <Panel title="Monthly rules" detail={data.rules.paidLeaveDays == null ? "Rules recorded when this payroll was finalized." : "Each employee gets one paid leave day per month, up to 12 per year. Unused days expire at month end."}>
    <dl className="people-breakdown">
      <div><dt>Salary basis</dt><dd>{bases.find(basis => basis.value === data.rules.basis)?.label}</dd></div>
      <div><dt>Weekly days off</dt><dd>{data.rules.weeklyOff.map(day => weekdayNames[day]).join(", ") || "None"}</dd></div>
      {data.rules.paidLeaveDays != null && <div><dt>Monthly paid leave</dt><dd>{data.rules.paidLeaveDays} day</dd></div>}
    </dl>
    <form onSubmit={submit}><fieldset className="people-fields" disabled={disabled}>
      <div className="adm-field people-wide"><label htmlFor="people-holiday">Holidays in this month</label>
        <div className="people-actions"><input id="people-holiday" type="date" value={holiday} min={data.month + "-01"} onChange={event => setHoliday(event.target.value)} />
          <button type="button" className="sh-btn" disabled={!holiday.startsWith(data.month + "-") || holidays.includes(holiday)} onClick={() => { setHolidays([...holidays, holiday].sort()); setHoliday(""); }}>Add holiday</button></div>
        {holidays.length > 0 && <ul className="people-holidays">{holidays.map(day => <li key={day}>{displayDate(day)} {!disabled && <button type="button" className="sh-btn sm" aria-label={`Remove ${displayDate(day)}`} onClick={() => setHolidays(holidays.filter(date => date !== day))}>Remove</button>}</li>)}</ul>}
      </div>
      {!data.finalizedAt && <div className="people-wide"><button className="sh-btn pri" type="submit">Save holidays</button></div>}
    </fieldset></form>
  </Panel>;
}

function SalaryDetail({ row, data, save, busy }: { row: PayrollRow; data: PeopleMonth; save: Save; busy: boolean }) {
  const lines = [
    ["Monthly salary", inr(row.salary)], ["Day basis", row.divisor], ["Eligible days", row.eligible],
    ["Paid leave days used", row.paidDays], ["Unpaid leave days", row.unpaidDays],
    ...(data.rules.paidLeaveDays != null ? [["Paid leave days remaining", Math.max(0, data.rules.paidLeaveDays - row.paidDays)]] : []),
    ["Earned salary", inr(row.earned)], ["Unpaid leave deduction", inr(row.unpaidDeduction)],
    ["Bonus / additions", inr(row.bonus)], ["Advance / other deductions", inr(row.deduction)],
    ["Net salary", inr(row.net)],
  ];
  function submit(event: FormEvent<HTMLFormElement>) {
    const form = formData(event);
    void save(() => peopleApi.adjustment(data.month, row.employeeId, { bonus: paise(form, "bonus"), deduction: paise(form, "deduction"), note: string(form, "note") }), "Salary adjustments saved.");
  }
  return <Panel title={`${row.name} · Salary breakdown`} detail={row.note || undefined}>
    <dl className="people-breakdown">{lines.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {!data.finalizedAt && <form onSubmit={submit}><fieldset className="people-fields" disabled={busy}>
      <label className="adm-field">Bonus / additions (₹)<input name="bonus" {...amountProps} defaultValue={row.bonus / 100} /></label>
      <label className="adm-field">Advance / other deductions (₹)<input name="deduction" {...amountProps} defaultValue={row.deduction / 100} /></label>
      <label className="adm-field">Reason for adjustment<input name="note" maxLength={255} defaultValue={row.note} /></label>
      <div className="people-actions"><button className="sh-btn pri" type="submit">Save adjustments</button></div>
    </fieldset></form>}
  </Panel>;
}

function PeopleWorkspace({ month, changeMonth, tab, setTab }: { month: string; changeMonth: (month: string) => void; tab: Tab; setTab: (tab: Tab) => void }) {
  const [data, setData] = useState<PeopleMonth | null>(null);
  const [editing, setEditing] = useState<Employee | "new" | null>(null);
  const [recording, setRecording] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    peopleApi.month(month).then(value => { if (active) setData(value); })
      .catch(error => { if (active) setError(apiErr(error).message); });
    return () => { active = false; };
  }, [month, attempt]);

  const save: Save = async (run, success, close) => {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await run();
      close?.();
      setMessage(success);
      try { setData(await peopleApi.month(month)); }
      catch { setData(null); setError("Saved. Reload this month to see the updated figures."); }
    } catch (error) {
      const failure = apiErr(error);
      if (failure.status === 403) setData(null);
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  const row = data?.rows.find(item => item.employeeId === selected) || data?.rows[0];
  const locked = !!data?.finalizedAt;
  const names = new Map(data?.employees.map(employee => [employee.id, employee.name]));
  const review = async (leave: Leave, status: "approved" | "rejected" | "cancelled") => {
    if (status === "cancelled" && !await dialog.confirm({ title: "Cancel approved leave?", message: "This removes the leave from draft salary calculations.", confirmText: "Cancel leave" })) return;
    await save(() => peopleApi.reviewLeave(leave.id, status), `Leave ${status}.`);
  };
  const finalize = async () => {
    if (await dialog.confirm({ title: `Finalize payroll for ${month}?`, message: "This locks the month’s salary figures, adjustments, leave and rules.", confirmText: "Finalize payroll" })) {
      await save(() => peopleApi.finalize(month), "Payroll finalized.");
    }
  };
  return <div className="fw-workspace">
    <WorkspaceHero eyebrow="Admin only" title="People" description="Manage employees, review leave and calculate monthly salary."
      actions={<label className="adm-field">Payroll month<input type="month" value={month} min="2000-01" max="9999-12" disabled={busy} onChange={event => { if (event.target.value) changeMonth(event.target.value); }} /></label>} />
    {error && <div role="alert" className="fw-error">{error}{!data && <button type="button" onClick={() => { setError(""); setAttempt(value => value + 1); }}>Retry</button>}</div>}
    {message && <p className="fw-caption" role="status">{message}</p>}
    {!data && !error && <PageLoading label="Loading People…" variant="list" />}
    {data && <>
      <nav className="people-actions" aria-label="People sections">{tabs.map(value => <button key={value} type="button" className={`sh-btn${tab === value ? " pri" : ""}`} aria-pressed={tab === value} disabled={busy} onClick={() => { setTab(value); setMessage(""); setError(""); }}>{value}</button>)}</nav>
      {locked && <p className="fw-caption">Payroll finalized for {month}. Salary figures and rules are locked.</p>}
      {tab === "Employees" && <Panel title="Employees" detail="Employee records are separate from Finvera sign-in accounts." action={<button type="button" className="sh-btn pri" disabled={busy} onClick={() => setEditing("new")}>Add employee</button>}>
        {editing && <EmployeeEditor key={editing === "new" ? "new" : editing.id} row={editing === "new" ? undefined : editing} busy={busy} save={save} close={() => setEditing(null)} />}
        {data.employees.length ? <Table headers={["Employee", "Joining date", "Last working date", "Monthly salary", "Action"]}>{data.employees.map(employee => <tr key={employee.id}>
          <td><strong>{employee.name}</strong>{employee.title && <small>{employee.title}</small>}</td>
          <td>{displayDate(employee.startsOn)}</td><td>{employee.endsOn ? displayDate(employee.endsOn) : "—"}</td><td>{inr(employee.salary)}</td>
          <td><button type="button" className="sh-btn sm" disabled={busy} aria-label={`Edit ${employee.name}`} onClick={() => setEditing(employee)}>Edit</button></td>
        </tr>)}</Table> : !editing && <p className="people-empty">Add the first employee to start tracking leave and salary.</p>}
      </Panel>}
      {tab === "Leave management" && <Panel title="Leave register" detail={data.rules.paidLeaveDays == null ? "Leave records for this finalized month." : "Approved leave marked for the paid allowance uses up to one day per month. Additional days and explicitly unpaid leave reduce draft salary."} action={!locked && <button type="button" className="sh-btn pri" disabled={busy || !data.employees.length} onClick={() => setRecording(true)}>Record leave</button>}>
        {recording && !locked && <LeaveEditor data={data} busy={busy} save={save} close={() => setRecording(false)} />}
        {data.leaves.length ? <Table headers={["Employee", "Leave", "Days this month", "Status", "Review"]}>{data.leaves.map(leave => <tr key={leave.id}>
          <td><strong>{names.get(leave.employeeId)}</strong></td>
          <td><strong>{leave.kind === "paid" ? (data.rules.paidLeaveDays == null ? "Paid" : "Paid allowance") : "Unpaid"}{leave.half ? " · Half day" : ""}</strong><small>{displayDate(leave.from)}{leave.to !== leave.from && ` – ${displayDate(leave.to)}`}</small><small>{leave.reason}</small></td>
          <td>{leave.days}</td><td className="people-status">{leave.status}{leave.reviewedAt && <small>{displayDate(leave.reviewedAt.slice(0, 10))}</small>}</td>
          <td>{!locked && leave.status === "pending" ? <div className="people-actions">
            <button type="button" className="sh-btn sm pri" disabled={busy} onClick={() => void review(leave, "approved")}>Approve</button>
            <button type="button" className="sh-btn sm" disabled={busy} onClick={() => void review(leave, "rejected")}>Reject</button>
          </div> : !locked && leave.status === "approved" ? <button type="button" className="sh-btn sm" disabled={busy} onClick={() => void review(leave, "cancelled")}>Cancel leave</button> : "—"}</td>
        </tr>)}</Table> : <p className="people-empty">No leave recorded for this month.</p>}
      </Panel>}
      {tab === "Salary calculation" && <>
        <Panel title={locked ? "Finalized payroll" : "Monthly salary draft"} detail={`Total ${inr(data.rows.reduce((sum, item) => sum + item.net, 0))} · ${data.rows.length} employees`}
          action={!locked && <button type="button" className="sh-btn pri" disabled={busy || month >= indiaToday().slice(0, 7) || !data.rows.length} onClick={() => void finalize()}>Finalize payroll</button>}>
          {data.rows.length ? <Table headers={["Employee", "Earned", "Unpaid leave", "Net salary", "Breakdown"]}>{data.rows.map(item => <tr key={item.employeeId}>
            <td><strong>{item.name}</strong></td><td>{inr(item.earned)}</td><td>{inr(item.unpaidDeduction)}</td><td><strong>{inr(item.net)}</strong></td>
            <td><button type="button" className="sh-btn sm" aria-pressed={row?.employeeId === item.employeeId} disabled={busy} onClick={() => setSelected(item.employeeId)}>View details</button></td>
          </tr>)}</Table> : <p className="people-empty">No employees were employed during this month.</p>}
          <p className="people-empty">Finalize after the month ends and pending leave is reviewed. Statutory deductions and tax are entered manually when applicable.</p>
        </Panel>
        {row && <SalaryDetail key={row.employeeId} row={row} data={data} save={save} busy={busy} />}
      </>}
      {tab === "Rules" && <RulesEditor data={data} save={save} busy={busy} />}
    </>}
  </div>;
}

export default function PeoplePage() {
  const { roles, rolesReady } = useShell();
  const [month, setMonth] = useState(() => indiaToday().slice(0, 7));
  const [tab, setTab] = useState<Tab>("Employees");
  if (!rolesReady) return <PageLoading label="Checking People access…" variant="list" />;
  if (!roles.includes("admin")) return <p role="alert" className="fw-error">Only administrators can access People.</p>;
  return <PeopleWorkspace key={month} month={month} changeMonth={setMonth} tab={tab} setTab={setTab} />;
}
