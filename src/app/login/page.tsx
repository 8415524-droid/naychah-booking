"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("אימייל או סיסמה שגויים");
      setBusy(false);
      return;
    }
    window.location.href = "/";
  }

  return (
    <main style={{ maxWidth: 420 }}>
      <h1>ברוכים הבאים לנייחא</h1>
      <form className="card" onSubmit={submit}>
        <label htmlFor="email">אימייל</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label htmlFor="pw">סיסמה</label>
        <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button className="primary" disabled={busy}>כניסה</button>
        {error && <p className="err">{error}</p>}
      </form>
    </main>
  );
}
