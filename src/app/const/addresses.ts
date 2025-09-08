import { client } from "../client";
import { getContract, readContract } from "thirdweb";
import { defineChain } from "thirdweb/chains";

// =========================
// CHAIN
// =========================
export const POLYGON = defineChain(137); // Polygon Mainnet

// =========================
// POLYGON TOKEN CONTRACTS (FIRE + USDT)
// =========================
export const FIRE_CONTRACT_ADDRESS = "0xEB1818b86d91040f9a300b93a626500Eb54Af828"; // FIRE token on Polygon (updated)
export const FIRE_CONTRACT = getContract({
  client,
  chain: POLYGON,
  address: FIRE_CONTRACT_ADDRESS,
});

export const USDT_CONTRACT_ADDRESS = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F"; // Polygon USDT
export const USDT_CONTRACT = getContract({
  client,
  chain: POLYGON,
  address: USDT_CONTRACT_ADDRESS,
});

export let FIRE_TO_USDT_RATE = 1 / 1.5; // fallback only

// =========================
// POLYGON CONTRACTS (NFTs)
// =========================
export const CARD_CONTRACT_ADDRESS =
  "0xD9bD01f10F9ae02a2938f437E84910bdCa6e9633";
export const CARD_CONTRACT = getContract({
  client,
  chain: POLYGON,
  address: CARD_CONTRACT_ADDRESS,
});

// Alias for existing components expecting NFT_COLLECTION naming
export const NFT_COLLECTION_ADDRESS = CARD_CONTRACT_ADDRESS;
export const NFT_COLLECTION = CARD_CONTRACT;

export const PACK_CONTRACT_ADDRESS =
  "0x9031f926E9f17c06673deFdaAdF39E69a6068B14";
export const PACK_CONTRACT = getContract({
  client,
  chain: POLYGON,
  address: PACK_CONTRACT_ADDRESS,
});

export const MARKETPLACE_ADDRESS =
  "0xD69c857C3D1aca2225a1367426683E923002C348";
export const MARKETPLACE = getContract({
  client,
  chain: POLYGON,
  address: MARKETPLACE_ADDRESS,
});

// =========================
// SCAN LINKS
// =========================
export const POLYGON_SCAN_URL = "https://polygonscan.com";

// =========================
// FIRE Dividend (Reflection) Distributor
// =========================
// Used to query pending USDT rewards for FIRE holders
export const FIRE_DIVIDEND_DISTRIBUTOR_ADDRESS = "0x832513fc4e418140B39D55d2614baDE823E1A589"; // updated distributor

// =========================
// Conversion Contract & Additional Tokens (placeholders for now)
// =========================
export const ZAIN_TOKEN_ADDRESS = "NA";
export const MASTER_TOKEN_ADDRESS = "NA";
export const FIB_TOKEN_ADDRESS = "NA";
export const ASIA_TOKEN_ADDRESS = "NA";

export const CONVERSION_CONTRACT_ADDRESS = "0x23E9b5fB75C35635ba0c522bC9292f0C9c529a6C"; // set after deployment
export const CONVERSION_CONTRACT = getContract({ client, chain: POLYGON, address: CONVERSION_CONTRACT_ADDRESS, abi: [
  { type: "function", name: "fireToUsdtRate", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
] as const });

export async function getFIRE_TO_USDT_RATE(): Promise<number> {
  try {
    const [raw, dec] = await Promise.all([
      readContract({ contract: CONVERSION_CONTRACT, method: "fireToUsdtRate", params: [] }) as unknown as Promise<bigint>,
      readContract({ contract: CONVERSION_CONTRACT, method: "decimals", params: [] }) as unknown as Promise<number>,
    ]);
    const denom = 10n ** BigInt(dec ?? 18);
    if (denom === 0n) return FIRE_TO_USDT_RATE;
    const rate = Number(raw) / Number(denom);
    FIRE_TO_USDT_RATE = rate; // update cache
    return rate;
  } catch (e) {
    return FIRE_TO_USDT_RATE;
  }
}

// =========================
// Attempts-based Pack Contract
// =========================
export const PACK_ATTEMPTS_ADDRESS = "0x9440822d9b081088B95BD1511F3aA9BEC7e253d5";
export const PACK_ATTEMPTS = getContract({
  client,
  chain: POLYGON,
  address: PACK_ATTEMPTS_ADDRESS,
});
export const PACK_IDS: number[] = [1];
