import {
  publicClient,
  namehash,
  PUBLIC_RESOLVER,
  EVENT_MANAGER,
  EVENT_MANAGER_ABI,
  PARENT_NAME,
  FROM_BLOCK,
  RESOLVER_ABI,
  KEYS,
} from "./chain";
import { parseAbiItem, getAddress, type Address } from "viem";

export type EventData = {
  name: string;
  label: string;
  node: `0x${string}`;
  title: string;
  location: string;
  date: string;
  category: string;
  url: string;
  capacity: number;
  rsvpCount: number;
  host: Address;
  exists: boolean;
};

export type Attendee = {
  label: string;
  ticketName: string;
  attendee: Address;
  status: string;
};

function text(node: `0x${string}`, key: string) {
  return publicClient.readContract({
    address: PUBLIC_RESOLVER,
    abi: RESOLVER_ABI,
    functionName: "text",
    args: [node, key],
  });
}

function eventsCall(node: `0x${string}`) {
  return publicClient.readContract({
    address: EVENT_MANAGER,
    abi: EVENT_MANAGER_ABI,
    functionName: "events",
    args: [node],
  }) as Promise<readonly [Address, bigint, bigint, boolean]>;
}

export async function loadEvent(name: string): Promise<EventData> {
  const node = namehash(name);
  const label = name.endsWith(`.${PARENT_NAME}`) ? name.slice(0, -(PARENT_NAME.length + 1)) : name;
  const [title, location, date, category, url, ev] = await Promise.all([
    text(node, KEYS.title),
    text(node, KEYS.location),
    text(node, KEYS.date),
    text(node, KEYS.category),
    text(node, KEYS.url),
    eventsCall(node),
  ]);
  const [host, capacity, rsvpCount, exists] = ev;
  return {
    name,
    label,
    node,
    title,
    location,
    date,
    category,
    url,
    capacity: Number(capacity),
    rsvpCount: Number(rsvpCount),
    host,
    exists,
  };
}

const EVENT_CREATED = parseAbiItem(
  "event EventCreated(bytes32 indexed eventNode, address indexed host, string label, uint256 capacity)"
);

/// Discover every event from EventCreated logs, then resolve each from ENS records.
/// Revoked events (exists == false) are filtered out.
export async function loadAllEvents(): Promise<EventData[]> {
  let logs;
  try {
    logs = await publicClient.getLogs({
      address: EVENT_MANAGER,
      event: EVENT_CREATED,
      fromBlock: FROM_BLOCK,
      toBlock: "latest",
    });
  } catch {
    return [];
  }
  const labels = Array.from(new Set(logs.map((l) => l.args.label as string).filter(Boolean)));
  const events = await Promise.all(labels.map((label) => loadEvent(`${label}.${PARENT_NAME}`)));
  return events.filter((e) => e.exists).sort((a, b) => a.date.localeCompare(b.date));
}

const RSVP_EVENT = parseAbiItem(
  "event RSVP(bytes32 indexed eventNode, bytes32 indexed ticketNode, address indexed attendee, string label)"
);

export async function loadAttendees(eventName: string): Promise<Attendee[]> {
  const eventNode = namehash(eventName);
  let logs;
  try {
    logs = await publicClient.getLogs({
      address: EVENT_MANAGER,
      event: RSVP_EVENT,
      args: { eventNode },
      fromBlock: FROM_BLOCK,
      toBlock: "latest",
    });
  } catch {
    return [];
  }
  const out: Attendee[] = [];
  for (const log of logs) {
    const label = (log.args.label as string) ?? "";
    const ticketNode = log.args.ticketNode as `0x${string}`;
    const attendee = log.args.attendee as Address;
    const status = await text(ticketNode, KEYS.status).catch(() => "");
    out.push({ label, ticketName: `${label}.${eventName}`, attendee, status });
  }
  return out;
}

export async function readOwner(): Promise<Address> {
  return publicClient.readContract({
    address: EVENT_MANAGER,
    abi: EVENT_MANAGER_ABI,
    functionName: "owner",
  }) as Promise<Address>;
}

export function sameAddr(a?: string, b?: string) {
  if (!a || !b) return false;
  try {
    return getAddress(a) === getAddress(b);
  } catch {
    return false;
  }
}
