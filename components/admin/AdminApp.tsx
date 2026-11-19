"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "./api";
import { isSection, SCRIPT_UI, SECTIONS, type DraftRow, type Item, type Section, type ScriptRow, type Stats } from "./types";
import { Banner, ConfirmProvider, IconGear, IconReels, IconScript, IconStats, ToastProvider, useToast } from "./ui";
import Reels from "./Reels";
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

const toDraft = (rows: ScriptRow[], mk: () => string): DraftRow[] => rows.map((r) => ({ ...r, key: mk() }));
const plain = (d: DraftRow[]) => JSON.stringify(d.map(({ reel1, reel2, reel3, enabled, note }) => ({ reel1, reel2, reel3, enabled, note })));

function Shell({ onSignedOut }: { onSignedOut: () => void }) {
  const toast = useToast();
  const [section, setSection] = useState<Section>("reels");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<ApiError | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [saved, setSaved] = useState<ScriptRow[]>([]);
  const [draft, setDraft] = useState<DraftRow[]>([]);
  const [nextSpin, setNextSpin] = useState(1);
  const [saving, setSaving] = useState(false);
  const keyN = useRef(0);
  const mkKey = useCallback(() => `r${++keyN.current}`, []);
  const dirty = useMemo(() => plain(draft) !== JSON.stringify(saved), [draft, saved]);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  useEffect(() => {
    const read = () => { const h = window.location.hash.slice(1); if (isSection(h)) setSection(h); };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirtyRef.current) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
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
      if (!dirtyRef.current) setDraft(toDraft(rows, mkKey));
      setError(null);
      setStatus("ready");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return onSignedOut();
      setError(e instanceof ApiError ? e : new ApiError("Something went wrong.", 0));
      setStatus("error");
    }
  }, [mkKey, onSignedOut]);
  useEffect(() => { void load(); }, [load]);

  async function saveScript() {
    setSaving(true);
    try {
      const rows = draft.map(({ reel1, reel2, reel3, enabled, note }) => ({ reel1, reel2, reel3, enabled, note }));
      await api("/api/admin/script", "PUT", { rows });
      setSaved(rows);
      toast(`Script saved. ${rows.length} scripted ${rows.length === 1 ? "spin" : "spins"}.`);
      void load(true);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "The script was not saved.", "err");
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
                {SCRIPT_UI && s.id === "script" && dirty && <span className="adm-dot" title="Unsaved changes"><span className="sr-only">Unsaved changes</span></span>}
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
              <span className="chip-v"><b>Random</b> <span className="chip-sub">Spin #{nextSpin} has no script row</span></span>
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
          {status !== "error" && section === "reels" && <Reels items={items} setItems={setItems} loading={loading} reload={() => void load(true)} />}
          {status !== "error" && section === "script" && (
            <Script items={items} draft={draft} setDraft={setDraft} nextSpin={nextSpin} dirty={dirty} saving={saving} loading={loading}
              onSave={() => void saveScript()} onDiscard={() => setDraft(toDraft(saved, mkKey))} mkKey={mkKey} />
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
