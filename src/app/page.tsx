"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
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
  POLYGON,
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


  // ===== Balances (Polygon tokens) =====
  const { data: usdtBal, refetch: refetchUsdt } = useWalletBalance({
    client: USDT_CONTRACT.client,
    chain: POLYGON,
    address,
    tokenAddress: USDT_CONTRACT.address,
  });

  const { data: fireBal, refetch: refetchFire } = useWalletBalance({
    client: FIRE_CONTRACT.client,
    chain: POLYGON,
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

  const totalApproxUSDT =
    Number(usdtBal?.displayValue || 0) +
    Number(fireBal?.displayValue || 0) * (fireRate || FIRE_TO_USDT_RATE);

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
                  Polygon
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

              <TransactionButton
                transaction={() =>
                  transfer({
                    contract:
                      sendOpen === "USDT" ? USDT_CONTRACT : FIRE_CONTRACT,
                    to,
                    amount,
                  })
                }
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
                الشبكة: بوليجون (Polygon)
              </p>
            </div>
          </div>
        )}
    </div>
  </div>
  );
}
