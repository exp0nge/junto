import { namehash } from "viem/ens";
import { createWalletClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { publicClient, requireEnv, EVENT_MANAGER_ABI } from "./config.js";

// Junto moderator revokes an event (owner-only on-chain).
// Run: OWNER_PRIVATE_KEY=0x.. pnpm tsx src/revoke.ts <event-ens-name>
async function main() {
  const eventName = process.argv[2];
  if (!eventName) throw new Error("Usage: tsx src/revoke.ts <event-ens-name>");
  const eventManager = requireEnv("EVENT_MANAGER") as Address;
  const pk = (process.env.OWNER_PRIVATE_KEY ?? process.env.PRIVATE_KEY ?? "").trim();
  if (!pk) throw new Error("Set OWNER_PRIVATE_KEY (the Junto moderator / deployer key)");

  const account = privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`);
  const wallet = createWalletClient({
    account,
    chain: sepolia,
    transport: http(process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com"),
  });

  console.log(`Revoking ${eventName} as ${account.address} …`);
  const hash = await wallet.writeContract({
    address: eventManager,
    abi: EVENT_MANAGER_ABI,
    functionName: "revokeEvent",
    args: [namehash(eventName)],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`✓ revoked — tx ${hash}`);
  console.log("The event's ENS record now reads xyz.junto.status = \"revoked\" and RSVPs are blocked.");
}

main().catch((e) => {
  console.error(e?.shortMessage ?? e?.message ?? e);
  process.exit(1);
});
