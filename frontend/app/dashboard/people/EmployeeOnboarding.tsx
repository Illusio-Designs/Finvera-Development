"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ShareLinkBox } from "@/components/admin/account/kit";
import PageLoading from "@/components/admin/PageLoading";
import DatePicker from "@/components/ui/DatePicker";
import Select from "@/components/Select";
import { api, apiErr, peopleApi } from "@/lib/adminApi";
import { ROLE_LABELS, ROLE_OPTIONS } from "@/lib/permissions";
import { indiaToday } from "@/lib/socialWorkflow";
import type { EmployeeLinks, EmployeeOnboardingInput, EmployeeOnboardingResult } from "@/lib/peopleTypes";

type Mode = "create" | "existing" | "none";
type Brand = { id: number; name: string };
type Save = (run: () => Promise<unknown>, message: string, close?: () => void) => Promise<void>;
const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export default function EmployeeOnboarding({ busy, save, close }: { busy: boolean; save: Save; close: () => void }) {
  const [lookups, setLookups] = useState<{ links: EmployeeLinks; brands: Brand[] } | null>(null);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [loginMode, setLoginMode] = useState<Mode>("create");
  const [teamMode, setTeamMode] = useState<Mode>("create");
  const [existingUser, setExistingUser] = useState("");
  const [existingTeam, setExistingTeam] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [invite, setInvite] = useState<EmployeeOnboardingResult["invite"]>(null);
  useEffect(() => {
    let active = true;
    Promise.all([peopleApi.links(), api.list("social-clients")])
      .then(([links, brands]) => { if (active) setLookups({ links, brands: Array.isArray(brands) ? brands : [] }); })
      .catch(error => { if (active) setLoadError(apiErr(error).message); });
    return () => { active = false; };
  }, [attempt]);

  if (invite) return <section className="people-fields">
    <div className="people-wide">
      <h3>Login setup link</h3>
      <p className="fw-caption">Share this link with {invite.email} so they can set their password.</p>
      <ShareLinkBox {...invite} emailed={false} kind="invite" />
      <button type="button" className="sh-btn pri" onClick={close}>Done</button>
    </div>
  </section>;
  if (loadError) return <div className="people-fields"><p role="alert" className="fw-error people-wide">{loadError}</p><div className="people-actions">
    <button type="button" className="sh-btn" onClick={() => { setLoadError(""); setAttempt(current => current + 1); }}>Retry</button>
    <button type="button" className="sh-btn" onClick={close}>Cancel</button>
  </div></div>;
  if (!lookups) return <PageLoading label="Loading employee setup…" variant="form" />;

  const { links, brands } = lookups;
  const users = links.users.filter(user => !links.links.some(link => link.userId === user.id));
  const profiles = links.profiles.filter(profile => !links.links.some(link => link.teamMemberId === profile.id));
  const incomplete = (loginMode === "create" && !roles.length) || (loginMode === "existing" && !existingUser) ||
    (teamMode === "existing" && !existingTeam);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || incomplete) return;
    const form = new FormData(event.currentTarget);
    const data: EmployeeOnboardingInput = {
      name: value(form, "name"), title: value(form, "title"), startsOn: value(form, "startsOn"),
      endsOn: value(form, "endsOn") || null, salary: Math.round(Number(form.get("salary")) * 100),
      login: loginMode === "create" ? { mode: "create", email: value(form, "email"), roles, brandIds: form.getAll("brand").map(Number) }
        : loginMode === "existing" ? { mode: "existing", id: Number(existingUser) } : { mode: "none" },
      team: teamMode === "create" ? {
        mode: "create", name: value(form, "publicName"), role: value(form, "publicRole"),
        bio: value(form, "bio"), initials: value(form, "initials"), photo: value(form, "photo"),
      } : teamMode === "existing" ? { mode: "existing", id: Number(existingTeam) } : { mode: "none" },
    };
    void save(async () => {
      const result = await peopleApi.onboard(data);
      if (result.invite) setInvite(result.invite);
      else close();
    }, "Employee setup saved.");
  }

  return <form onSubmit={submit}>
    <fieldset className="people-fields" disabled={busy}>
      <h3 className="people-wide">Employment & salary</h3>
      <label className="adm-field">Employee name<input name="name" autoFocus required maxLength={120} /></label>
      <label className="adm-field">Job title<input name="title" maxLength={120} /></label>
      <div className="adm-field"><label htmlFor="onboard-starts">Joining date</label><DatePicker id="onboard-starts" name="startsOn" defaultValue={indiaToday()} clearable={false} /></div>
      <div className="adm-field"><label htmlFor="onboard-ends">Last working date (optional)</label><DatePicker id="onboard-ends" name="endsOn" /></div>
      <label className="adm-field">Monthly salary (₹)<input name="salary" type="number" required min={0} max={10000000} step="0.01" /></label>
      <h3 className="people-wide">Finvera login & roles</h3>
      <div className="adm-field"><label htmlFor="onboard-login">Login setup</label>
        <Select id="onboard-login" ariaLabel="Login setup" value={loginMode} onChange={choice => setLoginMode(choice as Mode)} disabled={busy}
          options={[{ value: "create", label: "Create a new login" }, { value: "existing", label: "Link an existing login" }, { value: "none", label: "Set up login later" }]} />
      </div>
      {loginMode === "existing" && <div className="adm-field"><label htmlFor="onboard-existing-user">Existing login</label>
        <Select id="onboard-existing-user" ariaLabel="Existing login" value={existingUser} onChange={setExistingUser} disabled={busy}
          options={users.map(user => ({ value: String(user.id), label: `${user.name} · ${user.email}` }))} />
        {!users.length && <p className="fw-caption">There are no unlinked logins to select.</p>}
      </div>}
      {loginMode === "create" && <>
        <label className="adm-field">Login email<input name="email" type="email" required maxLength={255} /></label>
        <div className="adm-field people-wide"><label>Roles (choose at least one)</label>
          <div className="people-actions">{ROLE_OPTIONS.map(role => <label className="people-check" key={role}>
            <input type="checkbox" checked={roles.includes(role)} onChange={event => setRoles(current => event.target.checked ? [...current, role] : current.filter(value => value !== role))} />{ROLE_LABELS[role]}
          </label>)}</div>
        </div>
        {!roles.includes("admin") && brands.length > 0 && <div className="adm-field people-wide"><label>Assigned social brands</label>
          <div className="people-actions">{brands.map(brand => <label className="people-check" key={brand.id}><input type="checkbox" name="brand" value={brand.id} />{brand.name}</label>)}</div>
        </div>}
        <p className="fw-caption people-wide">After saving, you’ll get a private setup link to share with the employee.</p>
      </>}
      <h3 className="people-wide">Website Team profile</h3>
      <div className="adm-field"><label htmlFor="onboard-team">Website profile setup</label>
        <Select id="onboard-team" ariaLabel="Website profile setup" value={teamMode} onChange={choice => setTeamMode(choice as Mode)} disabled={busy}
          options={[{ value: "create", label: "Create a private draft" }, { value: "existing", label: "Link an existing profile" }, { value: "none", label: "Set up website profile later" }]} />
      </div>
      {teamMode === "existing" && <div className="adm-field"><label htmlFor="onboard-existing-team">Existing profile</label>
        <Select id="onboard-existing-team" ariaLabel="Existing profile" value={existingTeam} onChange={setExistingTeam} disabled={busy}
          options={profiles.map(profile => ({ value: String(profile.id), label: `${profile.name} · ${profile.status} · #${profile.id}` }))} />
        {!profiles.length && <p className="fw-caption">There are no unlinked profiles to select.</p>}
      </div>}
      {teamMode === "create" && <>
        <label className="adm-field">Public display name<input name="publicName" placeholder="Uses employee name if blank" maxLength={255} /></label>
        <label className="adm-field">Public title<input name="publicRole" placeholder="Uses job title if blank" maxLength={255} /></label>
        <label className="adm-field">Initials<input name="initials" maxLength={8} /></label>
        <label className="adm-field people-wide">Profile photo URL<input name="photo" maxLength={255} /></label>
        <label className="adm-field people-wide">Public bio<textarea name="bio" rows={3} maxLength={5000} /></label>
      </>}
      <div className="people-actions people-wide">
        <button type="submit" className="sh-btn pri" disabled={busy || incomplete}>{busy ? "Saving…" : "Create employee"}</button>
        <button type="button" className="sh-btn" onClick={close}>Cancel</button>
      </div>
    </fieldset>
  </form>;
}
