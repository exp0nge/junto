import { useEffect, useState, useCallback } from "react";
import {
  EVENT_MANAGER,
  EVENT_MANAGER_ABI,
  DEFAULT_EVENT,
  getWallet,
  namehash,
  publicClient,
} from "./lib/chain";
import { loadEvent, loadAttendees, type EventData, type Attendee } from "./lib/ens";

function Mark() {
  return (
    <svg width="40" height="40" viewBox="0 0 100 100" aria-hidden>
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <line x1="50" y1="34" x2="24" y2="72" stroke="url(#g)" strokeWidth="5" />
      <line x1="50" y1="34" x2="50" y2="72" stroke="url(#g)" strokeWidth="5" />
      <line x1="50" y1="34" x2="76" y2="72" stroke="url(#g)" strokeWidth="5" />
      <circle cx="50" cy="34" r="11" fill="url(#g)" />
      {[24, 50, 76].map((x) => (
        <circle key={x} cx={x} cy="72" r="7" fill="#0d1117" stroke="url(#g)" strokeWidth="4" />
      ))}
    </svg>
  );
}

export default function App() {
  const [eventName] = useState(DEFAULT_EVENT);
  const [ev, setEv] = useState<EventData | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [label, setLabel] = useState("");
  const [account, setAccount] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setEv(await loadEvent(eventName));
    setAttendees(await loadAttendees(eventName));
  }, [eventName]);

  useEffect(() => {
    refresh().catch((e) => setStatus(String(e)));
  }, [refresh]);

  async function rsvp() {
    setBusy(true);
    setStatus("");
    setTxHash("");
    try {
      const { wallet, account } = await getWallet();
      setAccount(account);
      const clean = label.trim().toLowerCase();
      if (!clean) throw new Error("Enter a label, e.g. your name");
      setStatus(`Minting ${clean}.${eventName} …`);
      const hash = await wallet.writeContract({
        account,
        address: EVENT_MANAGER,
        abi: EVENT_MANAGER_ABI,
        functionName: "rsvp",
        args: [namehash(eventName), clean],
      });
      setTxHash(hash);
      setStatus("Waiting for confirmation …");
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus(`✓ You're going — ${clean}.${eventName} is yours.`);
      setLabel("");
      await refresh();
    } catch (e: any) {
      setStatus(e?.shortMessage ?? e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  const cap = ev && Number(ev.capacity) > 0 ? Number(ev.capacity) : null;
  const count = ev ? Number(ev.rsvpCount) : 0;

  return (
    <div className="wrap">
      <header>
        <Mark />
        <div>
          <h1>Junto</h1>
          <span className="tag">events &amp; RSVPs, native to ENS</span>
        </div>
        <a className="net" href="https://sepolia.app.ens.domains" target="_blank" rel="noreferrer">
          Sepolia
        </a>
      </header>

      <section className="card event">
        <div className="eyebrow">EVENT · ENS NAME</div>
        <h2>{ev?.title || "…"}</h2>
        <div className="ensname">{eventName}</div>
        <div className="meta">
          <div>
            <span className="k">Location</span>
            <span className="v">{ev?.location || "—"}</span>
          </div>
          <div>
            <span className="k">RSVPs</span>
            <span className="v">
              {count}
              {cap ? ` / ${cap}` : ""}
            </span>
          </div>
          <div>
            <span className="k">Records</span>
            <span className="v mono">xyz.junto.*</span>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="eyebrow">RSVP · MINTS A TICKET SUBNAME YOU OWN</div>
        <div className="rsvp-row">
          <div className="field">
            <input
              value={label}
              placeholder="alice"
              onChange={(e) => setLabel(e.target.value)}
              disabled={busy}
            />
            <span className="suffix">.{eventName}</span>
          </div>
          <button onClick={rsvp} disabled={busy}>
            {busy ? "Working…" : account ? "RSVP" : "Connect & RSVP"}
          </button>
        </div>
        {status && <div className="status">{status}</div>}
        {txHash && (
          <a className="txlink" href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer">
            view transaction ↗
          </a>
        )}
      </section>

      <section className="card">
        <div className="eyebrow">ATTENDEES · TICKET SUBNAMES</div>
        {attendees.length === 0 && <div className="empty">No RSVPs yet — be the first.</div>}
        <ul className="attendees">
          {attendees.map((a) => (
            <li key={a.ticketName}>
              <span className="mono name">{a.ticketName}</span>
              <span className={`chip ${a.status === "going" ? "go" : ""}`}>{a.status || "—"}</span>
              <span className="addr mono">{a.attendee.slice(0, 6)}…{a.attendee.slice(-4)}</span>
            </li>
          ))}
        </ul>
      </section>

      <footer>
        Contract{" "}
        <a href={`https://sepolia.etherscan.io/address/${EVENT_MANAGER}`} target="_blank" rel="noreferrer" className="mono">
          {EVENT_MANAGER.slice(0, 10)}…
        </a>{" "}
        · data lives entirely in ENS records, no backend
      </footer>
    </div>
  );
}
