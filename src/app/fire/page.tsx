"use client";
import { useEffect, useState } from "react";
import { useActiveAccount, useWalletBalance, TransactionButton } from "thirdweb/react";
import { getContract, readContract, prepareContractCall } from "thirdweb";
import { FIRE_CONTRACT, POLYGON, FIRE_DIVIDEND_DISTRIBUTOR_ADDRESS } from "../const/addresses";
import toast from "react-hot-toast";
import toastStyle from "../util/toastConfig";

// Precise ABI fragments from provided contract for reading & claiming
const DISTRIBUTOR_ABI: any[] = [
  { type: "function", name: "getUnpaidEarnings", stateMutability: "view", inputs: [{ name: "shareholder", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "claimDividend", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "shares", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [
      { name: "amount", type: "uint256" },
      { name: "totalExcluded", type: "uint256" },
      { name: "totalRealised", type: "uint256" }
    ] },
  { type: "function", name: "totalDividends", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "totalDistributed", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "totalShares", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "dividendsPerShare", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
];

function formatAmount(raw: bigint, decimals: number) {
  const whole = raw / BigInt(10) ** BigInt(decimals);
  const frac = raw % (BigInt(10) ** BigInt(decimals));
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, 4).replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}

export default function FireTokenPage() {
  const account = useActiveAccount();
  const address = account?.address;
  const { data: fireBal, refetch: refetchFire } = useWalletBalance({
    client: FIRE_CONTRACT.client,
    chain: POLYGON,
    address,
    tokenAddress: FIRE_CONTRACT.address,
  });

  const [pendingRaw, setPendingRaw] = useState<bigint | null>(null);
  const [realisedRaw, setRealisedRaw] = useState<bigint | null>(null);
  const [stats, setStats] = useState<{ totalDividends?: bigint; totalDistributed?: bigint; totalShares?: bigint; shareAmount?: bigint } | null>(null);
  const [loadingRewards, setLoadingRewards] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  async function loadRewards() {
    if (!address) { setPendingRaw(null); setRealisedRaw(null); return; }
    setLoadingRewards(true); setError(null);
    try {
      const contract = getContract({ client: FIRE_CONTRACT.client, chain: POLYGON, address: FIRE_DIVIDEND_DISTRIBUTOR_ADDRESS, abi: DISTRIBUTOR_ABI });
      const [pending, shareTuple, totalDividends, totalDistributed, totalShares] = await Promise.all([
        readContract({ contract, method: "getUnpaidEarnings", params: [address] }) as Promise<bigint>,
        readContract({ contract, method: "shares", params: [address] }) as Promise<any>,
        readContract({ contract, method: "totalDividends", params: [] }) as Promise<bigint>,
        readContract({ contract, method: "totalDistributed", params: [] }) as Promise<bigint>,
        readContract({ contract, method: "totalShares", params: [] }) as Promise<bigint>,
      ]);
      setPendingRaw(pending);
      let shareAmount: bigint | undefined;
      if (Array.isArray(shareTuple)) {
        shareAmount = shareTuple[0] as bigint;
        setRealisedRaw(shareTuple[2] as bigint);
      } else if (shareTuple && typeof shareTuple === 'object' && 'totalRealised' in shareTuple) {
        setRealisedRaw(shareTuple.totalRealised as bigint);
      }
      setStats({ totalDividends, totalDistributed, totalShares, shareAmount });
    } catch (e:any) {
      setError(e.message || 'فشل جلب بيانات المكافآت');
      setPendingRaw(null); setRealisedRaw(null); setStats(null);
    } finally { setLoadingRewards(false); }
  }

  useEffect(() => { loadRewards(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [address]);

  const fireDisplay = fireBal?.displayValue ? Number(fireBal.displayValue).toLocaleString('en-US', { maximumFractionDigits: 6 }) : '0';
  const pendingDisplay = pendingRaw !== null ? formatAmount(pendingRaw, 6) : '0';
  const realisedDisplay = realisedRaw !== null ? formatAmount(realisedRaw, 6) : '0';

  // Decorative animated background sparks
  const Sparks = () => (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {[...Array(18)].map((_, i) => {
        const delay = (i * 1.3) % 12;
        const size = 4 + (i % 5) * 2;
        const left = (i * 37) % 100; // pseudo-random
        const duration = 8 + (i % 7) * 2;
        return (
          <span
            key={i}
            style={{
              left: left + '%',
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
              width: size,
              height: size,
            }}
            className="absolute bottom-0 bg-gradient-to-br from-orange-400 via-yellow-300 to-pink-400 rounded-full opacity-30 animate-[rise_10s_linear_infinite] blur-[1px]"
          />
        );
      })}
      <style>{`@keyframes rise {0%{transform:translateY(0) scale(.6);opacity:.15} 50%{opacity:.4} 100%{transform:translateY(-120vh) scale(1.3);opacity:0}}`}</style>
    </div>
  );

  return (
    <div className="min-h-screen relative bg-gradient-to-br from-gray-900 via-gray-950 to-black text-white px-4 py-10 flex flex-col">
      <Sparks />
      <div className="flex-1 flex flex-col justify-center max-w-3xl mx-auto w-full space-y-10">
        <header className="text-center space-y-6">
          <div className="mx-auto w-28 h-28 relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-orange-500 via-purple-600 to-pink-600 animate-spin-slow [animation-duration:14s] opacity-60" />
            <div className="absolute inset-[6px] rounded-full bg-black/80 flex items-center justify-center">
              {/* Reuse flame icon style (simplified) */}
              <svg viewBox="0 0 64 64" className="w-16 h-16">
                <defs>
                  <radialGradient id="fg" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#ffe6d2" />
                    <stop offset="40%" stopColor="#ff9d2f" />
                    <stop offset="80%" stopColor="#ff4d00" />
                  </radialGradient>
                </defs>
                <path d="M34 4c2 6 0 9 4 13s6 5 8 10c5 11-1 25-14 25S15 49 16 37c1-12 11-15 9-25 3 2 5 6 5 10 1-5 2-9 4-13Z" fill="url(#fg)" />
                <path d="M33 14c1 4-1 6 2 9 2 2 3 3 4 6 2 6-2 13-9 13s-10-7-8-13c1-6 6-7 5-13 2 1 4 4 4 6 0-3 1-5 2-8Z" fill="#fff2e6" opacity={0.7} />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold bg-gradient-to-r from-orange-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">عملة فاير</h1>
          <p className="text-white/60 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">هذه الصفحة تعرض رصيدك الحالي من عملة فاير بالإضافة إلى مكافآت الانعكاس (رسوم فاير) التي تُوزع لك بعملة USDT.</p>
        </header>

        {!address && (
          <div className="text-center py-24 text-white/50">سجل الدخول لعرض بيانات فاير</div>
        )}

        {address && (
          <div className="space-y-12">
            {/* Centered Balance Hero */}
            <div className="text-center flex flex-col items-center gap-6">
              <div className="relative">
                <div className="text-[2.75rem] sm:text-[4rem] font-extrabold tracking-tight bg-gradient-to-br from-orange-400 via-yellow-300 to-pink-500 bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(255,130,40,0.25)]">
                  {fireDisplay} <span className="text-base sm:text-2xl align-top text-white/40 font-normal"></span>
                </div>
                <div className="absolute -inset-2 -z-10 opacity-30 blur-2xl bg-gradient-to-r from-orange-600 via-purple-600 to-pink-600 rounded-full" />
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <button onClick={() => refetchFire()} className="px-4 py-2 text-xs rounded-lg bg-white/10 hover:bg-white/20 transition">↻</button>
                <button onClick={loadRewards} disabled={loadingRewards} className="px-4 py-2 text-xs rounded-lg bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-400 hover:to-pink-500 font-semibold text-black disabled:opacity-50">{loadingRewards? '...':'تحديث المكافآت'}</button>
              </div>
            </div>

            {/* Rewards + Stats */}
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="relative bg-white/5 border border-white/10 rounded-2xl p-6 overflow-hidden">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl" />
                <div className="relative">
                  <h2 className="text-sm font-semibold mb-3 text-purple-300">مكافآت USDT المعلقة</h2>
                  <div className="text-3xl sm:text-4xl font-extrabold tracking-wide text-green-300 drop-shadow-[0_0_10px_rgba(0,255,180,0.25)]">{pendingDisplay}<span className="text-sm ml-1 text-white/40 font-normal">USDT</span></div>
                  <p className="text-[11px] mt-2 text-white/40">المبلغ القابل للسحب الآن</p>
                  {error && <p className="text-[11px] mt-3 text-red-400">{error}</p>}
                  {!error && pendingRaw === null && !loadingRewards && <p className="text-[11px] mt-3 text-white/40">لا توجد بيانات</p>}
                  <div className="mt-4">
                    <TransactionButton
                      transaction={() => {
                        setClaiming(true);
                        const contract = getContract({ client: FIRE_CONTRACT.client, chain: POLYGON, address: FIRE_DIVIDEND_DISTRIBUTOR_ADDRESS, abi: DISTRIBUTOR_ABI });
                        return prepareContractCall({ contract, method: "claimDividend", params: [] });
                      }}
                      disabled={!pendingRaw || pendingRaw === 0n || claiming}
                      onTransactionSent={() => toast.loading("...جارٍ المطالبة", { id: "claim-div", style: toastStyle, position: "bottom-center" })}
                      onError={(e) => { setClaiming(false); toast.error("فشل المطالبة", { id: "claim-div", style: toastStyle, position: "bottom-center" }); }}
                      onTransactionConfirmed={() => { toast.success("تم استلام المكافآت", { id: "claim-div", style: toastStyle, position: "bottom-center" }); setClaiming(false); loadRewards(); }}
                      className="w-full px-5 py-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-black font-semibold text-sm disabled:opacity-40"
                    >سحب المكافآت</TransactionButton>
                  </div>
                </div>
              </div>
              <div className="relative bg-white/5 border border-white/10 rounded-2xl p-6 overflow-hidden">
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-pink-600/10 rounded-full blur-3xl" />
                <div className="relative space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-orange-300 flex items-center gap-2">إحصائيات
                      <button onClick={() => setShowInfo(true)} aria-label="معلومات" className="w-5 h-5 rounded-full bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 text-[11px] flex items-center justify-center font-bold">!</button>
                    </h2>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-[11px] sm:text-xs">
                    <div>
                      <p className="text-white/50">محصلة مستلمة</p>
                      <p className="font-bold text-white/90 mt-0.5">{realisedDisplay}<span className="ml-0.5 text-[10px] text-white/40">USDT</span></p>
                    </div>
                    <div>
                      <p className="text-white/50">إجمالي الموزع</p>
                      <p className="font-bold text-white/90 mt-0.5">{stats?.totalDistributed ? formatAmount(stats.totalDistributed, 6) : '0'}<span className="ml-0.5 text-[10px] text-white/40">USDT</span></p>
                    </div>
                    <div>
                      <p className="text-white/50">إجمالي الأرباح</p>
                      <p className="font-bold text-white/90 mt-0.5">{stats?.totalDividends ? formatAmount(stats.totalDividends, 6) : '0'}<span className="ml-0.5 text-[10px] text-white/40">USDT</span></p>
                    </div>
                    <div>
                      <p className="text-white/50">إجمالي الحصص</p>
                      <p className="font-bold text-white/90 mt-0.5">{stats?.totalShares ? Number(stats.totalShares).toLocaleString() : '0'}</p>
                    </div>
                    <div>
                      <p className="text-white/50">حصتك المسجلة</p>
                      <p className="font-bold text-white/90 mt-0.5">{stats?.shareAmount ? Number(stats.shareAmount).toLocaleString() : '0'}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-white/30 leading-relaxed">قيم تقريبية تعتمد على قراءة عقد الموزع. قد لا تُحدَّث فورياً حتى تنفذ عملية المعالجة الدورية.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div onClick={() => setShowInfo(false)} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg bg-gradient-to-br from-gray-900 via-gray-800 to-black border border-white/10 rounded-2xl p-5 sm:p-7 shadow-2xl overflow-hidden">
            <div className="absolute -top-32 -right-24 w-72 h-72 bg-orange-600/20 blur-3xl" />
            <div className="absolute -bottom-32 -left-24 w-72 h-72 bg-purple-600/20 blur-3xl" />
            <div className="relative space-y-4 text-[13px] leading-relaxed">
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-lg font-bold bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent">كيف تعمل مكافآت الانعكاس؟</h3>
                <button onClick={() => setShowInfo(false)} className="text-white/50 hover:text-white text-xl leading-none">×</button>
              </div>
              <p className="text-white/70">يتم تجميع جزء من الرسوم في عقد التوزيع وتحويله إلى عملة <span className="text-green-300 font-semibold">USDT</span> ثم يُحسب لكل حامل بحسب حصته من إجمالي الحصص.</p>
              <ul className="list-disc pr-5 space-y-1 text-white/65">
                <li><span className="text-orange-300 font-semibold">getUnpaidEarnings</span>: الرصيد القابل للسحب الآن (غير مُطالب به).</li>
                <li><span className="text-orange-300 font-semibold">totalDividends</span>: إجمالي ما تم تحصيله (USDT) داخل النظام.</li>
                <li><span className="text-orange-300 font-semibold">totalDistributed</span>: مجموع ما تم صرفه فعلياً للحسابات.</li>
                <li><span className="text-orange-300 font-semibold">totalShares</span>: مجموع الحصص (عادةً يساوي إجمالي عدد التوكنات المؤهلة).</li>
                <li><span className="text-orange-300 font-semibold">حصتك المسجلة</span>: مقدار FIRE المسجل حالياً لعناونك داخل الموزع.</li>
                <li><span className="text-orange-300 font-semibold">محصلة مستلمة</span>: مجموع ما قمت بسحبه تاريخياً (Realised).</li>
              </ul>
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-[11px] text-white/60">
                <p className="font-semibold mb-1 text-white/80">الصيغة المبسطة:</p>
                <p>الأرباح التراكمية = (حصتك * dividendsPerShare) ÷ الدقة (10^36).<br/>المكافآت القابلة للسحب = الأرباح التراكمية - totalExcluded.</p>
              </div>
              <p className="text-[11px] text-white/40">لتزيد مكافآتك احتفظ بعملة FIRE؛ عند كل توزيع جديد تزيد قيمة <span className="text-purple-300">dividendsPerShare</span> وتزداد أرباحك غير المستلمة حتى تطالب بها.</p>
              <div className="flex justify-end pt-2">
                <button onClick={() => setShowInfo(false)} className="px-4 py-2 rounded-md bg-gradient-to-r from-orange-500 to-pink-600 text-black text-sm font-semibold hover:from-orange-400 hover:to-pink-500">فهمت</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
