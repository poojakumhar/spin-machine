"use client";
import type { Reel, Stats } from "./types";
import { REEL_KIND } from "./types";
import { SCRIPT_UI } from "./types";
import { Empty, Skeleton } from "./ui";

const when = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export default function StatsView({ stats, loading }: { stats: Stats | null; loading: boolean }) {
  if (loading || !stats) {
    return (
      <div aria-busy="true">
        <span className="sr-only" role="status">Loading stats</span>
        <Skeleton h={88} />
        <div className="gap" />
        <Skeleton h={200} />
      </div>
    );
  }
  const max = Math.max(1, ...stats.perItem.map((p) => p.count));
  return (
    <div className="st-wrap">
      <dl className="stat-strip">
        <div><dt>Total spins</dt><dd>{stats.total}</dd></div>
        {SCRIPT_UI ? (
          <>
            <div><dt>From the script</dt><dd>{stats.scripted}</dd></div>
            <div><dt>Random</dt><dd>{stats.total - stats.scripted}</dd></div>
            <div><dt>Next script spin</dt><dd>#{stats.nextSpin}</dd></div>
          </>
        ) : (
          <div><dt>Latest spin</dt><dd className="small">{stats.history[0] ? when.format(new Date(stats.history[0].created_at)) : "None yet"}</dd></div>
        )}
      </dl>

      {stats.total === 0 ? (
        <Empty title="No spins yet.">Once the kiosk is used, every result shows up here with the counts for each item.</Empty>
      ) : (
        <>
          <section className="panel">
            <h2>How often each item came up</h2>
            <div className="bars">
              {([1, 2, 3] as Reel[]).map((r) => (
                <div key={r} className="bars-col">
                  <h3>Reel {r}, {REEL_KIND[r]}</h3>
                  <ul>
                    {stats.perItem.filter((p) => p.reel === r).map((p) => (
                      <li key={p.id}>
                        <span className="bar-label">{p.label}</span>
                        <span className="bar" aria-hidden><span style={{ width: `${(p.count / max) * 100}%` }} /></span>
                        <span className="bar-n">{p.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2>Most frequent combinations</h2>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th scope="col">Reel 1</th><th scope="col">Reel 2</th><th scope="col">Reel 3</th><th scope="col" className="num">Times</th></tr></thead>
                <tbody>{stats.combos.map((c, i) => <tr key={i}><td>{c.a}</td><td>{c.b}</td><td>{c.c}</td><td className="num">{c.count}</td></tr>)}</tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <h2>Recent spins</h2>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th scope="col">#</th><th scope="col">When</th><th scope="col">Reel 1</th><th scope="col">Reel 2</th><th scope="col">Reel 3</th>{SCRIPT_UI && <th scope="col">Source</th>}</tr></thead>
                <tbody>
                  {stats.history.map((h) => (
                    <tr key={h.id}>
                      <td>{h.seq}</td>
                      <td className="nowrap">{when.format(new Date(h.created_at))}</td>
                      <td>{h.a}</td><td>{h.b}</td><td>{h.c}</td>
                      {SCRIPT_UI && <td>{h.script_position ? <span className="badge">Script {h.script_position}</span> : <span className="badge plain">Random</span>}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {stats.total > stats.history.length && <p className="muted">Showing the latest {stats.history.length} of {stats.total} spins.</p>}
          </section>
        </>
      )}
    </div>
  );
}
