import { createWalletClient, http, type Address } from "viem";
import { namehash } from "viem/ens";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { publicClient, requireEnv, EVENT_MANAGER_ABI, KEYS } from "./config.js";

const PARENT = process.env.PARENT_NAME ?? "juntoevents.eth";

// Seeds a batch of NYC events on-chain. Host key defaults to HOST_PRIVATE_KEY (the deployer),
// falling back to PRIVATE_KEY. Run: HOST_PRIVATE_KEY=0x.. pnpm tsx src/seedEvents.ts
type Seed = {
  label: string;
  title: string;
  location: string;
  date: string;
  category: string;
  capacity: number;
  url?: string;
};

const EVENTS: Seed[] = [
  { label: "ethny", title: "ETHGlobal New York", location: "Pier 36, Manhattan", date: "2026-06-26", category: "Hackathon", capacity: 100 },
  { label: "ethconf-2027", title: "EthConf 2027", location: "New York City", date: "2027-06", category: "Conference", capacity: 300, url: "https://ethconf.com" },
  { label: "defi-summit-nyc", title: "DeFi Summit NYC", location: "Brooklyn Expo Center", date: "2026-07-09", category: "Conference", capacity: 250 },
  { label: "zk-night", title: "ZK Night NYC", location: "SoHo", date: "2026-06-30", category: "Talks", capacity: 80 },
  { label: "solidity-workshop", title: "Solidity Workshop", location: "Flatiron", date: "2026-07-02", category: "Workshop", capacity: 40 },
  { label: "founders-brunch", title: "Web3 Founders Brunch", location: "Williamsburg", date: "2026-07-05", category: "Social", capacity: 60 },
  { label: "nft-gallery-night", title: "NFT Gallery Night", location: "Chelsea", date: "2026-07-11", category: "Art", capacity: 120 },
  { label: "eth-research-day", title: "Ethereum Research Day", location: "Columbia University", date: "2026-07-15", category: "Research", capacity: 150 },
  { label: "women-in-web3", title: "Women in Web3 Mixer", location: "Midtown", date: "2026-07-18", category: "Social", capacity: 90 },
  { label: "base-builders-nyc", title: "Base Builders Meetup", location: "DUMBO, Brooklyn", date: "2026-07-22", category: "Meetup", capacity: 70 },
  { label: "stablecoin-forum", title: "Stablecoin Payments Forum", location: "Financial District", date: "2026-07-24", category: "Conference", capacity: 110 },
  { label: "agent-hacknight", title: "Autonomous Agents Hacknight", location: "Lower East Side", date: "2026-07-29", category: "Hackathon", capacity: 50 },
];

async function main() {
  const pk = (process.env.HOST_PRIVATE_KEY ?? process.env.PRIVATE_KEY ?? "").trim();
  if (!pk) throw new Error("Set HOST_PRIVATE_KEY (the event host / deployer key)");
  const eventManager = requireEnv("EVENT_MANAGER") as Address;
  const account = privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`);
  const wallet = createWalletClient({
    account,
    chain: sepolia,
    transport: http(process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com"),
  });

  console.log(`Seeding ${EVENTS.length} events as host ${account.address}\n`);
  for (const e of EVENTS) {
    const node = namehash(`${e.label}.${PARENT}`);
    const existing = (await publicClient.readContract({
      address: eventManager,
      abi: EVENT_MANAGER_ABI,
      functionName: "events",
      args: [node],
    })) as readonly [Address, bigint, bigint, boolean];
    if (existing[3]) {
      console.log(`  • ${e.label} already exists — skipping`);
      continue;
    }
    const keys = [KEYS.title, KEYS.location, KEYS.capacity, "xyz.junto.date", "xyz.junto.category"];
    const values = [e.title, e.location, String(e.capacity), e.date, e.category];
    if (e.url) {
      keys.push("url");
      values.push(e.url);
    }
    try {
      const hash = await wallet.writeContract({
        address: eventManager,
        abi: EVENT_MANAGER_ABI,
        functionName: "createEvent",
        args: [e.label, BigInt(e.capacity), keys, values],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`  ✓ ${e.label}.juntoevents.eth — ${e.title}`);
    } catch (err: any) {
      console.log(`  ✗ ${e.label}: ${err?.shortMessage ?? err?.message ?? err}`);
    }
  }
  console.log("\ndone");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
