"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mark } from "@/components/icons";
import { api, setToken, hasApi } from "@/lib/adminApi";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const { token } = await api.login(email, password);
      setToken(token);
      router.replace("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="adm-login">
      <form onSubmit={onSubmit}>
        <div className="brand" style={{ fontSize: 20 }}><Mark /> Finvera</div>
        <h1>Admin sign in</h1>
        <p className="sub">Manage your site content</p>
        {!hasApi() && <div className="adm-msg err">Set <code>NEXT_PUBLIC_API_URL</code> to connect the backend.</div>}
        {error && <div className="adm-msg err">{error}</div>}
        <div className="adm-field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="admin@finvera.solutions" />
        </div>
        <div className="adm-field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
        </div>
        <button className="adm-btn primary" type="submit" disabled={loading} style={{ width: "100%", justifyContent: "center", marginTop: 6 }}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
