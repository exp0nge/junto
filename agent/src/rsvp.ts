import { namehash } from "viem/ens";
import type { Address } from "viem";
import {
  publicClient,
  getWalletClient,
  requireEnv,
  EVENT_MANAGER_ABI,
  RESOLVER_ABI,
  PUBLIC_RESOLVER,
  KEYS,
} from "./config.js";
import { readEvent } from "./resolveEvent.js";

/// End-to-end paymentless RSVP, acting as an ENS-named agent on a person's behalf:
///   1. resolve the event by name and read its records
///   2. call EventManager.rsvp -> mints a ticket subname owned by the attendee
///   3. re-resolve the ticket subname to confirm status=going
///
/// Usage: tsx src/rsvp.ts <event-ens-name> <attendee-label>
async function main() {
  const eventName = process.argv[2];
  const attendeeLabel = process.argv[3];
  if (!eventName || !attendeeLabel) {
    throw new Error("Usage: tsx src/rsvp.ts <event-ens-name> <attendee-label>");
  }
  const eventManager = requireEnv("EVENT_MANAGER") as Address;

  console.log("Discovering event via ENS resolution...");
  const e = await readEvent(eventName);
  console.log(`  -> "${e.title}" in ${e.location} (cap ${e.capacity})`);

  const eventNode = namehash(eventName);
  const wallet = getWalletClient();

  console.log(`RSVPing as ${attendeeLabel}.${eventName} (attendee ${wallet.account.address})...`);
  const hash = await wallet.writeContract({
    address: eventManager,
    abi: EVENT_MANAGER_ABI,
    functionName: "rsvp",
    args: [eventNode, attendeeLabel],
  });
  console.log(`  tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  mined in block ${receipt.blockNumber} (${receipt.status})`);

  // Confirm the ticket subname now resolves with status=going.
  const ticketName = `${attendeeLabel}.${eventName}`;
  const ticketNode = namehash(ticketName);
  const status = await publicClient.readContract({
    address: PUBLIC_RESOLVER,
    abi: RESOLVER_ABI,
    functionName: "text",
    args: [ticketNode, KEYS.status],
  });

  console.log(`\nTicket subname: ${ticketName}`);
  console.log(`  ${KEYS.status} = "${status}"`);
  console.log(status === "going" ? "✅ End-to-end RSVP verified via ENS." : "⚠️  status not set as expected");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
