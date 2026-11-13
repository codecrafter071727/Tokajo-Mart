"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { ThemeToggle } from "../../components/shell/ThemeToggle";
import { Logo } from "../../components/ui/brand";
import { Activity, Boxes, Eye, EyeOff, Loader2, ShieldCheck } from "../../components/ui/icons";

const INPUT =
  "h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink shadow-card placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

const POINTS = [
  { icon: Activity, text: "Every order live, from placed to delivered" },
  { icon: Boxes, text: "Stock, prices and banners for every warehouse" },
  { icon: ShieldCheck, text: "Riders, customers and staff in one place" },
];

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Until the page is interactive a native submit would put the password in the address bar
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [show, setShow] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const res = await fetch("/session/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? "Could not sign in.");
        return;
      }
      const next = params.get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
      router.refresh();
    } catch {
      setError("Cannot reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form method="post" action="/login" onSubmit={(e) => void submit(e)} className="space-y-4">
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-bad-line bg-bad-soft px-3 py-2 text-[13px] text-bad"
        >
          {error}
        </p>
      ) : null}
      <label className="block text-[13px]">
        <span className="mb-1 block font-medium text-ink-2">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          autoFocus
          placeholder="you@tokajo.in"
          className={INPUT}
        />
      </label>
      <label className="block text-[13px]">
        <span className="mb-1 block font-medium text-ink-2">Password</span>
        <span className="relative block">
          <input
            name="password"
            type={show ? "text" : "password"}
            required
            autoComplete="current-password"
            className={`${INPUT} pr-10`}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide the password" : "Show the password"}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </span>
      </label>
      <button
        type="submit"
        disabled={busy || !ready}
        className="h-10 w-full rounded-lg bg-accent text-sm font-medium text-on-accent shadow-card transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {busy ? (
          <span className="inline-flex items-center justify-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            Signing in…
          </span>
        ) : (
          "Sign in"
        )}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between border-r border-nav-line bg-nav p-10 text-nav-text lg:flex">
        <div className="flex items-center gap-2.5">
          <Logo size={32} />
          <span className="text-lg font-semibold text-nav-ink">Tokajo Mart</span>
        </div>
        <div>
          <h2 className="max-w-md text-3xl leading-tight font-semibold tracking-tight text-nav-ink">
            Run every warehouse, rider and order from one console.
          </h2>
          <ul className="mt-8 space-y-4">
            {POINTS.map((p) => (
              <li key={p.text} className="flex items-center gap-3 text-[15px]">
                <p.icon className="size-5 shrink-0 text-accent" />
                {p.text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs">Tokajo Mart admin console</p>
      </section>
      <section className="relative flex items-center justify-center px-6 py-12">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <Logo size={32} />
            <span className="text-lg font-semibold">Tokajo Mart</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 mb-6 text-sm text-muted">For platform admins. Use your work email.</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
