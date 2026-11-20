"use client";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { api, ApiError, imageProblem, uploadImage } from "./api";
import { REEL_KIND, SCRIPT_UI, type Item, type Reel } from "./types";
import { IconDown, IconGrip, IconImage, IconPlus, IconTrash, IconUp, Skeleton, Switch, Thumb, useConfirm, useToast } from "./ui";

type Props = { items: Item[]; setItems: Dispatch<SetStateAction<Item[]>>; loading: boolean; reload: () => void };
type SaveBody = { label?: string; file?: File | null };
const bySort = (a: Item, b: Item) => a.sort_order - b.sort_order || a.id - b.id;
const errText = (e: unknown) => (e instanceof ApiError ? e.message : "That did not work. Try again.");
const reelName = (r: Reel) => `Reel ${r} – ${REEL_KIND[r]}`;

/** All three reels side by side, one card each (the layout of the first admin). */
export default function Reels({ items, setItems, loading, reload }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const [live, setLive] = useState("");

  async function patch(it: Item, body: Partial<Item>) {
    setItems((p) => p.map((x) => (x.id === it.id ? { ...x, ...body } : x)));
    try {
      const { item } = await api<{ item: Item }>(`/api/admin/items/${it.id}`, "PATCH", body);
      setItems((p) => p.map((x) => (x.id === item.id ? item : x)));
    } catch (e) {
      setItems((p) => p.map((x) => (x.id === it.id ? it : x)));
      toast(errText(e), "err");
    }
  }

  async function move(list: Item[], from: number, to: number) {
    if (to < 0 || to >= list.length || from === to) return;
    const next = [...list];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    setItems((p) => p.map((i) => (i.reel === m.reel ? { ...i, sort_order: next.findIndex((n) => n.id === i.id) } : i)));
    setLive(`${m.label} moved to position ${to + 1} of ${next.length}`);
    try {
      await api("/api/admin/reorder", "POST", { ids: next.map((n) => n.id) });
    } catch (e) {
      toast(errText(e), "err");
      reload();
    }
  }

  async function remove(it: Item) {
    const ok = await confirm({
      title: `Delete “${it.label}”?`,
      danger: true,
      confirmLabel: "Delete item",
      body: (
        <>
          <p>This removes <strong>{it.label}</strong> from {reelName(it.reel)}, so it can no longer appear on the reel.</p>
          <ul>
            <li>Past spins keep its name in the history.</li>
            {SCRIPT_UI && <li>Scripted spins that use it turn back to Random.</li>}
          </ul>
          <p>This cannot be undone. To keep it but stop it appearing, switch it off instead.</p>
        </>
      ),
    });
    if (!ok) return;
    const before = items;
    setItems((p) => p.filter((x) => x.id !== it.id));
    try {
      await api(`/api/admin/items/${it.id}`, "DELETE");
      toast(`Deleted “${it.label}”.`);
    } catch (e) {
      setItems(before);
      toast(errText(e), "err");
    }
  }

  /** The Save button on a row: name and/or new image together. Returns true when it worked. */
  async function save(it: Item, { label, file }: SaveBody) {
    try {
      const body: Partial<Item> = {};
      if (label !== undefined) body.label = label;
      if (file) body.image_url = await uploadImage(file);
      const { item } = await api<{ item: Item }>(`/api/admin/items/${it.id}`, "PATCH", body);
      setItems((p) => p.map((x) => (x.id === item.id ? item : x)));
      toast(`Saved “${item.label}”.`);
      return true;
    } catch (e) {
      toast(errText(e), "err");
      return false;
    }
  }

  async function add(reel: Reel, label: string) {
    try {
      const { item } = await api<{ item: Item }>("/api/admin/items", "POST", { reel, label });
      setItems((p) => [...p, item]);
      toast(`Added “${item.label}” to Reel ${reel}.`);
      return true;
    } catch (e) {
      toast(errText(e), "err");
      return false;
    }
  }

  return (
    <div className="rl-wrap">
      <p className="rc-help">Switched-off items are never shown. Use ↑ ↓ to change the order. Decide what each spin shows in Spin script.</p>
      <div className="rc-cols">
        {([1, 2, 3] as Reel[]).map((r) => (
          <ReelCard key={r} reel={r} list={items.filter((i) => i.reel === r).sort(bySort)} loading={loading}
            onMove={move} onPatch={patch} onRemove={remove} onSave={save} onAdd={add} />
        ))}
      </div>
      <p className="sr-only" aria-live="polite">{live}</p>
    </div>
  );
}

type CardProps = {
  reel: Reel; list: Item[]; loading: boolean;
  onMove: (list: Item[], from: number, to: number) => Promise<void>;
  onPatch: (it: Item, body: Partial<Item>) => Promise<void>;
  onRemove: (it: Item) => Promise<void>;
  onSave: (it: Item, b: SaveBody) => Promise<boolean>;
  onAdd: (reel: Reel, label: string) => Promise<boolean>;
};

function ReelCard({ reel, list, loading, onMove, onPatch, onRemove, onSave, onAdd }: CardProps) {
  const [dragId, setDragId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);
  const [armed, setArmed] = useState<number | null>(null);
  return (
    <section className="rc-card" aria-labelledby={`rc-${reel}`}>
      <h2 id={`rc-${reel}`}>{reelName(reel)}</h2>
      {loading ? (
        <div className="rl-list" aria-busy="true">
          {[0, 1, 2].map((k) => <div className="rl-row rc-skel" key={k}><Skeleton h={44} w="100%" /></div>)}
        </div>
      ) : list.length === 0 ? (
        <p className="rc-empty">No items yet. Add the first one below. This reel cannot spin until it has an item that is switched on.</p>
      ) : (
        <ul className="rl-list" aria-label={`${reelName(reel)} items`}>
          {list.map((it, idx) => (
            <li key={it.id}
              className={`rl-row${it.active ? "" : " off"}${dragId === it.id ? " drag" : ""}${overId === it.id && dragId !== it.id ? " over" : ""}`}
              draggable={armed === it.id}
              onDragStart={(e) => { setDragId(it.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(it.id)); }}
              onDragOver={(e) => { if (dragId !== null) { e.preventDefault(); setOverId(it.id); } }}
              onDrop={(e) => { e.preventDefault(); const from = list.findIndex((x) => x.id === dragId); if (from >= 0) void onMove(list, from, idx); setDragId(null); setOverId(null); setArmed(null); }}
              onDragEnd={() => { setDragId(null); setOverId(null); setArmed(null); }}>
              <button type="button" className="grip" aria-label={`Drag to reorder ${it.label}`} tabIndex={-1}
                onPointerDown={() => setArmed(it.id)} onPointerUp={() => setArmed(null)}><IconGrip /></button>
              <Row it={it} first={idx === 0} last={idx === list.length - 1}
                onUp={() => void onMove(list, idx, idx - 1)} onDown={() => void onMove(list, idx, idx + 1)}
                onActive={(v) => void onPatch(it, { active: v })} onRemove={() => void onRemove(it)}
                onSave={(b) => onSave(it, b)} />
            </li>
          ))}
        </ul>
      )}
      <AddForm reel={reel} disabled={loading} onAdd={onAdd} />
    </section>
  );
}

type RowProps = {
  it: Item; first: boolean; last: boolean;
  onUp: () => void; onDown: () => void; onActive: (v: boolean) => void; onRemove: () => void;
  onSave: (b: SaveBody) => Promise<boolean>;
};

/** Name and image of one item. Changes stay a draft until Save; Cancel puts the saved ones back. */
function Row({ it, first, last, onUp, onDown, onActive, onRemove, onSave }: RowProps) {
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [v, setV] = useState(it.label);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setV(it.label), [it.label]);
  useEffect(() => {
    if (!file) return setPreview(null);
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  const t = v.trim();
  const dirty = t !== it.label || !!file;
  const pick = (f: File | undefined) => {
    if (!f) return;
    const p = imageProblem(f);
    if (p) return toast(p, "err");
    setFile(f);
  };
  const cancel = () => { setV(it.label); setFile(null); setErr(""); };
  const save = async () => {
    if (!t) { setErr("The label cannot be empty."); return; }
    setErr("");
    setBusy(true);
    const ok = await onSave({ label: t !== it.label ? t : undefined, file });
    setBusy(false);
    if (ok) setFile(null);
  };
  const keys = (e: React.KeyboardEvent) => { if (e.key === "Enter" && dirty) void save(); if (e.key === "Escape") cancel(); };
  return (
    <>
      <button type="button" className={`thumb-btn${file ? " changed" : ""}`} aria-label={`${it.image_url ? "Change" : "Add"} image for ${it.label}`} onClick={() => ref.current?.click()} disabled={busy}>
        <Thumb src={preview ?? it.image_url} size={44} />
      </button>
      <input ref={ref} type="file" hidden accept="image/png,image/webp,image/svg+xml" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      <input className="inp rc-label" aria-label={`Label for ${it.label}`} aria-invalid={!!err} maxLength={60} value={v} disabled={busy}
        onChange={(e) => { setV(e.target.value); if (err) setErr(""); }} onKeyDown={keys} />
      <div className="rc-tools">
        <button type="button" className="iconbtn" aria-label={`Move ${it.label} up`} title="Move up" onClick={onUp} disabled={first || busy}><IconUp /></button>
        <button type="button" className="iconbtn" aria-label={`Move ${it.label} down`} title="Move down" onClick={onDown} disabled={last || busy}><IconDown /></button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => ref.current?.click()} disabled={busy}><IconImage /> {it.image_url || file ? "Change image" : "Add image"}</button>
        <span className="rc-gap" />
        <Switch checked={it.active} label={`${it.label} is ${it.active ? "on" : "off"}`} onChange={onActive} />
        <button type="button" className="iconbtn danger" aria-label={`Delete ${it.label}`} title="Delete" onClick={onRemove}><IconTrash /></button>
      </div>
      {(dirty || err) && (
        <div className="rc-save">
          {err && <span className="field-err" role="alert">{err}</span>}
          {dirty && (
            <>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void save()} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
              <button type="button" className="btn btn-quiet btn-sm" onClick={cancel} disabled={busy}>Cancel</button>
              <span className="lf-note" role="status">Not saved yet</span>
            </>
          )}
        </div>
      )}
    </>
  );
}

function AddForm({ reel, disabled, onAdd }: { reel: Reel; disabled: boolean; onAdd: (reel: Reel, label: string) => Promise<boolean> }) {
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form className="rc-add" onSubmit={async (e) => {
      e.preventDefault();
      const t = label.trim();
      if (!t) return;
      setBusy(true);
      if (await onAdd(reel, t)) setLabel("");
      setBusy(false);
    }}>
      <input className="inp" placeholder="New label" aria-label={`New label for Reel ${reel}`} maxLength={60} value={label} disabled={disabled || busy} onChange={(e) => setLabel(e.target.value)} />
      <button type="submit" className="btn btn-primary" disabled={disabled || busy || !label.trim()}><IconPlus /> {busy ? "Adding…" : "Add"}</button>
    </form>
  );
}
