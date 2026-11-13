"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Icon, inputClass } from "../../components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    if (!res?.ok) {
      setError(json?.error?.message ?? "Cannot reach the server. Check the connection.");
      setBusy(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-brand-600 p-12 text-ink-900 lg:flex">
        <div className="relative z-10 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-ink-900 text-xl font-extrabold text-brand-500">
            Q
          </span>
          <span className="text-xl font-extrabold">Tokajo Warehouse</span>
        </div>
        <div className="relative z-10">
          <p className="max-w-md text-[30px] font-extrabold leading-tight">
            Pick fast. Pack right. Hand over in seconds.
          </p>
          <ul className="mt-6 space-y-3 text-lg font-semibold text-ink-900/80">
            {[
              "Live queue with late orders on top",
              "Tap to tick every item",
              "Big handover codes for riders",
            ].map((line) => (
              <li key={line} className="flex items-center gap-3">
                <span className="grid size-7 place-items-center rounded-full bg-ink-900 text-brand-500">
                  <Icon name="check" size={16} strokeWidth={3} />
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -right-24 size-96 rounded-full bg-brand-500/50"
        />
      </section>

      <section className="grid place-items-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-xl bg-brand-600 text-lg font-extrabold text-ink-900">
              Q
            </span>
            <span className="text-lg font-extrabold">Tokajo Warehouse</span>
          </div>
          <h1 className="text-[30px] font-extrabold leading-9">Sign in</h1>
          <p className="mt-1 text-base text-ink-700">Use the account your manager gave you.</p>

          {error ? (
            <p
              role="alert"
              className="mt-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-800"
            >
              <Icon name="alert" size={18} className="shrink-0" />
              {error}
            </p>
          ) : null}

          <label className="mt-6 block text-sm font-bold text-ink-700">
            Email
            <input
              type="email"
              required
              autoComplete="username"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${inputClass} mt-1 h-12`}
            />
          </label>
          <label className="mt-4 block text-sm font-bold text-ink-700">
            Password
            <span className="relative mt-1 block">
              <input
                type={show ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass} h-12 pr-12`}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide password" : "Show password"}
                className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-md text-ink-500 hover:text-ink-900"
              >
                <Icon name={show ? "eyeOff" : "eye"} />
              </button>
            </span>
          </label>
          <Button type="submit" size="lg" className="mt-6 w-full" disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </section>
    </main>
  );
}
