"use client";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { api, ApiError, formatBytes, imageProblem, uploadImage } from "./api";
import { REEL_KIND, SCRIPT_UI, type Item, type Reel } from "./types";
import { Empty, IconGrip, IconImage, IconPlus, IconTrash, ReelPreview, Skeleton, Switch, Thumb, useConfirm, useToast } from "./ui";

type Props = { items: Item[]; setItems: Dispatch<SetStateAction<Item[]>>; loading: boolean; reload: () => void };
const bySort = (a: Item, b: Item) => a.sort_order - b.sort_order || a.id - b.id;
const errText = (e: unknown) => (e instanceof ApiError ? e.message : "That did not work. Try again.");

export default function Reels({ items, setItems, loading, reload }: Props) {
  const [reel, setReel] = useState<Reel>(1);
  const toast = useToast();
  const confirm = useConfirm();
  const [live, setLive] = useState("");
  const [dragId, setDragId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);
  const [armed, setArmed] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const list = items.filter((i) => i.reel === reel).sort(bySort);
  const label = (r: Reel) => `Reel ${r}, ${REEL_KIND[r]}`;

  async function patch(it: Item, body: Partial<Item>, ok?: string) {
    setItems((p) => p.map((x) => (x.id === it.id ? { ...x, ...body } : x)));
    try {
      const { item } = await api<{ item: Item }>(`/api/admin/items/${it.id}`, "PATCH", body);
      setItems((p) => p.map((x) => (x.id === item.id ? item : x)));
      if (ok) toast(ok);
    } catch (e) {
      setItems((p) => p.map((x) => (x.id === it.id ? it : x)));
      toast(errText(e), "err");
    }
  }

  async function move(from: number, to: number) {
    if (to < 0 || to >= list.length || from === to) return;
    const next = [...list];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    setItems((p) => p.map((i) => (i.reel === reel ? { ...i, sort_order: next.findIndex((n) => n.id === i.id) } : i)));
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
          <p>This removes <strong>{it.label}</strong> from {label(it.reel)}, so it can no longer appear on the reel.</p>
          <ul>
            <li>Past spins keep its name in the history.</li>
            {SCRIPT_UI && <li>Scripted spins that use it turn back to Random.</li>}
            <li>The image file stays on disk.</li>
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

  async function replaceImage(it: Item, f: File) {
    const problem = imageProblem(f);
    if (problem) return toast(problem, "err");
    try {
      const url = await uploadImage(f);
      await patch(it, { image_url: url }, `Image updated for “${it.label}”.`);
    } catch (e) {
      toast(errText(e), "err");
    }
  }

  const active = (r: Reel) => items.filter((i) => i.reel === r && i.active).length;
  const total = (r: Reel) => items.filter((i) => i.reel === r).length;

  return (
    <div className="rl-wrap">
      <div className="tabs-bar">
      <div className="tabs" role="tablist" aria-label="Reels">
        {([1, 2, 3] as Reel[]).map((r) => (
          <button key={r} type="button" role="tab" id={`tab-${r}`} aria-selected={reel === r} aria-controls="reel-panel" tabIndex={reel === r ? 0 : -1} className="tab" onClick={() => setReel(r)}
            onKeyDown={(e) => { const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0; if (!d) return; e.preventDefault(); const n = (((r - 1 + d + 3) % 3) + 1) as Reel; setReel(n); document.getElementById(`tab-${n}`)?.focus(); }}>
            <span>Reel {r}</span>
            <small>{REEL_KIND[r]}</small>
            <span className="tab-count" aria-label={`${active(r)} of ${total(r)} items on`}>{loading ? "…" : `${active(r)}/${total(r)}`}</span>
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-primary tabs-add" onClick={() => setAdding(true)} disabled={loading}><IconPlus /> Add to Reel {reel}</button>
      </div>

      <section id="reel-panel" role="tabpanel" aria-labelledby={`tab-${reel}`} className="panel">
        <div className="panel-head">
          <h2>{label(reel)}</h2>
          <p>{reel === 2 ? "Each item is an animal picture with its name underneath." : "Each item is a word. An image under it is optional."} Switch an item off to keep it but stop it appearing.</p>
        </div>

        {loading ? (
          <div className="rl-list" aria-busy="true">
            <span className="sr-only" role="status">Loading items</span>
            {[0, 1, 2, 3].map((k) => (
              <div className="rl-row" key={k}><Skeleton h={44} w={44} /><Skeleton h={56} w={56} /><Skeleton h={56} w="100%" /><Skeleton h={44} w="100%" /></div>
            ))}
          </div>
        ) : list.length === 0 ? (
          <Empty title="No items yet. Add the first one.">Use the Add to Reel button at the top right. This reel cannot spin until it has at least one item that is switched on.</Empty>
        ) : (
          <ul className="rl-list" aria-label={`${label(reel)} items`}>
            {list.map((it, idx) => (
              <li
                key={it.id}
                className={`rl-row${it.active ? "" : " off"}${dragId === it.id ? " drag" : ""}${overId === it.id && dragId !== it.id ? " over" : ""}`}
                draggable={armed === it.id}
                onDragStart={(e) => { setDragId(it.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(it.id)); }}
                onDragOver={(e) => { if (dragId !== null) { e.preventDefault(); setOverId(it.id); } }}
                onDrop={(e) => { e.preventDefault(); const from = list.findIndex((x) => x.id === dragId); if (from >= 0) void move(from, idx); setDragId(null); setOverId(null); setArmed(null); }}
                onDragEnd={() => { setDragId(null); setOverId(null); setArmed(null); }}
              >
                <button type="button" className="grip" aria-label={`Reorder ${it.label}. Drag, or use the up and down arrow keys.`}
                  onPointerDown={() => setArmed(it.id)} onPointerUp={() => setArmed(null)}
                  onKeyDown={(e) => { if (e.key === "ArrowUp") { e.preventDefault(); void move(idx, idx - 1); } if (e.key === "ArrowDown") { e.preventDefault(); void move(idx, idx + 1); } }}>
                  <IconGrip />
                </button>
                <ImageCell it={it} onPick={(f) => void replaceImage(it, f)} />
                <ReelPreview reel={it.reel} label={it.label} image={it.image_url} dim={!it.active} />
                <LabelField it={it} onSave={(v) => patch(it, { label: v })} />
                <Switch checked={it.active} label={`${it.label} is ${it.active ? "on" : "off"}`} onChange={(v) => void patch(it, { active: v })} />
                <button type="button" className="iconbtn danger" aria-label={`Delete ${it.label}`} onClick={() => void remove(it)}><IconTrash /></button>
              </li>
            ))}
          </ul>
        )}
        <p className="sr-only" aria-live="polite">{live}</p>

        <AddDialog open={adding} reel={reel} onClose={() => setAdding(false)} onAdded={(it) => setItems((p) => [...p, it])} />
      </section>
    </div>
  );
}

function ImageCell({ it, onPick }: { it: Item; onPick: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className="thumb-btn" aria-label={`${it.image_url ? "Replace" : "Add"} image for ${it.label}`} onClick={() => ref.current?.click()}>
        <Thumb src={it.image_url} />
      </button>
      <input ref={ref} type="file" hidden accept="image/png,image/webp,image/svg+xml" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }} />
    </>
  );
}

function LabelField({ it, onSave }: { it: Item; onSave: (v: string) => Promise<void> }) {
  const [v, setV] = useState(it.label);
  const [err, setErr] = useState("");
  useEffect(() => setV(it.label), [it.label]);
  const commit = async () => {
    const t = v.trim();
    if (t === it.label) return setErr("");
    if (!t) { setErr("The label cannot be empty."); return; }
    setErr("");
    await onSave(t);
  };
  return (
    <div className="lf">
      <input className="inp" aria-label={`Label for ${it.label}`} aria-invalid={!!err} aria-describedby={err ? `e-${it.id}` : undefined} maxLength={60} value={v}
        onChange={(e) => setV(e.target.value)} onBlur={() => void commit()}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setV(it.label); setErr(""); } }} />
      {err && <span className="field-err" id={`e-${it.id}`} role="alert">{err}</span>}
    </div>
  );
}

function AddDialog({ open, reel, onClose, onAdded }: { open: boolean; reel: Reel; onClose: () => void; onAdded: (it: Item) => void }) {
  const toast = useToast();
  const dlg = useRef<HTMLDialogElement>(null);
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errs, setErrs] = useState<{ label?: string; file?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const [hot, setHot] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (open && !d.open) {
      setLabel(""); setFile(null); setErrs({});
      d.showModal();
      setTimeout(() => labelRef.current?.focus(), 0);
    } else if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => {
    if (!file) return setPreview(null);
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const take = (f: File | undefined) => {
    if (!f) return;
    const p = imageProblem(f);
    if (p) { setFile(null); setErrs((e) => ({ ...e, file: p })); return; }
    setErrs((e) => ({ ...e, file: undefined }));
    setFile(f);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = label.trim();
    if (!t) return setErrs((x) => ({ ...x, label: "Enter a label for the new item." }));
    if (errs.file) return;
    setBusy(true);
    setErrs({});
    try {
      const image_url = file ? await uploadImage(file) : null;
      const { item } = await api<{ item: Item }>("/api/admin/items", "POST", { reel, label: t, image_url });
      onAdded(item);
      toast(`Added “${item.label}” to Reel ${reel}.`);
      onClose();
    } catch (er) {
      setErrs({ form: errText(er) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={dlg} className="cf cf-wide" aria-labelledby="add-title"
      onCancel={(e) => { e.preventDefault(); if (!busy) onClose(); }}
      onClick={(e) => { if (e.target === dlg.current && !busy) onClose(); }}>
      <form className="cf-body" onSubmit={submit} noValidate>
        <h2 id="add-title">Add an item to Reel {reel}</h2>
        <div className="add-grid">
          <div className="field">
            <label htmlFor="add-label">Label</label>
            <input id="add-label" ref={labelRef} className="inp" maxLength={60} value={label} disabled={busy} aria-invalid={!!errs.label} aria-describedby={errs.label ? "add-label-err" : undefined}
              onChange={(e) => { setLabel(e.target.value); if (errs.label) setErrs((x) => ({ ...x, label: undefined })); }} placeholder={reel === 2 ? "For example, Camel" : "For example, Parigrah"} />
            {errs.label && <span className="field-err" id="add-label-err" role="alert">{errs.label}</span>}
          </div>
          <div className="field">
            <span className="lbl" id="add-img-l">Image{reel === 2 ? "" : " (optional)"}</span>
            <div className={`drop${hot ? " hot" : ""}${errs.file ? " bad" : ""}`} aria-describedby={errs.file ? "add-file-err" : undefined}
              onClick={(e) => { if (e.target === e.currentTarget) input.current?.click(); }}
              onDragOver={(e) => { e.preventDefault(); setHot(true); }} onDragLeave={() => setHot(false)}
              onDrop={(e) => { e.preventDefault(); setHot(false); take(e.dataTransfer.files?.[0]); }}>
              {file && preview ? (
                <>
                  <Thumb src={preview} size={64} />
                  <span className="drop-text"><strong>{file.name}</strong><small>{file.type.replace("image/", "").toUpperCase()}, {formatBytes(file.size)}</small></span>
                  <button type="button" className="btn btn-secondary" onClick={() => input.current?.click()}>Change</button>
                  <button type="button" className="btn btn-quiet" onClick={() => setFile(null)}>Remove</button>
                </>
              ) : (
                <>
                  <IconImage />
                  <span className="drop-text"><strong>Drop an image here</strong><small>PNG, WebP or SVG, up to 5 MB. Transparent backgrounds work best.</small></span>
                  <button type="button" className="btn btn-secondary" aria-describedby="add-img-l" onClick={() => input.current?.click()}>Choose image</button>
                </>
              )}
            </div>
            <input ref={input} type="file" hidden accept="image/png,image/webp,image/svg+xml" onChange={(e) => { take(e.target.files?.[0]); e.target.value = ""; }} />
            {errs.file && <span className="field-err" id="add-file-err" role="alert">{errs.file}</span>}
          </div>
          <div className="field">
            <span className="lbl">As it will appear</span>
            <ReelPreview reel={reel} label={label.trim()} image={preview} />
          </div>
        </div>
        {errs.form && <p className="field-err" role="alert">{errs.form}</p>}
        <div className="cf-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}><IconPlus /> {busy ? "Adding…" : `Add to Reel ${reel}`}</button>
        </div>
      </form>
    </dialog>
  );
}
