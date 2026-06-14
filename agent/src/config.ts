import { createPublicClient, createWalletClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const RPC_URL = process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";

// ENS Sepolia PublicResolver (override via env if needed).
export const PUBLIC_RESOLVER = (process.env.PUBLIC_RESOLVER ??
  "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5") as Address;

export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(RPC_URL),
});

export function getWalletClient() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("PRIVATE_KEY env var is required to send transactions");
  const account = privateKeyToAccount(pk.startsWith("0x") ? (pk as `0x${string}`) : (`0x${pk}` as `0x${string}`));
  return createWalletClient({ account, chain: sepolia, transport: http(RPC_URL) });
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const EVENT_MANAGER_ABI = [
  {
    type: "function",
    name: "rsvp",
    stateMutability: "nonpayable",
    inputs: [
      { name: "eventNode", type: "bytes32" },
      { name: "attendeeLabel", type: "string" },
    ],
    outputs: [{ name: "ticketNode", type: "bytes32" }],
  },
  {
    type: "function",
    name: "events",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [
      { name: "host", type: "address" },
      { name: "capacity", type: "uint256" },
      { name: "rsvpCount", type: "uint256" },
      { name: "exists", type: "bool" },
    ],
  },
] as const;

export const RESOLVER_ABI = [
  {
    type: "function",
    name: "text",
    stateMutability: "view",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
    ],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

// Text-record keys this app reads/writes (the ENS "schema").
export const KEYS = {
  title: "xyz.junto.title",
  location: "xyz.junto.location",
  capacity: "xyz.junto.capacity",
  status: "xyz.junto.status",
} as const;
