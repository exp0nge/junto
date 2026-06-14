import {
  publicClient,
  namehash,
  PUBLIC_RESOLVER,
  EVENT_MANAGER,
  FROM_BLOCK,
  RESOLVER_ABI,
  EVENT_MANAGER_ABI,
  KEYS,
} from "./chain";
import { parseAbiItem, type Address } from "viem";

export type EventData = {
  name: string;
  node: `0x${string}`;
  title: string;
  location: string;
  capacity: string;
  rsvpCount: bigint;
  exists: boolean;
};

export type Attendee = {
  label: string;
  ticketName: string;
  attendee: Address;
  status: string;
};

async function text(node: `0x${string}`, key: string) {
  return publicClient.readContract({
    address: PUBLIC_RESOLVER,
    abi: RESOLVER_ABI,
    functionName: "text",
    args: [node, key],
  });
}

export async function loadEvent(name: string): Promise<EventData> {
  const node = namehash(name);
  const [title, location, capacity, ev] = await Promise.all([
    text(node, KEYS.title),
    text(node, KEYS.location),
    text(node, KEYS.capacity),
    publicClient.readContract({
      address: EVENT_MANAGER,
      abi: EVENT_MANAGER_ABI,
      functionName: "events",
      args: [node],
    }),
  ]);
  const [, capOnChain, rsvpCount, exists] = ev as readonly [Address, bigint, bigint, boolean];
  return {
    name,
    node,
    title,
    location,
    capacity: capacity || capOnChain.toString(),
    rsvpCount,
    exists,
  };
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
