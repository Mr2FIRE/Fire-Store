"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { getContract, readContract } from "thirdweb";
import { CONVERSION_CONTRACT_ADDRESS, FIRE_CONTRACT_ADDRESS, USDT_CONTRACT_ADDRESS } from "./const/addresses";
import { client } from "./client";
import { ethers } from "ethers";
import {
  useActiveWallet,
  useActiveAccount,
  useWalletBalance,
  TransactionButton,
} from "thirdweb/react";
import ConversionBox from "./components/ConversionBox";
import TransactionInfo from "./components/TransactionInfo";
import { transfer } from "thirdweb/extensions/erc20";
import {
  FIRE_CONTRACT,
  USDT_CONTRACT,
  BSC_TESTNET,
  FIRE_TO_USDT_RATE,
  getFIRE_TO_USDT_RATE,
} from "@/app/const/addresses";
import QRCode from "react-qr-code";
import toast from "react-hot-toast";
import toastStyle from "./util/toastConfig";

type TokenKey = "USDT" | "FIRE";

export default function Home() {
  const wallet = useActiveWallet();
  const account = useActiveAccount();
  const address = account?.address;


  // ===== Balances (BSC Testnet tokens) =====
  const { data: usdtBal, refetch: refetchUsdt } = useWalletBalance({
    client: USDT_CONTRACT.client,
    chain: BSC_TESTNET,
    address,
    tokenAddress: USDT_CONTRACT.address,
  });

  const { data: fireBal, refetch: refetchFire } = useWalletBalance({
    client: FIRE_CONTRACT.client,
    chain: BSC_TESTNET,
    address,
    tokenAddress: FIRE_CONTRACT.address,
  });

  const fmt = (v?: string | number) =>
    (v ? Number(v) : 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });

  // Live FIRE→USDT rate (fallback to exported const)
  const [fireRate, setFireRate] = useState<number>(FIRE_TO_USDT_RATE);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await getFIRE_TO_USDT_RATE();
        if (mounted && typeof r === 'number' && isFinite(r)) setFireRate(r);
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  const safeNumber = (v?: string | number) => {
    const n = v === undefined || v === null ? 0 : Number(String(v).replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const totalApproxUSDT =
    safeNumber(usdtBal?.displayValue) +
    safeNumber(fireBal?.displayValue) * (typeof fireRate === 'number' && isFinite(fireRate) ? fireRate : FIRE_TO_USDT_RATE);

  // ===== Modals state =====
  const [sendOpen, setSendOpen] = useState<false | TokenKey>(false);
  const [receiveOpen, setReceiveOpen] = useState<false | TokenKey>(false);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [txInfoOpen, setTxInfoOpen] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [lastToken, setLastToken] = useState<TokenKey | null>(null);
  const [lastTo, setLastTo] = useState<string | null>(null);
  const [maxClickNonce, setMaxClickNonce] = useState(0);

  const refreshBalances = () => {
    refetchUsdt();
  refetchFire();
  };

  // estimate fees when user enters send details
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setEstimatingFees(false);
        setFeeDev(null); setFeeMarketing(null); setFeeHolders(null); setFeeNet(null); setNetworkFeeMatic(null);
        if (!sendOpen || sendOpen !== "FIRE") return;
        if (!amount || !account?.address) return;
        setEstimatingFees(true);
        // call unified contract helper getFeeBreakdownFor
        const ABI = [{ type: "function", name: "getFeeBreakdownFor", stateMutability: "view", inputs: [{ name: "sender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "devFee", type: "uint256" }, { name: "marketingFee", type: "uint256" }, { name: "holdersFee", type: "uint256" }, { name: "net", type: "uint256" }] }];
        const conv = getContract({ client, chain: BSC_TESTNET, address: CONVERSION_CONTRACT_ADDRESS, abi: ABI as any });
        const amtUnits = parseInput(amount, 2); // FIRE decimals = 2
        try {
          const res = await readContract({ contract: conv, method: "getFeeBreakdownFor", params: [account?.address, amtUnits] }) as any;
          if (!ignore && res) {
            setFeeDev(BigInt(res[0] || 0));
            setFeeMarketing(BigInt(res[1] || 0));
            setFeeHolders(BigInt(res[2] || 0));
            setFeeNet(BigInt(res[3] || 0));
          }
        } catch (e) {
          // ignore if not available
        }

        // estimate network fee (approx) using provider gas price * gas limit
        try {
          if ((window as any).ethereum) {
            const provider = new ethers.providers.Web3Provider((window as any).ethereum as any);
            const gasPrice = await provider.getGasPrice();
            const gasLimit = ethers.BigNumber.from(100000);
            const feeWei = gasPrice.mul(gasLimit);
            const feeMatic = ethers.utils.formatEther(feeWei);
            if (!ignore) setNetworkFeeMatic(feeMatic);
          }
        } catch (e) { /* ignore */ }
      } catch (e) {
        console.warn("fee estimate failed", e);
      } finally {
        if (!ignore) setEstimatingFees(false);
      }
    })();
    return () => { ignore = true; };
  }, [amount, sendOpen, account?.address]);

    // Fee estimate states (for send modal)
    const [feeDev, setFeeDev] = useState<bigint | null>(null);
    const [feeMarketing, setFeeMarketing] = useState<bigint | null>(null);
    const [feeHolders, setFeeHolders] = useState<bigint | null>(null);
    const [feeNet, setFeeNet] = useState<bigint | null>(null);
    const [networkFeeMatic, setNetworkFeeMatic] = useState<string | null>(null);
    const [estimatingFees, setEstimatingFees] = useState(false);

    function parseInput(v: string, dec: number) {
      if (!v) return 0n;
      const [intP, fracP = ""] = v.replace(/,/g, "").split(".");
      const frac = fracP.slice(0, dec).padEnd(dec, "0");
      return BigInt(intP || "0") * 10n ** BigInt(dec) + BigInt(frac || "0");
    }
    function formatRaw(raw: bigint, dec: number) {
      const whole = raw / 10n ** BigInt(dec);
      const frac = raw % 10n ** BigInt(dec);
      if (frac === 0n) return whole.toString();
      return `${whole}.${frac.toString().padStart(dec, "0").slice(0, 6).replace(/0+$/, "")}`;
    }

  // History removed per requirements

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
      <div className="container mx-auto px-3 py-4 sm:py-8 mt-2 sm:mt-4">
    {!wallet && (
      <div className="max-w-xl mx-auto mt-20 text-center animate-fade-in">
        <p className="text-lg sm:text-xl font-semibold text-white/90 bg-red-500/10 border border-red-500/30 rounded-xl p-6 leading-relaxed shadow-lg">
          يجب عليك تسجيل الدخول أولا لتتمكن من عرض المتجر
        </p>
        <p className="mt-4 text-sm text-white/50">
          اضغط زر تسجيل الدخول بالأعلى للمتابعة
        </p>
      </div>
    )}
    {wallet && (
          <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-center">محفظتي</h2>

            {/* Total + Refresh */}
            <div className="bg-gray-800 rounded-xl p-4 sm:p-6 mb-6 sm:mb-8 shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg sm:text-xl font-semibold">الرصيد الكلي</h3>
                <button
                  onClick={refreshBalances}
                  className="text-[10px] sm:text-xs bg-gray-700 hover:bg-gray-600 px-2.5 py-1 rounded-md transition"
                  aria-label="تحديث الأرصدة"
                >↻</button>
                <span className="text-sm text-gray-400 bg-purple-900/30 px-3 py-1 rounded-full">
                  BSC Testnet (97)
                </span>
              </div>
              <div className="text-2xl sm:text-4xl font-bold mb-1 sm:mb-2">
                ${fmt(totalApproxUSDT)}
              </div>
              <p className="text-gray-400 text-xs sm:text-sm">≈ {fmt(totalApproxUSDT)} USDT</p>
            </div>

            {/* Tokens */}
            <h3 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">عملاتي</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
              {/* USDT */}
              <div className="bg-gray-800 rounded-xl p-4 sm:p-5 shadow-lg">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm sm:text-base">USDT</h4>
                  <svg width="18" height="18" viewBox="0 0 256 256" aria-hidden>
                    <circle cx="128" cy="128" r="128" fill="#50AF95" />
                    <g fill="#fff">
                      <rect x="56" y="60" width="144" height="28" rx="5" />
                      <rect x="116" y="88" width="24" height="74" rx="5" />
                    </g>
                    <ellipse cx="128" cy="134" rx="86" ry="22" fill="none" stroke="#fff" strokeWidth="16" />
                  </svg>
                </div>
                <p className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">
                  {fmt(usdtBal?.displayValue)} يوس
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSendOpen("USDT")}
                    className="flex-1 bg-blue-600 py-1.5 sm:py-2 rounded-lg text-sm"
                  >
                    ارسال
                  </button>
                  <button
                    onClick={() => setReceiveOpen("USDT")}
                    className="flex-1 bg-blue-600 py-1.5 sm:py-2 rounded-lg text-sm"
                  >
                    استلام
                  </button>
                </div>
              </div>

              {/* FIRE */}
              <div className="bg-gray-800 rounded-xl p-4 sm:p-5 shadow-lg">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm sm:text-base">FIRE</h4>
                  <svg width="18" height="18" viewBox="0 0 64 64" aria-hidden>
                    <defs>
                      <linearGradient id="fi2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ffb347" />
                        <stop offset="100%" stopColor="#ff4d00" />
                      </linearGradient>
                    </defs>
                    <path d="M34 4c2 6 0 9 4 13s6 5 8 10c5 11-1 25-14 25S15 49 16 37c1-12 11-15 9-25 3 2 5 6 5 10 1-5 2-9 4-13Z" fill="url(#fi2)" />
                  </svg>
                </div>
                <p className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">
                  {fmt(fireBal?.displayValue)} فاير
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSendOpen("FIRE")}
                    className="flex-1 bg-orange-600 py-1.5 sm:py-2 rounded-lg text-sm"
                  >
                    ارسال
                  </button>
                  <button
                    onClick={() => setReceiveOpen("FIRE")}
                    className="flex-1 bg-orange-600 py-1.5 sm:py-2 rounded-lg text-sm"
                  >
                    استلام
                  </button>
                </div>
              </div>
            </div>

            {/* Conversion */}
            <div className="mb-14">
              <ConversionBox />
            </div>
          </div>
        )}

        {/* SEND MODAL */}
  {sendOpen && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center px-3">
            <div className="bg-gray-900 p-4 sm:p-6 rounded-xl w-full max-w-sm sm:max-w-md">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg sm:text-xl font-semibold">ارسال {sendOpen === "FIRE" ? "FIRE" : sendOpen}</h3>
                <button
                  onClick={() => setSendOpen(false)}
                  className="text-gray-400 hover:text-white transition"
                  aria-label="Close send modal"
                >
                  ✕
                </button>
              </div>
              <input
                className="w-full mb-3 rounded p-2 bg-gray-800 text-sm"
                placeholder="0x..."
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
              <div className="w-full mb-3 flex items-center gap-2">
                <input
                  className="flex-1 rounded p-2 bg-gray-800 text-sm"
                  placeholder="Amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <button
                  onClick={() => {
                    const val = (sendOpen === 'USDT' ? usdtBal?.displayValue : fireBal?.displayValue) || '0';
                    setAmount(String(val));
                    setMaxClickNonce((n) => n + 1);
                  }}
                  className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-xs"
                  type="button"
                  aria-label="Max"
                >Max</button>
              </div>

              {/* Fee estimate (Arabic) - only for FIRE sends */}
              {sendOpen === 'FIRE' && (
                <div className="text-[13px] mb-3 text-white/70 space-y-1">
                  {estimatingFees && <div className="text-white/40">...حساب الرسوم</div>}
                  {!estimatingFees && (
                    <>
                      <div>رسوم الشبكة (تقريبي): <span className="text-white/90">{networkFeeMatic ? `${networkFeeMatic} BNB` : '—'}</span></div>
                      <div>إجمالي رسوم التوكن: <span className="text-white/90">{(feeDev !== null && feeMarketing !== null && feeHolders !== null) ? `${formatRaw((feeDev||0n) + (feeMarketing||0n) + (feeHolders||0n), 2)} FIRE` : '—'}</span></div>
                      <div>سيتم الإرسال: <span className="text-white/90">{amount || '0'} FIRE</span></div>
                      <div>سيستلم المستلم: <span className="text-white/90">{feeNet !== null ? `${formatRaw(feeNet, 2)} FIRE` : '—'}</span></div>
                    </>
                  )}
                </div>
              )}

              <TransactionButton
                transaction={() => {
                  // Validate inputs before preparing transaction so we can show clear errors
                  if (!to || !ethers.utils.isAddress(to)) {
                    throw new Error("Invalid recipient address");
                  }
                  if (!amount || Number(amount) <= 0) {
                    throw new Error("Invalid amount");
                  }
                  // thirdweb `transfer` expects a human-readable `amount` (string/number)
                  return transfer({
                    contract: sendOpen === "USDT" ? USDT_CONTRACT : FIRE_CONTRACT,
                    to,
                    amount,
                  });
                }}
                onTransactionSent={(ev: any) => {
                  const txHash = ev?.transactionHash || ev?.hash || null;
                  if (txHash) setLastTxHash(txHash);
                  setLastTo(to);
                  toast.loading("...جاري الإرسال", {
                    id: "send-tx",
                    style: toastStyle,
                    position: "bottom-center",
                  });
                }}
                onError={(err) => {
                  toast.error("فشل الإرسال", {
                    id: "send-tx",
                    style: toastStyle,
                    position: "bottom-center",
                  });
                  setSendOpen(false);
                }}
                onTransactionConfirmed={(ev: any) => {
                  try {
                    const hash = ev?.transactionHash || ev?.receipt?.transactionHash || lastTxHash;
                    if (hash) setLastTxHash(hash);
                  } catch {}
                  refreshBalances();
                  toast.success("تم الإرسال بنجاح", {
                    id: "send-tx",
                    style: toastStyle,
                    position: "bottom-center",
                  });
                  setLastToken(sendOpen);
                  setSendOpen(false);
                  setTxInfoOpen(true);
                }}
              >
                تأكيد الإرسال
              </TransactionButton>
            </div>
          </div>
        )}

        {/* TX INFO MODAL */}
        {txInfoOpen && lastTxHash && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center px-3 z-50">
      <div className="bg-gray-900 p-4 sm:p-6 rounded-xl w-full max-w-xl relative">
              <button
                onClick={() => setTxInfoOpen(false)}
                aria-label="إغلاق معلومات المعاملة"
        className="absolute -top-2 right-2 sm:top-2 sm:right-2 text-gray-400 hover:text-white transition"
              >✕</button>
              <h3 className="text-lg sm:text-xl font-semibold mb-4">تفاصيل المعاملة</h3>
              <TransactionInfo
                txHash={lastTxHash}
                tokenAddress={lastToken === 'USDT' ? USDT_CONTRACT.address : lastToken === 'FIRE' ? FIRE_CONTRACT.address : undefined}
        tokenDecimals={lastToken === 'USDT' ? 6 : lastToken === 'FIRE' ? 2 : 18}
        tokenLabel={lastToken || undefined}
        success
                expectedFrom={address || undefined}
                expectedTo={lastTo || undefined}
              />
            </div>
          </div>
        )}

        {/* RECEIVE MODAL */}
  {receiveOpen && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center px-3">
            <div className="bg-gray-900 p-4 sm:p-6 rounded-xl w-full max-w-sm sm:max-w-md text-center relative">
              <button
                onClick={() => setReceiveOpen(false)}
                aria-label="إغلاق نافذة الاستلام"
                className="absolute top-3 right-3 text-gray-400 hover:text-white transition"
              >
                ✕
              </button>
              <h3 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-6">
                استلام {receiveOpen === "FIRE" ? "FIRE" : receiveOpen}
              </h3>
              <div className="mx-auto mb-3 sm:mb-4 w-40 h-40 sm:w-52 sm:h-52 bg-white rounded-xl flex items-center justify-center shadow-inner">
                <QRCode value={address || ""} size={150} />
              </div>
              <p className="mt-2 break-all text-xs sm:text-sm text-white/70 px-2">{address}</p>
              <p className="mt-3 text-[11px] sm:text-xs text-orange-300 font-medium bg-orange-500/10 inline-block px-3 py-1 rounded-md border border-orange-400/30">
                الشبكة: BSC Testnet (97)
              </p>
            </div>
          </div>
        )}
    </div>
  </div>
  );
}
