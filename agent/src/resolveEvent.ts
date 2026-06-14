import { namehash } from "viem/ens";
import { publicClient, PUBLIC_RESOLVER, RESOLVER_ABI, KEYS } from "./config.js";

/// Read an event's metadata straight from its ENS resolver records.
/// Usage: tsx src/resolveEvent.ts <event-ens-name>
export async function readEvent(name: string) {
  const node = namehash(name);
  const read = (key: string) =>
    publicClient.readContract({
      address: PUBLIC_RESOLVER,
      abi: RESOLVER_ABI,
      functionName: "text",
      args: [node, key],
    });

  const [title, location, capacity] = await Promise.all([
    read(KEYS.title),
    read(KEYS.location),
    read(KEYS.capacity),
  ]);

  return { name, node, title, location, capacity };
}

async function main() {
  const name = process.argv[2];
  if (!name) throw new Error("Usage: tsx src/resolveEvent.ts <event-ens-name>");

  const e = await readEvent(name);
  console.log(`\nEvent: ${e.name}`);
  console.log(`  node:     ${e.node}`);
  console.log(`  title:    ${e.title || "(unset)"}`);
  console.log(`  location: ${e.location || "(unset)"}`);
  console.log(`  capacity: ${e.capacity || "(unset)"}`);
}

// Run only when invoked directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
