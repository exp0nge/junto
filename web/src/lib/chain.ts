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
  "0xd1CF5206ea14DA67cd2c58796F7B34A45802F1d6") as Address;
export const PUBLIC_RESOLVER = (import.meta.env.VITE_PUBLIC_RESOLVER ??
  "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5") as Address;
export const DEFAULT_EVENT =
  import.meta.env.VITE_EVENT_NAME ?? "ethny.juntoevents.eth";
export const FROM_BLOCK = BigInt(import.meta.env.VITE_FROM_BLOCK ?? "11055180");

export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(RPC_URL),
});

export async function getWallet() {
  const eth = (window as any).ethereum;
  if (!eth) throw new Error("No injected wallet found (install MetaMask).");
  const wallet = createWalletClient({ chain: sepolia, transport: custom(eth) });
  const [account] = await wallet.requestAddresses();
  // Make sure we're on Sepolia.
  try {
    await wallet.switchChain({ id: sepolia.id });
  } catch {
    /* user may already be on Sepolia or reject; reads still work */
  }
  return { wallet, account };
}

export { namehash };

export const KEYS = {
  title: "xyz.junto.title",
  location: "xyz.junto.location",
  capacity: "xyz.junto.capacity",
  status: "xyz.junto.status",
} as const;

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
