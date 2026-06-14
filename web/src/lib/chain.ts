import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  namehash,
  type Address,
} from "viem";
import { sepolia } from "viem/chains";

// Defaults point at the live Sepolia deployment so the app works out of the box.
export const RPC_URL =
  import.meta.env.VITE_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
export const EVENT_MANAGER = (import.meta.env.VITE_EVENT_MANAGER ??
  "0x7BaA0fA7193F62aB746735D960c44cE418d65537") as Address;
export const PUBLIC_RESOLVER = (import.meta.env.VITE_PUBLIC_RESOLVER ??
  "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5") as Address;
export const PARENT_NAME = import.meta.env.VITE_PARENT_NAME ?? "juntoevents.eth";
export const FROM_BLOCK = BigInt(import.meta.env.VITE_FROM_BLOCK ?? "11055180");

export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(RPC_URL),
});

export function hasWallet() {
  return typeof (window as any).ethereum !== "undefined";
}

export async function getWallet() {
  const eth = (window as any).ethereum;
  if (!eth) throw new Error("No injected wallet found. Install MetaMask to RSVP or host.");
  const wallet = createWalletClient({ chain: sepolia, transport: custom(eth) });
  const [account] = await wallet.requestAddresses();
  try {
    await wallet.switchChain({ id: sepolia.id });
  } catch {
    /* already on Sepolia or rejected; reads still work */
  }
  return { wallet, account };
}

export { namehash };

// Text-record keys this app reads/writes (the ENS "schema").
export const KEYS = {
  title: "xyz.junto.title",
  location: "xyz.junto.location",
  capacity: "xyz.junto.capacity",
  date: "xyz.junto.date",
  category: "xyz.junto.category",
  status: "xyz.junto.status",
  url: "url",
} as const;

export const EVENT_MANAGER_ABI = [
  {
    type: "function",
    name: "createEvent",
    stateMutability: "nonpayable",
    inputs: [
      { name: "label", type: "string" },
      { name: "capacity", type: "uint256" },
      { name: "keys", type: "string[]" },
      { name: "values", type: "string[]" },
    ],
    outputs: [{ name: "eventNode", type: "bytes32" }],
  },
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
    name: "revokeEvent",
    stateMutability: "nonpayable",
    inputs: [{ name: "eventNode", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
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
  {
    type: "event",
    name: "EventCreated",
    inputs: [
      { name: "eventNode", type: "bytes32", indexed: true },
      { name: "host", type: "address", indexed: true },
      { name: "label", type: "string", indexed: false },
      { name: "capacity", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "RSVP",
    inputs: [
      { name: "eventNode", type: "bytes32", indexed: true },
      { name: "ticketNode", type: "bytes32", indexed: true },
      { name: "attendee", type: "address", indexed: true },
      { name: "label", type: "string", indexed: false },
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
