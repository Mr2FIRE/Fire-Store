import { client } from "../client";
import { getContract, readContract } from "thirdweb";
import { defineChain } from "thirdweb/chains";

// =========================
// CHAIN
// =========================
export const BSC_TESTNET = defineChain(97); // BSC Testnet (Chain ID 97)

// =========================
// BSC TESTNET TOKEN CONTRACTS (FIRE + USDT)
// =========================
export const FIRE_CONTRACT_ADDRESS = "0x9E0EB99C7350Bd0d8AeF79966fc04747eF756e83"; // FIRE token on BSC Testnet
export const FIRE_CONTRACT = getContract({
  client,
  chain: BSC_TESTNET,
  address: FIRE_CONTRACT_ADDRESS,
});

export const FIRE_REWARDS_CONTRACT_ADDRESS = "0xf1F90582BdAEa70063f3Bc1D277A9089586CEf62"; // FireRewards contract on BSC Testnet
export const FIRE_REWARDS_CONTRACT = getContract({
  client,
  chain: BSC_TESTNET,
  address: FIRE_REWARDS_CONTRACT_ADDRESS,
});

export const USDT_CONTRACT_ADDRESS = "0x6e9Af8a9482fe969f6Bf281dDd9a8117b43840F8"; // USDT on BSC Testnet (provided)
export const USDT_CONTRACT = getContract({
  client,
  chain: BSC_TESTNET,
  address: USDT_CONTRACT_ADDRESS,
});

// FIRE↔USDT rate will be read from the conversion contract (fallback defined below)
export let FIRE_TO_USDT_RATE = 1 / 1.44; // fallback only

// Helper to read the rate from the unified FIRE contract. Returns a JS number or null on failure.
export async function getFIRE_TO_USDT_RATE(): Promise<number | null> {
  try {
    // Create an explicit ABI with the state variables so readContract can resolve them
    const rateAbi = [
      { type: "function", name: "fireToUsdtRate", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
      { type: "function", name: "rateDecimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
    ];
    const fireC = getContract({ client, chain: BSC_TESTNET, address: FIRE_CONTRACT_ADDRESS, abi: rateAbi as any });
    const raw: bigint = await readContract({ contract: fireC, method: "fireToUsdtRate", params: [] }) as any;
    const dec: number = await readContract({ contract: fireC, method: "rateDecimals", params: [] }) as any;
    if (!raw || raw === 0n) return null;
    // convert bigint to number (may lose precision for very large values)
    const val = Number(raw) / Math.pow(10, dec || 0);
    return val;
  } catch (e) {
    return null;
  }
}

// =========================
// BSC TESTNET CONTRACTS (NFTs)
// =========================
export const CARD_CONTRACT_ADDRESS =
  "0xD9bD01f10F9ae02a2938f437E84910bdCa6e9633";
export const CARD_CONTRACT = getContract({
  client,
  chain: BSC_TESTNET,
  address: CARD_CONTRACT_ADDRESS,
});

// Alias for existing components expecting NFT_COLLECTION naming
export const NFT_COLLECTION_ADDRESS = CARD_CONTRACT_ADDRESS;
export const NFT_COLLECTION = CARD_CONTRACT;

export const PACK_CONTRACT_ADDRESS =
  "0x9031f926E9f17c06673deFdaAdF39E69a6068B14";
export const PACK_CONTRACT = getContract({
  client,
  chain: BSC_TESTNET,
  address: PACK_CONTRACT_ADDRESS,
});

// PackAttempts contract (not deployed yet) - placeholder address
export const PACK_ATTEMPTS_ADDRESS = "0x0000000000000000000000000000000000000000";
// Minimal ABI for PackAttempts (attempts + open)
export const PACK_ATTEMPTS_ABI = [
  { type: "function", name: "attempts", stateMutability: "view", inputs: [ { name: "packId", type: "uint256" }, { name: "user", type: "address" } ], outputs: [ { name: "", type: "uint256" } ] },
  { type: "function", name: "open", stateMutability: "nonpayable", inputs: [ { name: "packId", type: "uint256" } ], outputs: [] },
] as const;
export const PACK_ATTEMPTS = getContract({ client, chain: BSC_TESTNET, address: PACK_ATTEMPTS_ADDRESS, abi: PACK_ATTEMPTS_ABI as any });

// Default pack ids used by the UI (can be updated when packs are created)
export const PACK_IDS = [1, 2, 3];

export const MARKETPLACE_ADDRESS =
  "0xD69c857C3D1aca2225a1367426683E923002C348";
export const MARKETPLACE = getContract({
  client,
  chain: BSC_TESTNET,
  address: MARKETPLACE_ADDRESS,
});

// =========================
// SCAN LINKS
// =========================
export const BSC_SCAN_URL = "https://testnet.bscscan.com";

// =========================
// FIRE Rewards Distributor
// =========================
// Address of FireRewards contract (owner deploys & funds with USDT)
export const FIRE_DIVIDEND_DISTRIBUTOR_ADDRESS = FIRE_REWARDS_CONTRACT_ADDRESS;
export const FIRE_DIVIDEND_DISTRIBUTOR = FIRE_REWARDS_CONTRACT;

// =========================
// Additional Tokens (placeholders for now)
// =========================
export const ZAIN_TOKEN_ADDRESS = "NA";
export const MASTER_TOKEN_ADDRESS = "NA";
export const FIB_TOKEN_ADDRESS = "NA";
export const ASIA_TOKEN_ADDRESS = "NA";

// Alias for backward compat
export const CONVERSION_CONTRACT_ADDRESS = FIRE_CONTRACT_ADDRESS;

// =========================
// P2P Escrow Contract
// =========================
export const P2P_ESCROW_CONTRACT_ADDRESS = "0x37024A91211A67d00bbA811A1ee8cC9B6b766f6C";
export const P2P_ABI = [
  { type: "function", name: "createAd", stateMutability: "nonpayable", inputs: [{ name: "token", type: "address" }, { name: "amount", type: "uint256" }, { name: "paymentToken", type: "address" }, { name: "minOrderAmount", type: "uint256" }, { name: "unitPrice", type: "uint256" }, { name: "paymentMethod", type: "string" }, { name: "isBuy", type: "bool" }], outputs: [] },
  { type: "function", name: "placeOrder", stateMutability: "nonpayable", inputs: [{ name: "adId", type: "uint256" }, { name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "markPaid", stateMutability: "nonpayable", inputs: [{ name: "orderId", type: "uint256" }], outputs: [] },
  { type: "function", name: "release", stateMutability: "nonpayable", inputs: [{ name: "orderId", type: "uint256" }], outputs: [] },
  { type: "function", name: "dispute", stateMutability: "nonpayable", inputs: [{ name: "orderId", type: "uint256" }], outputs: [] },
  { type: "function", name: "resolveDispute", stateMutability: "nonpayable", inputs: [{ name: "orderId", type: "uint256" }, { name: "toBuyer", type: "bool" }], outputs: [] },
  // helper view to list active ads
  { type: "function", name: "getAllAds", stateMutability: "view", inputs: [], outputs: [
    { name: "ids", type: "uint256[]" },
    { name: "sellers", type: "address[]" },
    { name: "tokens", type: "address[]" },
    { name: "amounts", type: "uint256[]" },
    { name: "paymentTokens", type: "address[]" },
    { name: "minOrderAmounts", type: "uint256[]" },
    { name: "unitPrices", type: "uint256[]" },
    { name: "paymentMethods", type: "string[]" },
    { name: "actives", type: "bool[]" },
    { name: "lockedAmounts", type: "uint256[]" },
    { name: "lockedPaymentAmounts", type: "uint256[]" },
    { name: "isBuys", type: "bool[]" }
  ]},
  { type: "function", name: "usdtAddress", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "asiaAddress", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "zainAddress", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "masterAddress", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "fireAddress", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "setUsdtAddress", stateMutability: "nonpayable", inputs: [{ name: "_addr", type: "address" }], outputs: [] },
  { type: "function", name: "setAsiaAddress", stateMutability: "nonpayable", inputs: [{ name: "_addr", type: "address" }], outputs: [] },
  { type: "function", name: "setZainAddress", stateMutability: "nonpayable", inputs: [{ name: "_addr", type: "address" }], outputs: [] },
  { type: "function", name: "setMasterAddress", stateMutability: "nonpayable", inputs: [{ name: "_addr", type: "address" }], outputs: [] },
  { type: "function", name: "setFireAddress", stateMutability: "nonpayable", inputs: [{ name: "_addr", type: "address" }], outputs: [] },
  { type: "function", name: "pauseContract", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "unpauseContract", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "rescueToken", stateMutability: "nonpayable", inputs: [{ name: "token", type: "address" }, { name: "amount", type: "uint256" }, { name: "to", type: "address" }], outputs: [] },
  { type: "function", name: "rescueBNB", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "totalLockedForToken", stateMutability: "view", inputs: [{ name: "token", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  // events
  { "anonymous": false, "inputs": [ { "indexed": false, "internalType": "uint256", "name": "adId", "type": "uint256" }, { "indexed": false, "internalType": "address", "name": "seller", "type": "address" }, { "indexed": false, "internalType": "address", "name": "token", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" } ], "name": "AdCreated", "type": "event" },
  { "anonymous": false, "inputs": [ { "indexed": false, "internalType": "uint256", "name": "orderId", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "adId", "type": "uint256" }, { "indexed": false, "internalType": "address", "name": "buyer", "type": "address" } ], "name": "OrderPlaced", "type": "event" },
  { "anonymous": false, "inputs": [ { "indexed": false, "internalType": "uint256", "name": "orderId", "type": "uint256" } ], "name": "OrderPaid", "type": "event" },
  { "anonymous": false, "inputs": [ { "indexed": false, "internalType": "uint256", "name": "orderId", "type": "uint256" } ], "name": "OrderReleased", "type": "event" },
  { "anonymous": false, "inputs": [ { "indexed": false, "internalType": "uint256", "name": "orderId", "type": "uint256" } ], "name": "OrderDisputed", "type": "event" },
  { "anonymous": false, "inputs": [ { "indexed": false, "internalType": "address", "name": "by", "type": "address" } ], "name": "ContractPaused", "type": "event" },
  { "anonymous": false, "inputs": [ { "indexed": false, "internalType": "address", "name": "by", "type": "address" } ], "name": "ContractUnpaused", "type": "event" },
  { "anonymous": false, "inputs": [ { "indexed": false, "internalType": "uint256", "name": "adId", "type": "uint256" }, { "indexed": false, "internalType": "address", "name": "seller", "type": "address" }, { "indexed": false, "internalType": "address", "name": "token", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" } ], "name": "AdCancelledOnPause", "type": "event" },
];
export const P2P_ESCROW_CONTRACT = getContract({
  client,
  chain: BSC_TESTNET,
  address: P2P_ESCROW_CONTRACT_ADDRESS,
  abi: P2P_ABI as any,
});
