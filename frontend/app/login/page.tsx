"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mark } from "@/components/icons";
import { api, setToken } from "@/lib/adminApi";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const { token } = await api.login(email, password);
      setToken(token);
      setSuccess(true);
      setTimeout(() => router.replace("/dashboard"), 950);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="adm-login">
        <div className="login-success">
          <div className="success-check">
            <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>
          </div>
          <h1>Welcome back!</h1>
          <p className="sub">Taking you to your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="adm-login">
      <form onSubmit={onSubmit}>
        <div className="brand" style={{ fontSize: 20 }}><Mark /> Finvera</div>
        <h1>Admin sign in</h1>
        <p className="sub">Manage your site content</p>
        {error && <div className="adm-msg err">{error}</div>}
        <div className="adm-field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="admin@finvera.solutions" autoComplete="username" />
        </div>
        <div className="adm-field">
          <label htmlFor="password">Password</label>
          <div className="adm-pass">
            <input id="password" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" autoComplete="current-password" />
            <button type="button" className="adm-eye" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} data-tip={show ? "Hide" : "Show"}>
              {show ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17.94 17.94A10 10 0 0 1 12 20c-7 0-11-8-11-8a18 18 0 0 1 5.06-5.94M9.9 4.24A9 9 0 0 1 12 4c7 0 11 8 11 8a18 18 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><path d="M1 1l22 22" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
              )}
            </button>
          </div>
        </div>
        <button className="adm-btn primary" type="submit" disabled={loading} style={{ width: "100%", justifyContent: "center", marginTop: 6 }}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
