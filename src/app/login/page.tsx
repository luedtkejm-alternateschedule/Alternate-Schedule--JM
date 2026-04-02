"use client";
import { useState } from "react";
export default function LoginPage() {
  const [email, setEmail] = useState("admin@demo.local");
  const [password, setPassword] = useState("admin12345");
  const [error, setError] = useState("");
  async function login() {
    setError("");
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
    const json = await res.json();
    if (!res.ok) return setError(json.error || "Login failed");
    window.location.href = "/dashboard";
  }
  return (
    <main>
      <h1>Login</h1>
      <div className="card stacked">
        <div className="row">
          <div className="col"><label>Email</label><input value={email} onChange={e=>setEmail(e.target.value)} /></div>
          <div className="col"><label>Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} /></div>
        </div>
        <button className="primary" onClick={login}>Sign in</button>
        {error ? <p style={{color:"#b91c1c"}}>{error}</p> : null}
        <small>Default admin: admin@demo.local / admin12345</small>
      </div>
    </main>
  );
}
