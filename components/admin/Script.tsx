"use client";
import { useEffect, useRef, useState } from "react";
import { api, ApiError, imageProblem, uploadImage } from "./api";
import type { Item, Reel, ScriptRow } from "./types";
import { Empty, IconDown, IconImage, IconPlus, IconTrash, IconUp, Skeleton, Switch, Thumb, useConfirm } from "./ui";

type Props = {
  items: Item[];
  rows: ScriptRow[];
  nextSpin: number;
  loading: boolean;
  busy: boolean;
  /** Saves the whole list straight away. Returns true when it worked. */
  onSaveRows: (rows: ScriptRow[], done: string) => Promise<boolean>;
};
const bySort = (a: Item, b: Item) => a.sort_order - b.sort_order || a.id - b.id;
const errText = (e: unknown) => (e instanceof ApiError ? e.message : "That did not work. Try again.");
type Names = [string, string, string];
type Files = [File | null, File | null, File | null];

/** The three typed names -> item ids. Existing names (any case) are reused, new ones are created. The popup only calls this with all three filled in.
 *  A picture chosen for a reel is saved on that name, so it shows wherever that name is used. */
async function resolveIds(names: Names, files: Files, reelItems: (r: Reel) => Item[]): Promise<(number | null)[]> {
  const ids: (number | null)[] = [];
  for (const r of [1, 2, 3] as Reel[]) {
    const t = names[r - 1].trim();
    const file = files[r - 1];
    if (!t) { ids.push(null); continue; }
    const hit = reelItems(r).find((i) => i.label.toLowerCase() === t.toLowerCase());
    if (hit) {
      if (file) await api(`/api/admin/items/${hit.id}`, "PATCH", { image_url: await uploadImage(file), active: true });
      else if (!hit.active) await api(`/api/admin/items/${hit.id}`, "PATCH", { active: true });
      ids.push(hit.id);
      continue;
    }
    const image_url = file ? await uploadImage(file) : null;
    const { item } = await api<{ item: Item }>("/api/admin/items", "POST", { reel: r, label: t, image_url });
    ids.push(item.id);
  }
  return ids;
}

export default function Script({ items, rows, nextSpin, loading, busy, onSaveRows }: Props) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const reelItems = (r: Reel) => items.filter((i) => i.reel === r).sort(bySort);
  const item = (id: number | null) => (id == null ? undefined : items.find((i) => i.id === id));

  const put = (i: number, p: Partial<ScriptRow>, done: string) => onSaveRows(rows.map((r, k) => (k === i ? { ...r, ...p } : r)), done);
  const mv = (i: number, to: number) => {
    if (to < 0 || to >= rows.length) return;
    const n = [...rows];
    [n[i], n[to]] = [n[to], n[i]];
    void onSaveRows(n, `Spin ${i + 1} moved to spin ${to + 1}.`);
  };
  const confirm = useConfirm();
  const del = async (i: number) => {
    const names = [rows[i].reel1, rows[i].reel2, rows[i].reel3].map((id) => item(id)?.label ?? "Missing").join(" · ");
    const ok = await confirm({
      title: `Delete spin ${i + 1}?`,
      danger: true,
      confirmLabel: "Delete spin",
      body: (
        <>
          <p><strong>{names}</strong></p>
          <p>{i < rows.length - 1 ? `The spins after it move up one place (spin ${i + 2} becomes spin ${i + 1}). ` : ""}This cannot be undone. To keep it but skip it, switch it off instead.</p>
        </>
      ),
    });
    if (ok) void onSaveRows(rows.filter((_, k) => k !== i), `Spin ${i + 1} deleted.`);
  };

  return (
    <div className="sc-wrap">
      <div className="sc-tools">
        <p className="sc-help">Spin 1 is the first pull, spin 2 the second, and so on. After the last spin it starts again from spin 1. Switched-off spins are skipped.</p>
        <button type="button" className="btn btn-primary sc-add" onClick={() => setAdding(true)} disabled={loading || busy}><IconPlus /> Add spin</button>
      </div>
      {adding && (
        <SpinDialog n={rows.length + 1} reelItems={reelItems} onClose={() => setAdding(false)}
          onSave={(ids) => onSaveRows([...rows, { reel1: ids[0], reel2: ids[1], reel3: ids[2], enabled: true, note: "" }], `Spin ${rows.length + 1} added.`)} />
      )}
      {editing !== null && rows[editing] && (
        <SpinDialog n={editing + 1} edit reelItems={reelItems} onClose={() => setEditing(null)}
          names={[rows[editing].reel1, rows[editing].reel2, rows[editing].reel3].map((id) => item(id)?.label ?? "") as Names}
          onSave={(ids) => put(editing, { reel1: ids[0], reel2: ids[1], reel3: ids[2] }, `Spin ${editing + 1} saved.`)} />
      )}

      {loading ? (
        <div className="sc-list" aria-busy="true">
          <span className="sr-only" role="status">Loading the spins</span>
          {[0, 1, 2, 3].map((k) => <div className="sc-row" key={k}><Skeleton h={44} w={48} /><Skeleton h={44} /><Skeleton h={44} /><Skeleton h={44} /></div>)}
        </div>
      ) : rows.length === 0 ? (
        <Empty title="No spins yet. Every pull is random.">Use Add spin to decide what the first pull shows.</Empty>
      ) : (
        <ol className="sc-list" aria-label="Spins">
          {rows.map((r, i) => {
            const n = i + 1;
            const isNext = n === nextSpin;
            const ids = [r.reel1, r.reel2, r.reel3];
            const missing = ids.some((id) => item(id) === undefined);
            return (
              <li key={`${i}-${ids.join("-")}`} className={`sc-row${isNext ? " next" : ""}${!r.enabled ? " off" : ""}${missing ? " missing" : ""}`} aria-current={isNext ? "step" : undefined}>
                <div className="sc-num">
                  <strong>Spin {n}</strong>
                  {isNext && <span className="badge">Next</span>}
                  {missing && <span className="sc-missing">Names missing, press Edit</span>}
                </div>
                {ids.map((id, k) => {
                  const it = item(id);
                  return (
                    <div key={k} className={`sc-cell${it ? "" : " noname"}`}>
                      {it?.image_url ? <Thumb src={it.image_url} size={36} /> : null}
                      <span className="sel-label"><span className="sr-only">Reel {k + 1}: </span>{it?.label ?? "Missing"}</span>
                    </div>
                  );
                })}
                <div className="sc-on"><Switch checked={r.enabled} disabled={busy} label={`Spin ${n} is ${r.enabled ? "on" : "off"}`} onChange={(v) => void put(i, { enabled: v }, `Spin ${n} switched ${v ? "on" : "off"}.`)} /><span className="sc-on-l">{r.enabled ? "On" : "Off"}</span></div>
                <div className="sc-actions">
                  <button type="button" className="iconbtn" aria-label={`Move spin ${n} up`} title="Move up" disabled={busy || i === 0} onClick={() => mv(i, i - 1)}><IconUp /></button>
                  <button type="button" className="iconbtn" aria-label={`Move spin ${n} down`} title="Move down" disabled={busy || i === rows.length - 1} onClick={() => mv(i, i + 1)}><IconDown /></button>
                  <button type="button" className="btn btn-secondary btn-sm" disabled={busy || editing !== null} onClick={() => setEditing(i)}>Edit</button>
                  <button type="button" className="iconbtn danger" aria-label={`Delete spin ${n}`} title="Delete" disabled={busy} onClick={() => void del(i)}><IconTrash /></button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/** Name boxes for the three reels, each with its picture and an upload button in front. */
function NameFields({ names, setNames, files, setFiles, reelItems, busy, onError, missing }: {
  names: Names; setNames: (n: Names) => void; files: Files; setFiles: (f: Files) => void; missing: boolean[];
  reelItems: (r: Reel) => Item[]; busy: boolean; onError: (m: string) => void;
}) {
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const [previews, setPreviews] = useState<(string | null)[]>([null, null, null]);
  useEffect(() => {
    const urls = files.map((f) => (f ? URL.createObjectURL(f) : null));
    setPreviews(urls);
    return () => urls.forEach((u) => u && URL.revokeObjectURL(u));
  }, [files]);
  const known = (r: Reel) => { const t = names[r - 1].trim().toLowerCase(); return t ? reelItems(r).find((i) => i.label.toLowerCase() === t) : undefined; };
  return (
    <>
      {([1, 2, 3] as Reel[]).map((r) => {
        const k = r - 1;
        const pic = previews[k] ?? known(r)?.image_url ?? null;
        return (
          <div className="field" key={r}>
            <label className="lbl" htmlFor={`sp-${r}`}>Reel {r}</label>
            <div className="as-line">
              <input id={`sp-${r}`} className="inp" list={r === 2 ? "sp-animals" : undefined} maxLength={60} autoComplete="off" required value={names[k]} disabled={busy}
                aria-invalid={missing[k]} aria-describedby={missing[k] ? `sp-${r}-err` : undefined}
                onChange={(e) => setNames(names.map((x, i) => (i === k ? e.target.value : x)) as Names)} />
              <button type="button" className={`thumb-btn${files[k] ? " changed" : ""}`} aria-label={`${pic ? "Change" : "Upload"} image for reel ${r}`} onClick={() => refs[k].current?.click()} disabled={busy}>
                <Thumb src={pic} size={44} />
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => refs[k].current?.click()} disabled={busy}><IconImage /> {pic ? "Change image" : "Upload image"}</button>
              <input ref={refs[k]} type="file" hidden accept="image/png,image/webp,image/svg+xml"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; const pr = imageProblem(f); if (pr) onError(pr); else { onError(""); setFiles(files.map((x, i) => (i === k ? f : x)) as Files); } }} />
            </div>
            {missing[k] && <span className="field-err" id={`sp-${r}-err`}>Enter a name for reel {r}.</span>}
            {r === 2 && <datalist id="sp-animals">{reelItems(2).map((i) => <option key={i.id} value={i.label} />)}</datalist>}
          </div>
        );
      })}
    </>
  );
}

/** Popup to add a spin or edit one (mounted only while open). Saves straight away. */
function SpinDialog({ n, edit, names: start, reelItems, onClose, onSave }: {
  n: number; edit?: boolean; names?: Names; reelItems: (r: Reel) => Item[]; onClose: () => void; onSave: (ids: (number | null)[]) => Promise<boolean>;
}) {
  const dlg = useRef<HTMLDialogElement>(null);
  const [names, setNames] = useState<Names>(start ?? ["", "", ""]);
  const [files, setFiles] = useState<Files>([null, null, null]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const missing = names.map((x) => tried && !x.trim());
  useEffect(() => {
    const d = dlg.current;
    if (d && !d.open) d.showModal();
    return () => { if (d?.open) d.close(); };
  }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setTried(true);
    const empty = names.findIndex((x) => !x.trim());
    if (empty >= 0) { document.getElementById(`sp-${empty + 1}`)?.focus(); return; }
    setBusy(true);
    try {
      if (await onSave(await resolveIds(names, files, reelItems))) onClose();
    } catch (x) {
      setErr(errText(x));
    } finally {
      setBusy(false);
    }
  };
  return (
    <dialog ref={dlg} className="cf cf-wide cf-spin" aria-labelledby="spin-dlg-title"
      onCancel={(e) => { e.preventDefault(); if (!busy) onClose(); }}
      onClick={(e) => { if (e.target === dlg.current && !busy) onClose(); }}>
      <form className="cf-body" onSubmit={submit} noValidate>
        <h2 id="spin-dlg-title">{edit ? `Edit spin ${n}` : `Add spin ${n}`}</h2>
        <p className="as-help">Type a name for all three reels. An image is optional.</p>
        <div className="as-grid">
          <NameFields names={names} setNames={setNames} files={files} setFiles={setFiles} reelItems={reelItems} busy={busy} onError={setErr} missing={missing} />
        </div>
        {err && <p className="field-err" role="alert">{err}</p>}
        <div className="cf-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{edit ? (busy ? "Saving…" : "Save") : <><IconPlus /> {busy ? "Adding…" : "Add spin"}</>}</button>
        </div>
      </form>
    </dialog>
  );
}
