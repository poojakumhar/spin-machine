"use client";
import { useState } from "react";
import { api, ApiError } from "./api";
import { SCRIPT_UI } from "./types";
import { Skeleton, useConfirm, useToast } from "./ui";

type Props = { nextSpin: number; totalSpins: number; scriptLength: number; loading: boolean; onChanged: () => void };

export default function Settings({ nextSpin, totalSpins, scriptLength, loading, onChanged }: Props) {
  const confirm = useConfirm();
  const toast = useToast();
  const [busy, setBusy] = useState<"" | "position" | "history">("");

  async function run(action: "position" | "history") {
    setBusy(action);
    try {
      await api("/api/admin/reset", "POST", { action });
      toast(action === "position" ? "The script will start again at spin 1." : "Spin history deleted.");
      onChanged();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "That did not work. Try again.", "err");
    } finally {
      setBusy("");
    }
  }

  async function restart() {
    const ok = await confirm({
      title: "Restart the script at spin 1?",
      confirmLabel: "Restart script",
      body: (
        <>
          <p>The next spin will use row 1 of the script, and every row becomes playable again.</p>
          <ul><li><strong>Kept:</strong> the script rows, all {totalSpins} recorded spins and every reel item.</li></ul>
        </>
      ),
    });
    if (ok) void run("position");
  }

  async function clear() {
    const ok = await confirm({
      title: `Delete all ${totalSpins} recorded spins?`,
      danger: true,
      confirmLabel: "Delete history",
      body: (
        <>
          <p>This erases the spin history and the counts on the Stats page. It cannot be undone.</p>
          <ul>
            <li><strong>Deleted:</strong> {totalSpins} recorded spins.</li>
            <li><strong>Kept:</strong> every reel item and its weight{SCRIPT_UI ? ", and the spin script" : ""}.</li>
            {SCRIPT_UI && <li>The script restarts at spin 1.</li>}
          </ul>
        </>
      ),
    });
    if (ok) void run("history");
  }

  if (loading) return <div aria-busy="true"><Skeleton h={120} /><div className="gap" /><Skeleton h={120} /></div>;
  return (
    <div className="set-wrap">
      {SCRIPT_UI && <section className="set-block">
        <div>
          <h2>Restart the script</h2>
          <p>The next spin is <strong>spin {nextSpin}</strong>{scriptLength ? ` of ${scriptLength} scripted` : ""}. Restart to run the script from the top, for example before a new session.</p>
        </div>
        <button type="button" className="btn btn-secondary" disabled={busy !== ""} onClick={() => void restart()}>{busy === "position" ? "Restarting…" : "Restart at spin 1"}</button>
      </section>}

      <section className="set-block">
        <div>
          <h2>Spin history</h2>
          <p>{totalSpins === 0 ? "No spins are recorded yet." : `${totalSpins} spins are recorded. Clearing them resets the counts on the Stats page.`}</p>
        </div>
        <button type="button" className="btn btn-danger" disabled={busy !== "" || totalSpins === 0} onClick={() => void clear()}>{busy === "history" ? "Deleting…" : "Delete history"}</button>
      </section>

      <section className="set-block plain">
        <div>
          <h2>Sign-in</h2>
          <p>The login ID and password come from <code>ADMIN_USERNAME</code> and <code>ADMIN_PASSWORD</code> in the <code>.env.local</code> file. After changing them, restart the server. Five wrong attempts lock sign-in for 10 minutes.</p>
        </div>
      </section>
    </div>
  );
}
