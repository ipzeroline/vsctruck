"use client";

import { Loader2, LockKeyhole, Truck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginShell />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await response.json()) as { ok: boolean; message?: string };

      if (!response.ok || !data.ok) {
        setError(data.message ?? "เข้าสู่ระบบไม่สำเร็จ");
        return;
      }

      router.replace(searchParams.get("next") || "/");
      router.refresh();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-hero" aria-label="VSCTruck login">
        <div className="login-brand">
          <div className="brand-mark">
            <Truck size={24} aria-hidden="true" />
          </div>
          <div>
            <strong>VSCTruck</strong>
            <span>Fleet Operations Platform</span>
          </div>
        </div>

        <div className="login-copy">
          <p className="eyebrow">Secure access</p>
          <h1>ควบคุมรายงานรถและทีมงานจากหน้าจอเดียว</h1>
          <p>
            Dashboard สำหรับตรวจสอบตำแหน่งรถ รายงานประจำวัน รายงานย้อนหลัง และระบบ staff ก่อนส่งข้อมูลเข้า
            Telegram
          </p>
        </div>
      </section>

      <section className="login-card" aria-label="Login form">
        <div className="login-card-heading">
          <LockKeyhole size={22} aria-hidden="true" />
          <div>
            <h2>เข้าสู่ระบบ</h2>
            <span>ใช้บัญชีผู้ดูแล VSCTruck</span>
          </div>
        </div>

        <form className="login-form" onSubmit={submit}>
          <label>
            <span>Username</span>
            <input
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="กรอก username"
              required
            />
          </label>
          <label>
            <span>Password</span>
            <input
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="กรอก password"
              required
              type="password"
            />
          </label>

          {error ? <div className="login-error">{error}</div> : null}

          <button className="button login-button" disabled={loading}>
            {loading ? <Loader2 className="spin" size={18} /> : <LockKeyhole size={18} />}
            เข้าสู่ระบบ
          </button>
        </form>
      </section>
    </main>
  );
}

function LoginShell() {
  return (
    <main className="login-page">
      <section className="login-hero" aria-label="VSCTruck login">
        <div className="login-brand">
          <div className="brand-mark">
            <Truck size={24} aria-hidden="true" />
          </div>
          <div>
            <strong>VSCTruck</strong>
            <span>Fleet Operations Platform</span>
          </div>
        </div>
        <div className="login-copy">
          <p className="eyebrow">Secure access</p>
          <h1>ควบคุมรายงานรถและทีมงานจากหน้าจอเดียว</h1>
        </div>
      </section>
      <section className="login-card" aria-label="Login form">
        <div className="empty-state">กำลังโหลดหน้าเข้าสู่ระบบ...</div>
      </section>
    </main>
  );
}
