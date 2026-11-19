"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import PageLoading from "@/components/admin/PageLoading";
import Select from "@/components/Select";
import { apiErr, peopleApi } from "@/lib/adminApi";
import { dialog } from "@/lib/dialog";
import { ROLE_LABELS } from "@/lib/permissions";
import type { EmployeeLinks, EmployeeLinkSelection } from "@/lib/peopleTypes";

type Person = EmployeeLinks["employees"][number];
const unlinked = { userId: null, teamMemberId: null };
const nameKey = (name: string) => name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
const selectionId = (value: string) => Number(value) || null;

function nameSuggestions<T extends { id: number; name: string }>(person: Person, employees: Person[], candidates: T[]) {
  const key = nameKey(person.name);
  if (!key || employees.filter(employee => nameKey(employee.name) === key).length > 1) return [];
  return candidates.filter(candidate => nameKey(candidate.name) === key);
}

function LinkEditor({ data, person, original, busy, save, createTeamProfile }: {
  data: EmployeeLinks;
  person: Person;
  original: EmployeeLinkSelection;
  busy: boolean;
  save: (next: EmployeeLinkSelection, expected: EmployeeLinkSelection) => Promise<void>;
  createTeamProfile: () => Promise<void>;
}) {
  const [userId, setUserId] = useState(original.userId);
  const [teamMemberId, setTeamMemberId] = useState(original.teamMemberId);
  const occupied = data.links.filter(link => link.employeeId !== person.id);
  const users = data.users.filter(user => !occupied.some(link => link.userId === user.id));
  const profiles = data.profiles.filter(profile => !occupied.some(link => link.teamMemberId === profile.id));
  const userMatches = original.userId == null ? nameSuggestions(person, data.employees, users) : [];
  const teamMatches = original.teamMemberId == null ? nameSuggestions(person, data.employees, profiles) : [];
  const duplicateName = data.employees.some(employee => employee.id !== person.id && nameKey(employee.name) === nameKey(person.name));
  const changed = userId !== original.userId || teamMemberId !== original.teamMemberId;
  const userLabel = (user: EmployeeLinks["users"][number]) => `${user.name} · ${user.email}${user.active ? "" : " · inactive"}`;
  const profileLabel = (profile: EmployeeLinks["profiles"][number]) => `${profile.name}${profile.role ? " · " + profile.role : ""} · ${profile.status} · #${profile.id}`;
  const selectedUser = users.find(user => user.id === userId);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (changed && !busy) void save({ userId, teamMemberId }, original);
  }
  return <form onSubmit={submit}>
    <fieldset className="people-fields" disabled={busy}>
      {duplicateName && <p className="fw-caption people-wide">Several employees share this name. Review the employee ID and the login email before linking.</p>}
      <div className="adm-field">
        <label htmlFor="people-link-user">Finvera login</label>
        <Select id="people-link-user" ariaLabel="Finvera login" disabled={busy} value={String(userId ?? "")} onChange={value => setUserId(selectionId(value))}
          options={[{ value: "", label: "No linked login" }, ...users.map(user => ({ value: String(user.id), label: userLabel(user) }))]} />
        {selectedUser && <p className="fw-caption">Roles: {selectedUser.roles.map(role => ROLE_LABELS[role] || role).join(", ") || "None"}</p>}
        {userMatches.length === 1 && userId == null && <div className="people-link-match"><p className="fw-caption">Suggested by name: {userLabel(userMatches[0])}</p><button className="sh-btn sm" type="button" onClick={() => setUserId(userMatches[0].id)}>Select suggested login</button></div>}
        {userMatches.length > 1 && <p className="fw-caption">{userMatches.length} logins match this name. Compare their email addresses before selecting.</p>}
      </div>
      <div className="adm-field">
        <label htmlFor="people-link-team">Website team profile</label>
        <Select id="people-link-team" ariaLabel="Website team profile" disabled={busy} value={String(teamMemberId ?? "")} onChange={value => setTeamMemberId(selectionId(value))}
          options={[{ value: "", label: "No linked website profile" }, ...profiles.map(profile => ({ value: String(profile.id), label: profileLabel(profile) }))]} />
        {teamMatches.length === 1 && teamMemberId == null && <div className="people-link-match"><p className="fw-caption">Suggested by name: {profileLabel(teamMatches[0])}</p><button className="sh-btn sm" type="button" onClick={() => setTeamMemberId(teamMatches[0].id)}>Select suggested profile</button></div>}
        {teamMatches.length > 1 && <p className="fw-caption">{teamMatches.length} profiles match this name. Review them in Website Team before selecting.</p>}
        {original.teamMemberId && <div><Link className="sh-btn sm" href={`/dashboard/team?profile=${original.teamMemberId}`}>Open linked profile</Link></div>}
        {!original.teamMemberId && teamMemberId == null && <div>
          <button type="button" className="sh-btn sm" disabled={busy || changed} onClick={() => void createTeamProfile()}>Create team profile</button>
          {changed && <p className="fw-caption">Save your link changes before creating a profile.</p>}
        </div>}
      </div>
      <div className="people-actions people-wide">
        <button type="submit" className="sh-btn pri" disabled={!changed || busy}>{busy ? "Saving…" : "Save links"}</button>
        <Link className="sh-btn" href="/dashboard/users">Users & Access</Link>
        <Link className="sh-btn" href="/dashboard/team">Website Team</Link>
      </div>
    </fieldset>
  </form>;
}

export default function RecordLinks() {
  const [data, setData] = useState<EmployeeLinks | null>(null);
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    peopleApi.links().then(value => { if (active) setData(value); })
      .catch(failure => { if (active) setError(apiErr(failure).message); });
    return () => { active = false; };
  }, [attempt]);
  const person = data?.employees.find(employee => employee.id === employeeId) || data?.employees[0];
  const original = data?.links.find(link => link.employeeId === person?.id);
  function reload() {
    setMessage("");
    setError("");
    setData(null);
    setAttempt(value => value + 1);
  }
  async function save(next: EmployeeLinkSelection, expected: EmployeeLinkSelection) {
    if (!person || busy) return;
    setError("");
    setMessage("");
    setBusy(true);
    try {
      // Send only association IDs, even when the current row includes its employee ID.
      await peopleApi.saveLinks(person.id, next, { userId: expected.userId, teamMemberId: expected.teamMemberId });
      setData(current => current && ({
        ...current, links: [...current.links.filter(link => link.employeeId !== person.id), { employeeId: person.id, ...next }],
      }));
      setMessage("Employee links saved.");
    } catch (failure) {
      const err = apiErr(failure);
      if (err.status === 403) setData(null);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function createTeamProfile() {
    if (!person || busy || original?.teamMemberId) return;
    const confirmed = await dialog.confirm({
      title: `Create a team profile for ${person.name}?`,
      message: "Finvera will use their name and job title to create a linked private draft. You can add a photo and bio in Website Team.",
      confirmText: "Create draft profile",
    });
    if (!confirmed) return;
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const { profile, link } = await peopleApi.createTeamProfile(person.id);
      setData(current => current && ({
        ...current,
        profiles: [...current.profiles, profile],
        links: [...current.links.filter(entry => entry.employeeId !== person.id), link],
      }));
      setMessage("Draft team profile created and linked.");
    } catch (failure) {
      const err = apiErr(failure);
      if (err.status === 403) setData(null);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return <section className="people-panel">
    <header className="fw-section-title people-panel-head">
      <div><h2>Record links</h2><p>Connect an employee to their login and website profile. Review name matches before saving.</p></div>
      <button type="button" className="sh-btn" onClick={reload} disabled={busy}>Reload links</button>
    </header>
    {error && <p role="alert" className="fw-error">{error}</p>}
    {message && <p role="status" className="people-empty">{message}</p>}
    {!data && !error && <PageLoading label="Loading record links…" variant="form" count={3} />}
    {data && !person && <p className="people-empty">Add an employee in the Employees tab to create a link.</p>}
    {data && person && <>
      <div className="people-fields"><div className="adm-field">
        <label htmlFor="people-link-employee">Employee</label>
        <Select id="people-link-employee" ariaLabel="Employee" disabled={busy} value={String(person.id)}
          onChange={value => { setEmployeeId(selectionId(value)); setError(""); setMessage(""); }}
          options={data.employees.map(employee => {
            const link = data.links.find(link => link.employeeId === employee.id);
            const count = Number(!!link?.userId) + Number(!!link?.teamMemberId);
            return { value: String(employee.id), label: `${employee.name}${employee.title ? " · " + employee.title : ""} · #${employee.id} · ${count}/2 linked` };
          })} />
      </div></div>
      <LinkEditor key={`${person.id}:${original?.userId}:${original?.teamMemberId}`} data={data} person={person} original={original || unlinked} busy={busy} save={save} createTeamProfile={createTeamProfile} />
    </>}
  </section>;
}
