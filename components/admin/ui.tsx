"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Reel } from "./types";

/* ───────── icons (stroke, inherit colour) ───────── */
const I = ({ d, size = 22, fill }: { d: string; size?: number; fill?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);
export const IconReels = () => <I d="M4 5h4v14H4zM10 5h4v14h-4zM16 5h4v14h-4z" />;
export const IconScript = () => <I d="M5 4h14v16H5zM9 9h6M9 13h6M9 17h3" />;
export const IconStats = () => <I d="M5 20V10M12 20V4M19 20v-7" />;
export const IconGear = () => <I d="M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 00-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 00-2-1.2L14.2 3h-4l-.4 2.6a7 7 0 00-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 005 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9a7 7 0 002 1.2l.4 2.6h4l.4-2.6a7 7 0 002-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z" />;
export const IconGrip = () => <I d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" size={24} />;
export const IconTrash = () => <I d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />;
export const IconCheck = () => <I d="M5 12.5l4.5 4.5L19 7" />;
export const IconUp = () => <I d="M6 14l6-6 6 6" />;
export const IconDown = () => <I d="M6 10l6 6 6-6" />;
export const IconCopy = () => <I d="M9 9h10v11H9zM5 15V4h10" />;
export const IconPlus = () => <I d="M12 5v14M5 12h14" />;
export const IconWarn = () => <I d="M12 4l9 16H3zM12 10v4M12 17h.01" />;
export const IconImage = () => <I d="M4 5h16v14H4zM8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM4 17l5-5 4 4 3-3 4 4" />;
export const IconChevron = () => <I d="M7 10l5 5 5-5" size={18} />;

/* ───────── toasts ───────── */
type T = { id: number; msg: string; kind: "ok" | "err" };
const ToastCtx = createContext<(msg: string, kind?: "ok" | "err") => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<T[]>([]);
  const next = useRef(0);
  const push = useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    const id = ++next.current;
    setList((l) => [...l, { id, msg, kind }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), kind === "err" ? 8000 : 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="region" aria-label="Notifications" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`} role={t.kind === "err" ? "alert" : "status"}>
            <span>{t.msg}</span>
            <button type="button" aria-label="Dismiss message" onClick={() => setList((l) => l.filter((x) => x.id !== t.id))}>×</button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ───────── confirm dialog (native <dialog>: focus trap and Esc come for free) ───────── */
type Ask = { title: string; body: ReactNode; confirmLabel: string; danger?: boolean };
const ConfirmCtx = createContext<(o: Ask) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [ask, setAsk] = useState<Ask | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const open = useCallback((o: Ask) => new Promise<boolean>((res) => { resolver.current = res; setAsk(o); }), []);
  useEffect(() => { if (ask && !ref.current?.open) ref.current?.showModal(); }, [ask]);
  const close = (v: boolean) => {
    ref.current?.close();
    setAsk(null);
    resolver.current?.(v);
    resolver.current = null;
  };
  return (
    <ConfirmCtx.Provider value={open}>
      {children}
      <dialog ref={ref} className="cf" aria-labelledby="cf-title" onCancel={(e) => { e.preventDefault(); close(false); }} onClick={(e) => { if (e.target === ref.current) close(false); }}>
        {ask && (
          <div className="cf-body">
            <h2 id="cf-title">{ask.title}</h2>
            <div className="cf-text">{ask.body}</div>
            <div className="cf-actions">
              <button type="button" className="btn btn-secondary" onClick={() => close(false)} autoFocus>Cancel</button>
              <button type="button" className={`btn ${ask.danger ? "btn-danger" : "btn-primary"}`} onClick={() => close(true)}>{ask.confirmLabel}</button>
            </div>
          </div>
        )}
      </dialog>
    </ConfirmCtx.Provider>
  );
}

/* ───────── small controls ───────── */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={`sw${checked ? " on" : ""}`} onClick={() => onChange(!checked)}>
      <span className="sw-track"><span className="sw-knob" /></span>
    </button>
  );
}

export function Stepper({ value, onChange, label, disabled, max = 99 }: { value: number; onChange: (v: number) => void; label: string; disabled?: boolean; max?: number }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = (raw: string) => {
    const n = Math.min(max, Math.max(0, Math.round(Number(raw))));
    if (!Number.isFinite(n) || raw.trim() === "") return setText(String(value));
    setText(String(n));
    if (n !== value) onChange(n);
  };
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" aria-label={`Lower ${label}`} disabled={disabled || value <= 0} onClick={() => onChange(value - 1)}>−</button>
      <input inputMode="numeric" aria-label={label} value={text} disabled={disabled} onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, ""))}
        onBlur={(e) => commit(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") commit((e.target as HTMLInputElement).value); }} />
      <button type="button" aria-label={`Raise ${label}`} disabled={disabled || value >= max} onClick={() => onChange(value + 1)}>+</button>
    </div>
  );
}

export function Banner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="banner" role="alert">
      <IconWarn />
      <div className="banner-msg"><strong>Something needs attention.</strong> {message}</div>
      {onRetry && <button type="button" className="btn btn-secondary" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export const Skeleton = ({ h = 20, w = "100%" }: { h?: number; w?: string | number }) => <div className="skel" style={{ height: h, width: w }} aria-hidden />;

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}

/** Image on a checkerboard so transparent PNGs are visible as transparent. */
export function Thumb({ src, size = 56 }: { src: string | null; size?: number }) {
  return (
    <span className="thumb" style={{ width: size, height: size }}>
      {src ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={src} alt="" /> : <span className="thumb-none"><IconImage /></span>}
    </span>
  );
}

/** The item as it will appear on the reel: same fonts and colours as the kiosk. */
export function ReelPreview({ reel, label, image, dim }: { reel: Reel; label: string; image: string | null; dim?: boolean }) {
  return (
    <span className={`pv ${reel === 2 ? "pv-animal" : "pv-word"}${dim ? " dim" : ""}`} title="How this looks on the reel">
      {reel === 2 && image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={image} alt="" />}
      {label ? <span className="pv-text">{label}</span> : <span className="pv-empty">Type a label to see it</span>}
    </span>
  );
}
