"use client";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";
import { isSection, SCRIPT_UI, SECTIONS, type Item, type Section, type ScriptRow, type Stats } from "./types";
import { Banner, ConfirmProvider, IconGear, IconReels, IconScript, IconStats, ToastProvider, useToast } from "./ui";
import Script from "./Script";
import StatsView from "./Stats";
import Settings from "./Settings";

const ICONS: Record<Section, () => React.JSX.Element> = { reels: IconReels, script: IconScript, stats: IconStats, settings: IconGear };

export default function AdminApp(props: { authed: boolean; configured: boolean }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <Inner {...props} />
      </ConfirmProvider>
    </ToastProvider>
  );
}

function Inner({ authed, configured }: { authed: boolean; configured: boolean }) {
  const [ok, setOk] = useState(authed);
  if (!ok) return <Login configured={configured} onDone={() => setOk(true)} />;
  return <Shell onSignedOut={() => setOk(false)} />;
}

function Login({ configured, onDone }: { configured: boolean; onDone: () => void }) {
  const [uid, setUid] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api("/api/admin/login", "POST", { username: uid, password: pw });
      onDone();
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="adm adm-login">
      <form className="login-card" onSubmit={submit}>
        <h1>Reel Admin</h1>
        <p className="lede">Sign in to manage the reels and see the stats.</p>
        {!configured && <p className="field-err" role="alert">ADMIN_USERNAME and ADMIN_PASSWORD are not set on the server.</p>}
        <label htmlFor="uid">Login ID</label>
        <input id="uid" className="inp" type="text" autoComplete="username" value={uid} onChange={(e) => setUid(e.target.value)} autoFocus />
        <label htmlFor="pw">Password</label>
        <input id="pw" className="inp" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        {err && <p className="field-err" role="alert">{err}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy || !uid || !pw}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  );
}


function Shell({ onSignedOut }: { onSignedOut: () => void }) {
  const toast = useToast();
  const [section, setSection] = useState<Section>("script");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<ApiError | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [saved, setSaved] = useState<ScriptRow[]>([]);
  const [nextSpin, setNextSpin] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const read = () => { const h = window.location.hash.slice(1); if (isSection(h)) setSection(h); };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setStatus("loading");
    try {
      const [i, sc, st] = await Promise.all([
        api<{ items: Item[] }>("/api/admin/items"),
        api<{ rows: (ScriptRow & { position: number })[]; nextSpin: number }>("/api/admin/script"),
        api<Stats>("/api/admin/stats"),
      ]);
      const rows = sc.rows.map(({ reel1, reel2, reel3, enabled, note }) => ({ reel1, reel2, reel3, enabled, note }));
      setItems(i.items);
      setStats(st);
      setNextSpin(sc.nextSpin);
      setSaved(rows);
      setError(null);
      setStatus("ready");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return onSignedOut();
      setError(e instanceof ApiError ? e : new ApiError("Something went wrong.", 0));
      setStatus("error");
    }
  }, [onSignedOut]);
  useEffect(() => { void load(); }, [load]);

  // Keep "Next spin", the spin list and the stats in step with the kiosk: check every 3 s while this tab is
  // visible, and straight away when you come back to it. Failed checks are ignored (the next one retries).
  useEffect(() => {
    let busy = false;
    const tick = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const [sc, st] = await Promise.all([
          api<{ rows: (ScriptRow & { position: number })[]; nextSpin: number }>("/api/admin/script"),
          api<Stats>("/api/admin/stats"),
        ]);
        setNextSpin(sc.nextSpin);
        setSaved(sc.rows.map(({ reel1, reel2, reel3, enabled, note }) => ({ reel1, reel2, reel3, enabled, note })));
        setStats(st);
      } catch {
        /* offline or signed out: the next check or the user's next action will show it */
      } finally {
        busy = false;
      }
    };
    const id = window.setInterval(() => void tick(), 3000);
    const onShow = () => { if (!document.hidden) void tick(); };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", onShow); window.removeEventListener("focus", onShow); };
  }, []);

  /** Every change on the Spin script screen (add, edit, move, on/off, delete) saves the whole list straight away. */
  async function saveRows(rows: ScriptRow[], done: string) {
    setSaving(true);
    try {
      await api("/api/admin/script", "PUT", { rows });
      setSaved(rows);
      toast(done);
      void load(true);
      return true;
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "That was not saved. Try again.", "err");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    try { await api("/api/admin/login", "DELETE"); } catch { /* the session cookie is cleared server-side either way */ }
    onSignedOut();
  }

  const label = (reel: 1 | 2 | 3, id: number | null) => (id === null ? "Random" : items.find((i) => i.id === id)?.label ?? "Random");
  const nextRow = saved[nextSpin - 1];
  const loading = status === "loading";
  const meta = SECTIONS.find((s) => s.id === section)!;

  return (
    <div className="adm">
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}>Skip to content</a>
      <aside className="adm-side">
        <div className="adm-brand"><span className="adm-mark" aria-hidden /><span>Reel Admin</span></div>
        <nav aria-label="Sections" className="adm-nav">
          {SECTIONS.map((s) => {
            const Ic = ICONS[s.id];
            return (
              <a key={s.id} href={`#${s.id}`} className="adm-link" aria-current={section === s.id ? "page" : undefined}>
                <Ic /><span>{s.label}</span>
              </a>
            );
          })}
        </nav>
      </aside>

      <div className="adm-main">
        <header className="adm-top">
          {SCRIPT_UI ? <div className="chip" aria-live="polite" data-testid="next-chip">
            <span className="chip-k">Next spin</span>
            {loading ? <span className="chip-v">Loading…</span> : status === "error" ? <span className="chip-v">Unknown</span> : nextRow && nextRow.enabled ? (
              <span className="chip-v"><b>Spin #{nextSpin}</b> → {label(1, nextRow.reel1)} · {label(2, nextRow.reel2)} · {label(3, nextRow.reel3)}</span>
            ) : (
              <span className="chip-v"><b>Random</b> <span className="chip-sub">No spin is ready to play. Add one, or fill in or switch on a spin.</span></span>
            )}
          </div> : <div className="top-title">Slot machine kiosk</div>}
          <div className="adm-actions">
            <a className="btn btn-secondary" href="/" target="_blank" rel="noreferrer">Open kiosk</a>
            <button type="button" className="btn btn-quiet" onClick={() => void signOut()}>Sign out</button>
          </div>
        </header>

        <main className="adm-content" id="main" tabIndex={-1}>
          <h1 className="adm-h1">{meta.label}</h1>
          <p className="lede">{meta.lede}</p>
          {status === "error" && error && <Banner message={error.message} onRetry={() => void load()} />}
          {status !== "error" && section === "script" && (
            <Script items={items} rows={saved} nextSpin={nextSpin} loading={loading} busy={saving} onSaveRows={saveRows} />
          )}
          {status !== "error" && section === "stats" && <StatsView stats={stats} loading={loading} />}
          {status !== "error" && section === "settings" && (
            <Settings nextSpin={nextSpin} totalSpins={stats?.total ?? 0} scriptLength={saved.length} loading={loading} onChanged={() => void load(true)} />
          )}
        </main>
      </div>
    </div>
  );
}
