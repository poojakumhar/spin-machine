"use client";
import { useEffect, useId, useRef, useState, type Dispatch, type KeyboardEvent, type SetStateAction } from "react";
import type { DraftRow, Item, Reel } from "./types";
import { Empty, IconCheck, IconChevron, IconCopy, IconDown, IconPlus, IconTrash, IconUp, Skeleton, Switch, Thumb } from "./ui";

type Props = {
  items: Item[];
  draft: DraftRow[];
  setDraft: Dispatch<SetStateAction<DraftRow[]>>;
  nextSpin: number;
  dirty: boolean;
  saving: boolean;
  loading: boolean;
  onSave: () => void;
  onDiscard: () => void;
  mkKey: () => string;
};
const bySort = (a: Item, b: Item) => a.sort_order - b.sort_order || a.id - b.id;

export default function Script({ items, draft, setDraft, nextSpin, dirty, saving, loading, onSave, onDiscard, mkKey }: Props) {
  const reelItems = (r: Reel) => items.filter((i) => i.reel === r).sort(bySort);
  const playedCount = Math.min(draft.length, Math.max(0, nextSpin - 1)); // rows 1..playedCount have already been used
  const blank = (): DraftRow => ({ key: mkKey(), reel1: null, reel2: null, reel3: null, enabled: true, note: "" });

  const set = (i: number, p: Partial<DraftRow>) => setDraft((d) => d.map((r, k) => (k === i ? { ...r, ...p } : r)));
  const add = (n: number) => setDraft((d) => [...d, ...Array.from({ length: n }, blank)]);
  const del = (i: number) => setDraft((d) => d.filter((_, k) => k !== i));
  const dup = (i: number) => setDraft((d) => { const c = { ...d[i], key: mkKey() }; return [...d.slice(0, i + 1), c, ...d.slice(i + 1)]; });
  const mv = (i: number, to: number) => setDraft((d) => { if (to < playedCount || to >= d.length) return d; const n = [...d]; [n[i], n[to]] = [n[to], n[i]]; return n; });

  return (
    <div className="sc-wrap">
      <div className="sc-tools">
        <button type="button" className="btn btn-secondary" onClick={() => add(1)} disabled={loading}><IconPlus /> Add spin</button>
        <button type="button" className="btn btn-secondary" onClick={() => add(5)} disabled={loading}>Add 5 spins</button>
        <p className="sc-help">Row N decides spin N. Pick <strong>Random</strong> to leave a reel to chance. Spins already played are locked.</p>
      </div>

      {loading ? (
        <div className="sc-list" aria-busy="true">
          <span className="sr-only" role="status">Loading the script</span>
          {[0, 1, 2, 3].map((k) => <div className="sc-row" key={k}><Skeleton h={44} w={48} /><Skeleton h={48} /><Skeleton h={48} /><Skeleton h={48} /></div>)}
        </div>
      ) : draft.length === 0 ? (
        <Empty title="No scripted spins yet. Every spin is random.">Add the first spin to decide what appears on a particular turn.</Empty>
      ) : (
        <ol className="sc-list" aria-label="Spin script">
          {draft.map((r, i) => {
            const n = i + 1;
            const played = n < nextSpin;
            const isNext = n === nextSpin;
            return (
              <li key={r.key} className={`sc-row${played ? " played" : ""}${isNext ? " next" : ""}${!r.enabled ? " off" : ""}`} aria-current={isNext ? "step" : undefined}>
                <div className="sc-num">
                  {played ? <span className="check" title="Already played"><IconCheck /><span className="sr-only">Played, </span></span> : null}
                  <strong>Spin {n}</strong>
                  {isNext && <span className="badge">Next</span>}
                </div>
                {([1, 2, 3] as Reel[]).map((rl) => (
                  <ItemSelect key={rl} reel={rl} items={reelItems(rl)} value={r[`reel${rl}` as "reel1"]} disabled={played}
                    label={`Spin ${n}, reel ${rl}`} onChange={(v) => set(i, { [`reel${rl}`]: v } as Partial<DraftRow>)} />
                ))}
                <div className="sc-on"><Switch checked={r.enabled} disabled={played} label={`Spin ${n} is ${r.enabled ? "enabled" : "disabled"}`} onChange={(v) => set(i, { enabled: v })} /><span className="sc-on-l">{r.enabled ? "On" : "Off"}</span></div>
                <input className="inp sc-note" aria-label={`Note for spin ${n}`} placeholder="Note (optional)" maxLength={120} value={r.note} disabled={played} onChange={(e) => set(i, { note: e.target.value })} />
                <div className="sc-actions">
                  <button type="button" className="iconbtn" aria-label={`Move spin ${n} up`} disabled={played || i - 1 < playedCount} onClick={() => mv(i, i - 1)}><IconUp /></button>
                  <button type="button" className="iconbtn" aria-label={`Move spin ${n} down`} disabled={played || i === draft.length - 1} onClick={() => mv(i, i + 1)}><IconDown /></button>
                  <button type="button" className="iconbtn" aria-label={`Duplicate spin ${n}`} disabled={played} onClick={() => dup(i)}><IconCopy /></button>
                  <button type="button" className="iconbtn danger" aria-label={`Remove spin ${n}`} disabled={played} onClick={() => del(i)}><IconTrash /></button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="savebar" role="region" aria-label="Save the script">
        <span className={`dirty${dirty ? " yes" : ""}`} aria-live="polite">
          <span className="dirty-dot" aria-hidden />
          {dirty ? "Unsaved changes" : "All changes saved"}
        </span>
        <div className="savebar-btns">
          <button type="button" className="btn btn-secondary" disabled={!dirty || saving} onClick={onDiscard}>Discard changes</button>
          <button type="button" className="btn btn-primary" disabled={!dirty || saving} onClick={onSave}>{saving ? "Saving…" : "Save script"}</button>
        </div>
      </div>
    </div>
  );
}

type Opt = { id: number | null; label: string; image_url: string | null; active: boolean };

function ItemSelect({ reel, items, value, onChange, disabled, label }: { reel: Reel; items: Item[]; value: number | null; onChange: (v: number | null) => void; disabled?: boolean; label: string }) {
  const [open, setOpen] = useState(false);
  const [act, setAct] = useState(0);
  const [up, setUp] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const uid = useId();
  const opts: Opt[] = [{ id: null, label: "Random", image_url: null, active: true }, ...items.map((i) => ({ id: i.id, label: i.label, image_url: i.image_url, active: i.active }))];
  const cur = Math.max(0, opts.findIndex((o) => o.id === value));
  const sel = opts[cur];

  useEffect(() => {
    if (!open) return;
    const h = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const r = btn.current?.getBoundingClientRect();
    if (r) setUp(window.innerHeight - r.bottom < 340 && r.top > 340);
    setAct(cur);
    list.current?.focus();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) document.getElementById(`${uid}-o${act}`)?.scrollIntoView({ block: "nearest" }); }, [act, open, uid]);

  const choose = (i: number) => { onChange(opts[i].id); setOpen(false); btn.current?.focus(); };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setAct((a) => Math.min(opts.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setAct((a) => Math.max(0, a - 1)); }
    else if (e.key === "Home") { e.preventDefault(); setAct(0); }
    else if (e.key === "End") { e.preventDefault(); setAct(opts.length - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(act); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); btn.current?.focus(); }
    else if (e.key === "Tab") setOpen(false);
    else if (e.key.length === 1) { const k = opts.findIndex((o, i) => i > act && o.label.toLowerCase().startsWith(e.key.toLowerCase())); const f = k >= 0 ? k : opts.findIndex((o) => o.label.toLowerCase().startsWith(e.key.toLowerCase())); if (f >= 0) setAct(f); }
  };

  return (
    <div className="sel" ref={root}>
      <button ref={btn} type="button" className={`sel-btn${sel.id === null ? " rnd" : ""}`} disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-label={`${label}: ${sel.label}`} onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setOpen(true); } }}>
        {sel.id === null ? <span className="rnd-mark" aria-hidden>?</span> : <Thumb src={sel.image_url} size={32} />}
        <span className="sel-label">{sel.label}{sel.id !== null && !sel.active ? " (off)" : ""}</span>
        <IconChevron />
      </button>
      {open && (
        <ul ref={list} className={`sel-list${up ? " up" : ""}`} role="listbox" tabIndex={0} aria-label={`${label} options`} aria-activedescendant={`${uid}-o${act}`} onKeyDown={onKey}>
          {opts.map((o, i) => (
            <li key={String(o.id)} id={`${uid}-o${i}`} role="option" aria-selected={i === cur} className={`sel-opt${i === act ? " act" : ""}${i === cur ? " cur" : ""}`} onPointerEnter={() => setAct(i)} onClick={() => choose(i)}>
              {o.id === null ? <span className="rnd-mark" aria-hidden>?</span> : <Thumb src={o.image_url} size={32} />}
              <span className="sel-label">{o.label}{o.id !== null && !o.active ? " (off, falls back to Random)" : ""}</span>
              {i === cur && <IconCheck />}
            </li>
          ))}
        </ul>
      )}
      <span className="sr-only">Reel {reel}</span>
    </div>
  );
}
