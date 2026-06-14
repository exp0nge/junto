import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import {
  EVENT_MANAGER,
  EVENT_MANAGER_ABI,
  PARENT_NAME,
  getWallet,
  hasWallet,
  namehash,
  publicClient,
} from "./lib/chain";
import {
  loadAllEvents,
  loadEvent,
  loadAttendees,
  readOwner,
  sameAddr,
  type EventData,
  type Attendee,
} from "./lib/ens";

function Mark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
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

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

type View = { kind: "list" } | { kind: "detail"; name: string };

export default function App() {
  const [view, setView] = useState<View>({ kind: "list" });
  const [account, setAccount] = useState<Address | null>(null);
  const [owner, setOwner] = useState<Address | null>(null);

  useEffect(() => {
    readOwner().then(setOwner).catch(() => {});
  }, []);

  const connect = useCallback(async () => {
    const { account } = await getWallet();
    setAccount(account);
    return account;
  }, []);

  const isOwner = sameAddr(account ?? undefined, owner ?? undefined);

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand" onClick={() => setView({ kind: "list" })}>
          <Mark />
          <strong>Junto</strong>
        </div>
        <div className="spacer" />
        {account ? (
          <span className="account mono">{account.slice(0, 6)}…{account.slice(-4)}</span>
        ) : (
          <button className="ghost" onClick={() => connect().catch((e) => alert(e.message))}>
            {hasWallet() ? "Connect wallet" : "Get MetaMask"}
          </button>
        )}
      </header>

      {view.kind === "list" ? (
        <ListView
          account={account}
          isOwner={isOwner}
          onConnect={connect}
          onOpen={(name) => setView({ kind: "detail", name })}
        />
      ) : (
        <EventDetail
          name={view.name}
          account={account}
          isOwner={isOwner}
          onConnect={connect}
          onBack={() => setView({ kind: "list" })}
        />
      )}

      <footer className="foot">
        Events &amp; RSVPs live entirely in ENS records — no backend ·{" "}
        <a href={`https://sepolia.etherscan.io/address/${EVENT_MANAGER}`} target="_blank" rel="noreferrer">
          contract
        </a>{" "}
        ·{" "}
        <a href="https://sepolia.app.ens.domains" target="_blank" rel="noreferrer">
          {PARENT_NAME}
        </a>
      </footer>
    </div>
  );
}

function ListView({
  account,
  isOwner,
  onConnect,
  onOpen,
}: {
  account: Address | null;
  isOwner: boolean;
  onConnect: () => Promise<Address>;
  onOpen: (name: string) => void;
}) {
  const [events, setEvents] = useState<EventData[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const refresh = useCallback(() => {
    setEvents(null);
    loadAllEvents().then(setEvents).catch(() => setEvents([]));
  }, []);

  useEffect(() => refresh(), [refresh]);

  return (
    <>
      <section className="hero">
        <h1>
          Events that live <span className="grad">on ENS</span>.
        </h1>
        <p>
          Every event is an ENS name. Every RSVP mints a <em>ticket subname</em> you own. No
          database, no logins — just names. Discover what's happening, RSVP from your wallet, and
          carry your ticket as <span className="mono">you.event.{PARENT_NAME}</span>.
        </p>
        <div className="hero-cta">
          <button onClick={() => setShowCreate((s) => !s)}>Host an event</button>
          <a className="link" href="#events">Browse events ↓</a>
        </div>
      </section>

      {showCreate && (
        <CreateEvent
          account={account}
          onConnect={onConnect}
          onCreated={() => {
            setShowCreate(false);
            refresh();
          }}
        />
      )}

      <section id="events" className="events">
        <div className="section-head">
          <h2>Upcoming in NYC</h2>
          <span className="count">{events ? `${events.length} events` : "loading…"}</span>
        </div>
        {events === null ? (
          <div className="muted">Reading events from ENS…</div>
        ) : events.length === 0 ? (
          <div className="muted">No events yet — host the first.</div>
        ) : (
          <div className="grid">
            {events.map((e) => (
              <EventCard key={e.node} ev={e} onOpen={() => onOpen(e.name)} />
            ))}
          </div>
        )}
      </section>

      {isOwner && <div className="owner-badge">You are the Junto moderator — open any event to revoke it.</div>}
    </>
  );
}

function EventCard({ ev, onOpen }: { ev: EventData; onOpen: () => void }) {
  const full = ev.capacity > 0 && ev.rsvpCount >= ev.capacity;
  return (
    <button className="card-btn" onClick={onOpen}>
      <div className="cat">{ev.category || "Event"}</div>
      <div className="card-title">{ev.title || ev.label}</div>
      <div className="ensname mono">{ev.name}</div>
      <div className="card-meta">
        <span>📍 {ev.location || "—"}</span>
        <span>📅 {ev.date || "TBA"}</span>
      </div>
      <div className="card-foot">
        <span className={`rsvps ${full ? "full" : ""}`}>
          {ev.rsvpCount}
          {ev.capacity > 0 ? ` / ${ev.capacity}` : ""} going
        </span>
        <span className="open">View →</span>
      </div>
    </button>
  );
}

function CreateEvent({
  account,
  onConnect,
  onCreated,
}: {
  account: Address | null;
  onConnect: () => Promise<Address>;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("Meetup");
  const [capacity, setCapacity] = useState("50");
  const [label, setLabel] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const derived = label || slugify(title);

  async function submit() {
    setBusy(true);
    setStatus("");
    try {
      const acct = account ?? (await onConnect());
      const lbl = (label || slugify(title)).trim();
      if (!lbl) throw new Error("Enter a title");
      const { wallet } = await getWallet();
      const keys = ["xyz.junto.title", "xyz.junto.location", "xyz.junto.capacity", "xyz.junto.date", "xyz.junto.category"];
      const values = [title, location, capacity, date, category];
      setStatus(`Creating ${lbl}.${PARENT_NAME} …`);
      const hash = await wallet.writeContract({
        account: acct,
        address: EVENT_MANAGER,
        abi: EVENT_MANAGER_ABI,
        functionName: "createEvent",
        args: [lbl, BigInt(capacity || "0"), keys, values],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus("✓ Event created on ENS.");
      onCreated();
    } catch (e: any) {
      setStatus(e?.shortMessage ?? e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card create">
      <div className="eyebrow">HOST AN EVENT · MINTS AN ENS SUBNAME (ANYONE CAN HOST)</div>
      <div className="form-grid">
        <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
        <input placeholder="Capacity" inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        <input placeholder="label (auto)" value={derived} onChange={(e) => setLabel(slugify(e.target.value))} />
      </div>
      <div className="create-foot">
        <span className="mono preview">{derived || "your-event"}.{PARENT_NAME}</span>
        <button onClick={submit} disabled={busy}>
          {busy ? "Working…" : "Create event"}
        </button>
      </div>
      {status && <div className="status">{status}</div>}
    </section>
  );
}

function EventDetail({
  name,
  account,
  isOwner,
  onConnect,
  onBack,
}: {
  name: string;
  account: Address | null;
  isOwner: boolean;
  onConnect: () => Promise<Address>;
  onBack: () => void;
}) {
  const [ev, setEv] = useState<EventData | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [label, setLabel] = useState("");
  const [status, setStatus] = useState("");
  const [txHash, setTxHash] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setEv(await loadEvent(name));
    setAttendees(await loadAttendees(name));
  }, [name]);

  useEffect(() => {
    refresh().catch((e) => setStatus(String(e)));
  }, [refresh]);

  async function rsvp() {
    setBusy(true);
    setStatus("");
    setTxHash("");
    try {
      const acct = account ?? (await onConnect());
      const clean = slugify(label);
      if (!clean) throw new Error("Enter a label, e.g. your name");
      const { wallet } = await getWallet();
      setStatus(`Minting ${clean}.${name} …`);
      const hash = await wallet.writeContract({
        account: acct,
        address: EVENT_MANAGER,
        abi: EVENT_MANAGER_ABI,
        functionName: "rsvp",
        args: [namehash(name), clean],
      });
      setTxHash(hash);
      setStatus("Waiting for confirmation …");
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus(`✓ You're going — ${clean}.${name} is yours.`);
      setLabel("");
      await refresh();
    } catch (e: any) {
      setStatus(e?.shortMessage ?? e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!ev) return;
    if (!confirm(`Revoke "${ev.title}"? This blocks new RSVPs and flags it revoked in ENS.`)) return;
    setBusy(true);
    setStatus("");
    try {
      const acct = account ?? (await onConnect());
      const { wallet } = await getWallet();
      const hash = await wallet.writeContract({
        account: acct,
        address: EVENT_MANAGER,
        abi: EVENT_MANAGER_ABI,
        functionName: "revokeEvent",
        args: [namehash(name)],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus("Event revoked.");
      onBack();
    } catch (e: any) {
      setStatus(e?.shortMessage ?? e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  const full = !!ev && ev.capacity > 0 && ev.rsvpCount >= ev.capacity;

  return (
    <>
      <button className="back" onClick={onBack}>← All events</button>

      <section className="card event">
        <div className="eyebrow">{ev?.category?.toUpperCase() || "EVENT"} · ENS NAME</div>
        <h2>{ev?.title || "…"}</h2>
        <div className="ensname mono">{name}</div>
        {ev?.url && (
          <a className="evurl" href={ev.url} target="_blank" rel="noreferrer">{ev.url} ↗</a>
        )}
        <div className="meta">
          <div><span className="k">Location</span><span className="v">{ev?.location || "—"}</span></div>
          <div><span className="k">Date</span><span className="v">{ev?.date || "TBA"}</span></div>
          <div>
            <span className="k">RSVPs</span>
            <span className="v">{ev?.rsvpCount ?? 0}{ev && ev.capacity > 0 ? ` / ${ev.capacity}` : ""}</span>
          </div>
        </div>
        {isOwner && (
          <button className="danger" onClick={revoke} disabled={busy}>Revoke event</button>
        )}
      </section>

      <section className="card">
        <div className="eyebrow">RSVP · MINTS A TICKET SUBNAME YOU OWN</div>
        <div className="rsvp-row">
          <div className="field">
            <input value={label} placeholder="alice" onChange={(e) => setLabel(e.target.value)} disabled={busy || full} />
            <span className="suffix">.{name}</span>
          </div>
          <button onClick={rsvp} disabled={busy || full}>
            {full ? "Full" : busy ? "Working…" : account ? "RSVP" : "Connect & RSVP"}
          </button>
        </div>
        {!hasWallet() && <div className="status">No wallet detected — install MetaMask to RSVP.</div>}
        {status && <div className="status">{status}</div>}
        {txHash && (
          <a className="txlink" href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer">
            view transaction ↗
          </a>
        )}
      </section>

      <section className="card">
        <div className="eyebrow">ATTENDEES · TICKET SUBNAMES</div>
        {attendees.length === 0 ? (
          <div className="muted">No RSVPs yet — be the first.</div>
        ) : (
          <ul className="attendees">
            {attendees.map((a) => (
              <li key={a.ticketName}>
                <span className="mono name">{a.ticketName}</span>
                <span className={`chip ${a.status === "going" ? "go" : ""}`}>{a.status || "—"}</span>
                <span className="addr mono">{a.attendee.slice(0, 6)}…{a.attendee.slice(-4)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
