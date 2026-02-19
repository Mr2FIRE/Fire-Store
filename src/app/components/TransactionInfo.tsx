"use client";

import { useEffect, useMemo, useState } from "react";
import { BSC_TESTNET } from "../const/addresses";

type Props = {
  txHash: string;
  chainId?: number; 
  tokenAddress?: string;
  tokenDecimals?: number;
  rpcUrl?: string; 
  tokenLabel?: string; 
  success?: boolean; 
  expectedFrom?: string;
  expectedTo?: string;
};

type Tx = {
  from: string;
  to: string | null;
  value: string;
  blockNumber?: string | null;
  input?: string;
};

type Receipt = {
  effectiveGasPrice?: string; 
  gasUsed?: string; 
  logs: Array<{ address: string; topics: string[]; data: string }>;
  blockNumber?: string;
};

type Block = { timestamp: string };

const ERC20_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function hexToBigInt(hex?: string | null): bigint {
  if (!hex) return 0n;
  return BigInt(hex);
}

function formatAmount(amount: bigint, decimals: number): string {
  const neg = amount < 0n;
  const abs = neg ? -amount : amount;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole.toString()}${fracStr ? "." + fracStr : ""}`;
}

function formatTimestamp(tsSec: number): string {
  const d = new Date(tsSec * 1000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  let hh = d.getHours();
  const am = hh < 12;
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ap = am ? "AM" : "PM";
  return `${yyyy}-${mm}-${dd} ${hour12}:${mi} ${ap}`;
}

async function rpcCall<T>(rpcUrl: string, method: string, params: any[]): Promise<T> {
  const body = { jsonrpc: "2.0", id: 1, method, params };
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || "RPC error");
  return json.result as T;
}

export default function TransactionInfo({ txHash, chainId = BSC_TESTNET.id, tokenAddress, tokenDecimals = 18, rpcUrl, tokenLabel, success = true, expectedFrom, expectedTo }: Props) {
  const [tx, setTx] = useState<Tx | null>(null);
  const [rc, setRc] = useState<Receipt | null>(null);
  const [blk, setBlk] = useState<Block | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const url = useMemo(() => {
    if (rpcUrl) return rpcUrl;
    // BSC Testnet RPC
    if (chainId === BSC_TESTNET.id) return "https://rpc.ankr.com/bsc_testnet";
    return "https://rpc.ankr.com/bsc_testnet";
  }, [rpcUrl, chainId]);

  const tokenKind = (tokenLabel || (tokenAddress ? "TOKEN" : "POL")).toUpperCase();
  const TokenIcon = ({ size = 18 }: { size?: number }) => {
    if (tokenKind === "FIRE") {
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
          <defs>
            <linearGradient id="fi" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffb347" />
              <stop offset="100%" stopColor="#ff4d00" />
            </linearGradient>
          </defs>
          <path d="M34 4c2 6 0 9 4 13s6 5 8 10c5 11-1 25-14 25S15 49 16 37c1-12 11-15 9-25 3 2 5 6 5 10 1-5 2-9 4-13Z" fill="url(#fi)" />
        </svg>
      );
    }
    if (tokenKind === "USDT") {
      return (
        <svg width={size} height={size} viewBox="0 0 256 256" aria-hidden>
          <circle cx="128" cy="128" r="128" fill="#50AF95" />
          <g fill="#fff">
            {/* Top bar of the T */}
            <rect x="56" y="60" width="144" height="28" rx="6" />
            {/* Vertical stem of the T */}
            <rect x="116" y="88" width="24" height="74" rx="6" />
          </g>
          {/* Central ellipse ring */}
          <ellipse cx="128" cy="134" rx="86" ry="22" fill="none" stroke="#fff" strokeWidth="18" />
        </svg>
      );
    }
    // POL or unknown
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="10" fill="#7c3aed" />
        <circle cx="12" cy="12" r="5" fill="#fff" opacity="0.9" />
      </svg>
    );
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr(null);
    (async () => {
      try {
        const txData = await rpcCall<Tx>(url, "eth_getTransactionByHash", [txHash]);
        if (!mounted) return;
        setTx(txData);
        const receipt = await rpcCall<Receipt>(url, "eth_getTransactionReceipt", [txHash]);
        if (!mounted) return;
        setRc(receipt);
        const blockNum = txData.blockNumber || receipt.blockNumber;
        if (blockNum) {
          const block = await rpcCall<Block>(url, "eth_getBlockByNumber", [blockNum, false]);
          if (!mounted) return;
          setBlk(block);
        }
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message || "Failed to load transaction");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [txHash, url]);

  let from = tx?.from || "-";
  let to = tx?.to || "-";

  // Detect amount
  let amountStr = "-";
  try {
    if (tokenAddress && rc) {
      const addrLc = tokenAddress.toLowerCase();
      const logs = rc.logs.filter((l) => l.address.toLowerCase() === addrLc && l.topics?.[0]?.toLowerCase() === ERC20_TRANSFER_TOPIC);
      if (logs.length > 0) {
        let picked = logs[0];
        let bestAmt = -1n;
        for (const lg of logs) {
          let lgAmt = 0n;
          try {
            const d = lg.data || "0x";
            lgAmt = hexToBigInt(d);
            if (lgAmt === 0n && (lg.topics?.[3] || "").length > 2) {
              lgAmt = hexToBigInt(lg.topics[3] || "0x");
            }
          } catch {}
          const fromTopicAddr = ((lg.topics?.[1] || "").startsWith("0x") ? ("0x" + lg.topics[1].slice(-40)) : "").toLowerCase();
          const toTopicAddr = ((lg.topics?.[2] || "").startsWith("0x") ? ("0x" + lg.topics[2].slice(-40)) : "").toLowerCase();
          const expFromLc = (expectedFrom || tx?.from || "").toLowerCase();
          const expToLc = (expectedTo || "").toLowerCase();
          const matchBoth = expFromLc && expToLc && (fromTopicAddr === expFromLc) && (toTopicAddr === expToLc);
          const matchEither = (expFromLc && fromTopicAddr === expFromLc) || (expToLc && toTopicAddr === expToLc);
          const isBetter = matchBoth
            || (!matchBoth && matchEither && bestAmt < 0n)
            || (!matchBoth && !matchEither && (lgAmt > bestAmt));
          if (isBetter) {
            bestAmt = lgAmt;
            picked = lg;
          }
        }
        const tFrom = (picked.topics?.[1] || "").toLowerCase();
        const tTo = (picked.topics?.[2] || "").toLowerCase();
        const fromAddr = tFrom && tFrom.startsWith("0x") ? ("0x" + tFrom.slice(-40)) : from;
        const toAddr = tTo && tTo.startsWith("0x") ? ("0x" + tTo.slice(-40)) : to;
        from = fromAddr;
        to = toAddr;

        const finalAmt = bestAmt >= 0n ? bestAmt : 0n;
        amountStr = formatAmount(finalAmt, tokenDecimals);
      } else if (tx && tx.to && tx.to.toLowerCase() === addrLc && tx.input && tx.input.length >= 10 + 64 * 2) {
        const input = tx.input.toLowerCase();
        const sig = input.slice(2, 10);
        const p1 = input.slice(10, 10 + 64);
        const p2 = input.slice(10 + 64, 10 + 64 * 2);
        const p3 = input.slice(10 + 64 * 2, 10 + 64 * 3);
        if (sig === "a9059cbb") {
          const toAddr = "0x" + p1.slice(-40);
          const amt = BigInt("0x" + p2);
          to = toAddr;
          amountStr = formatAmount(amt, tokenDecimals);
        } else if (sig === "23b872dd" && input.length >= 10 + 64 * 3) {
          const fromAddr = "0x" + p1.slice(-40);
          const toAddr = "0x" + p2.slice(-40);
          const amt = BigInt("0x" + p3);
          from = fromAddr;
          to = toAddr;
          amountStr = formatAmount(amt, tokenDecimals);
        }
      }
    } else if (tx) {
      const val = hexToBigInt(tx.value);
      amountStr = formatAmount(val, 18);
    }
  } catch {}

  let gasStr = "-";
  try {
    const gasUsed = hexToBigInt(rc?.gasUsed);
    const eff = hexToBigInt(rc?.effectiveGasPrice);
    const feeWei = gasUsed * eff;
    gasStr = formatAmount(feeWei, 18);
  } catch {}

  let timeStr = "-";
  try {
    const ts = parseInt(blk?.timestamp || "0x0", 16);
    if (ts) timeStr = formatTimestamp(ts);
  } catch {}

  const unitLabel = (() => {
    const lbl = (tokenLabel || (tokenAddress ? "FIRE" : "POL")).toUpperCase();
    if (lbl === "FIRE") return "فاير";
    if (lbl === "USDT") return "يوس";
  if (lbl === "POL" || lbl === "MATIC") return "BNB";
    return lbl;
  })();

  return (
    <div className="w-full max-w-xl bg-gradient-to-br from-gray-900/80 to-black/60 border border-white/10 rounded-xl p-4 sm:p-5 pt-20 sm:pt-16 text-white text-sm shadow-xl relative overflow-hidden min-h-[380px] sm:min-h-[280px]">
      {/* glow effect */}
      <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-white/5" />
      {success && (
        <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 sm:top-1 text-green-400/90 z-10">
          <svg className="w-15 h-16 sm:w-11 sm:h-12 drop-shadow-[0_0_16px_rgba(34,197,94,0.55)] animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
      )}
      {
      loading ? (
        <div className="animate-pulse text-white/70">Loading transaction…</div>
      ) : err ? (
        <div className="text-red-400">{err}</div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-base">
            <span className="text-white/70">المرسل:</span>
            <span className="font-mono text-white/90 break-all">{from}</span>
          </div>
          <div className="flex items-center gap-2 text-base">
            <span className="text-white/70">المستلم:</span>
            <span className="font-mono text-white/90 break-all">{to}</span>
          </div>
          <div className="flex items-center gap-2 text-base">
            <span className="text-white/70">الكمية:</span>
            <span className="text-white font-semibold">{amountStr}</span>
            <span className="text-white/80">{unitLabel}</span>
            <span className="inline-flex items-center justify-center ml-1"><TokenIcon size={18} /></span>
          </div>
          <div className="flex items-center gap-2 text-base">
            <span className="text-white/70">عمولة الشبكة:</span>
            <span className="text-white font-semibold">{gasStr}</span>
            <span className="text-white/80">BNB</span>
          </div>
          <div className="flex items-center gap-2 text-base">
            <span className="text-white/70">الوقت والتاريخ:</span>
            <span className="text-white/90">{timeStr}</span>
          </div>
          <div className="text-white/50 break-all text-xs">
            <span className="text-white/60">معرف المعاملة:</span> {txHash}
          </div>
        </div>
      )
    }
    </div>
  );
}
