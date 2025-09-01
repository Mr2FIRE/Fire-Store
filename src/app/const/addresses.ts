// src/app/const/addresses.ts
import { client } from "../client";
import { getContract } from "thirdweb";
import { defineChain } from "thirdweb/chains";

// =========================
// CHAINS
// =========================
// Only Polygon now used
export const POLYGON = defineChain(137); // Polygon Mainnet

// =========================
// =========================
// POLYGON TOKEN CONTRACTS (FIRE + USDT)
// =========================
export const FIRE_CONTRACT_ADDRESS = "0xAAbdBA3B8Da1B73496Fa97ddD5D17AC52eA3c9Ba"; // FIRE token on Polygon
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

export let FIRE_TO_USDT_RATE = 1 / 1.5; // 1.5 FIRE = 1 USDT

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
  "0x012033F19f62D73C19b1F34f4fFDA1B8E4A8Da53";
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
