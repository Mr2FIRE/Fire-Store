"use client";

import { useState, useEffect } from "react";
import { useActiveAccount, TransactionButton } from "thirdweb/react";
import { getContract, readContract, prepareContractCall } from "thirdweb";
import { POLYGON, FIRE_CONTRACT_ADDRESS, USDT_CONTRACT_ADDRESS, CONVERSION_CONTRACT_ADDRESS } from "../const/addresses";
import { client } from "../client";
import toast from "react-hot-toast";
import toastStyle from "../util/toastConfig";

// Minimal ABI for conversion contract
const CONVERSION_ABI = [
  { type: "function", name: "convert", stateMutability: "nonpayable", inputs: [
      { name: "fromToken", type: "address" }, { name: "toToken", type: "address" }, { name: "amountIn", type: "uint256" }
    ], outputs: [{ name: "amountOut", type: "uint256" }] },
  { type: "function", name: "quote", stateMutability: "view", inputs: [
      { name: "fromToken", type: "address" }, { name: "toToken", type: "address" }, { name: "amountIn", type: "uint256" }
    ], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "buyGasWithUSDT", stateMutability: "nonpayable", inputs: [ { name: "maticAmountWei", type: "uint256" } ], outputs: [] },
  { type: "function", name: "maticPriceUsdt", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] }
];
// ERC20 allowance + approve (standard)
const ERC20_MINI_ABI = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [ { name: "owner", type: "address" }, { name: "spender", type: "address" } ], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [ { name: "spender", type: "address" }, { name: "amount", type: "uint256" } ], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [ { name: "account", type: "address" } ], outputs: [{ name: "", type: "uint256" }] },
];

type Pair = { id: string; from: string; to: string; label: string };

const pairs: Pair[] = [
  { id: "USDT-FIRE", from: USDT_CONTRACT_ADDRESS, to: FIRE_CONTRACT_ADDRESS, label: "تحويل USDT إلى FIRE" },
  { id: "FIRE-USDT", from: FIRE_CONTRACT_ADDRESS, to: USDT_CONTRACT_ADDRESS, label: "تحويل FIRE إلى USDT" },
];

export default function ConversionBox() {
  const account = useActiveAccount();
  const address = account?.address;
  const [pair, setPair] = useState<Pair>(pairs[0]);
  const [amount, setAmount] = useState("");
  const [decimalsFrom, setDecimalsFrom] = useState(18);
  const [decimalsTo, setDecimalsTo] = useState(18);
  const [quote, setQuote] = useState<string | null>(null);
  const [rawQuote, setRawQuote] = useState<bigint | null>(null); // unformatted output amount
  const [fetchingQuote, setFetchingQuote] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [checkingAllow, setCheckingAllow] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [minAmountError, setMinAmountError] = useState<string | null>(null);
  const APPROVE_AMOUNT = BigInt("100000000000"); // fixed large allowance
  // Gas purchase state
  const [gasAmount, setGasAmount] = useState("");
  const [gasCostDisplay, setGasCostDisplay] = useState<string | null>(null);
  const [gasNeedsApproval, setGasNeedsApproval] = useState(false);
  const [gasLoading, setGasLoading] = useState(false);
  const [gasError, setGasError] = useState<string | null>(null);
  const [priceMatic, setPriceMatic] = useState<bigint | null>(null);
  const [usdtDecimals, setUsdtDecimals] = useState<number>(6);

  // Load decimals once when pair changes
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
    const fromC = getContract({ client, chain: POLYGON, address: pair.from, abi: ERC20_MINI_ABI as any });
    const toC = getContract({ client, chain: POLYGON, address: pair.to, abi: ERC20_MINI_ABI as any });
        const [dFrom, dTo] = await Promise.all([
          readContract({ contract: fromC, method: "decimals", params: [] }) as Promise<number>,
          readContract({ contract: toC, method: "decimals", params: [] }) as Promise<number>,
        ]);
        if (!ignore) { setDecimalsFrom(dFrom); setDecimalsTo(dTo); }
      } catch {}
    })();
    return () => { ignore = true; };
  }, [pair]);

  // Check allowance
  useEffect(() => {
    if (!address || !amount) { setNeedsApproval(false); return; }
    let ignore = false;
    (async () => {
      setCheckingAllow(true);
      try {
  const fromC = getContract({ client, chain: POLYGON, address: pair.from, abi: ERC20_MINI_ABI as any });
  const allowance: bigint = await readContract({ contract: fromC, method: "allowance", params: [address, CONVERSION_CONTRACT_ADDRESS] }) as any;
  const amt = parseInput(amount, decimalsFrom);
  if (!ignore) setNeedsApproval(allowance < amt);
      } catch { if (!ignore) setNeedsApproval(true); }
      finally { if (!ignore) setCheckingAllow(false); }
    })();
    return () => { ignore = true; };
  }, [address, amount, pair, decimalsFrom]);

  // Fetch quote
  useEffect(() => {
  if (!amount) { setQuote(null); setRawQuote(null); setErrorMsg(null); return; }
    let ignore = false;
    (async () => {
      try {
        setFetchingQuote(true);
        setErrorMsg(null);
        const conv = getContract({ client, chain: POLYGON, address: CONVERSION_CONTRACT_ADDRESS, abi: CONVERSION_ABI as any });
        const amtIn = parseInput(amount, decimalsFrom);
        const out: bigint = await readContract({ contract: conv, method: "quote", params: [pair.from, pair.to, amtIn] }) as any;
        if (!ignore) { setQuote(format(out, decimalsTo)); setRawQuote(out); }
      } catch (e:any) { if (!ignore) { setQuote(null); setRawQuote(null); const m = (e?.message||"").toUpperCase(); if (m.includes("PAIR_NOT_ALLOWED")) setErrorMsg("هذا الزوج غير مدعوم"); else if (m.includes("UNSET")) setErrorMsg("العقد غير مهيأ للتوكن"); else setErrorMsg("تعذر التسعير"); } }
      finally { if (!ignore) setFetchingQuote(false); }
    })();
    return () => { ignore = true; };
  }, [amount, pair, decimalsFrom, decimalsTo]);

  // Fetch USDT decimals once
  useEffect(() => { (async () => { try { const usdtC = getContract({ client, chain: POLYGON, address: USDT_CONTRACT_ADDRESS, abi: ERC20_MINI_ABI as any }); const d = await readContract({ contract: usdtC, method: "decimals", params: [] }) as number; setUsdtDecimals(d);} catch {} })(); }, []);
  // Fetch MATIC price from contract
  useEffect(() => { (async () => { try { const conv = getContract({ client, chain: POLYGON, address: CONVERSION_CONTRACT_ADDRESS, abi: CONVERSION_ABI as any }); const p = await readContract({ contract: conv, method: "maticPriceUsdt", params: [] }) as bigint; setPriceMatic(p);} catch {} })(); }, []);
  // Gas cost & allowance
  useEffect(() => {
    let ignore=false;
    (async () => {
      if (!address || !gasAmount || !priceMatic) { setGasCostDisplay(null); setGasNeedsApproval(false); return; }
      try {
        setGasLoading(true); setGasError(null);
        const wei = parseMatic(gasAmount);
        if (wei === 0n) { setGasCostDisplay(null); return; }
        const costScaled = wei * priceMatic / 10n**18n; // still scaled 1e18
        const adjust = 10n ** BigInt(18 - usdtDecimals);
        const cost = costScaled / adjust;
        const display = format(cost, usdtDecimals);
        if (!ignore) setGasCostDisplay(display);
        const usdtC = getContract({ client, chain: POLYGON, address: USDT_CONTRACT_ADDRESS, abi: ERC20_MINI_ABI as any });
        const allowance: bigint = await readContract({ contract: usdtC, method: "allowance", params: [address, CONVERSION_CONTRACT_ADDRESS] }) as any;
        if (!ignore) setGasNeedsApproval(allowance < cost);
      } catch { if (!ignore) { setGasError("تعذر حساب تكلفة الغاز"); setGasCostDisplay(null);} }
      finally { if (!ignore) setGasLoading(false); }
    })();
    return () => { ignore = true; };
  }, [address, gasAmount, priceMatic, usdtDecimals]);

  function parseInput(v: string, dec: number) {
    if (!v) return 0n;
    const [intP, fracP = ""] = v.replace(/,/g, "").split(".");
    const frac = fracP.slice(0, dec).padEnd(dec, "0");
    return BigInt(intP || "0") * 10n ** BigInt(dec) + BigInt(frac || "0");
  }
  function format(raw: bigint, dec: number) {
    const whole = raw / 10n ** BigInt(dec);
    const frac = raw % 10n ** BigInt(dec);
    if (frac === 0n) return whole.toString();
    return `${whole}.${frac.toString().padStart(dec, "0").slice(0, 6).replace(/0+$/, "")}`;
  }
  function parseMatic(v:string){ if(!v) return 0n; const [i,f=""] = v.replace(/,/g,"").split("."); const frac = f.slice(0,18).padEnd(18,"0"); return BigInt(i||"0")*10n**18n + BigInt(frac||"0"); }

  // Minimum FIRE amount enforcement (FIRE has 2 decimals => smallest unit 0.01)
  useEffect(() => {
    setMinAmountError(null);
    if (!amount) return;
    if (pair.id === "USDT-FIRE") {
      // require >= 1 USDT
      const amtUnits = parseInput(amount, decimalsFrom);
      const minUnits = 1n * 10n ** BigInt(decimalsFrom); // 1 * 10^dec
      if (amtUnits < minUnits) setMinAmountError("الحد الأدنى للتحويل هو 1 USDT");
    } else if (pair.id === "FIRE-USDT") {
      // require >= 0.1 FIRE (FIRE decimals = 2 -> 10 units)
      const amtUnits = parseInput(amount, decimalsFrom);
      const minUnits = 10n; // 0.1 FIRE with 2 decimals
      if (amtUnits < minUnits) setMinAmountError("الحد الأدنى للتحويل هو 0.1 FIRE");
    }
  }, [amount, pair, decimalsFrom]);

  const canConvert = !!address && amount && !needsApproval && !fetchingQuote && quote && !errorMsg && !minAmountError;

  const symbolFor = (addr:string) => {
    if (addr.toLowerCase() === FIRE_CONTRACT_ADDRESS.toLowerCase()) return "FIRE";
    if (addr.toLowerCase() === USDT_CONTRACT_ADDRESS.toLowerCase()) return "USDT";
    return "TOKEN";
  };
  const fromSym = symbolFor(pair.from);
  const toSym = symbolFor(pair.to);
  const isFireToUsdt = pair.id === "FIRE-USDT";
  const directionClass = isFireToUsdt ? "text-green-300" : "text-orange-300";
  const boxGradient = isFireToUsdt ? "from-green-900/50 to-black/70" : "from-gray-800/70 to-black/60";
  const selectClass = isFireToUsdt ? "bg-green-950/50 text-green-200" : "bg-white/10 text-orange-200";

  return (
    <div className={`bg-gradient-to-br ${boxGradient} border border-white/10 rounded-2xl p-5 sm:p-6 shadow-lg space-y-4 transition-colors`}>
      <div className="flex items-center justify-between">
        <h3 className={`text-sm font-semibold ${directionClass}`}>تحويل سريع (Conversion)</h3>
        <select value={pair.id} onChange={e => setPair(pairs.find(p => p.id===e.target.value)!)} className={`${selectClass} text-xs px-2 py-1 rounded-md outline-none`}>
          {pairs.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-[11px] text-white/50 mb-1 block">المبلغ ({pair.label.split(' ')[0]})</label>
          <input value={amount} onChange={e=>setAmount(e.target.value.replace(/[^0-9.,]/g,''))} placeholder="0.0" className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
        </div>
        <div className="text-[11px] min-h-[34px] space-y-1">
          {fetchingQuote && amount && <div className="text-white/40">...تسعير</div>}
          {!fetchingQuote && quote && (
            <>
              <div className="text-white/60">النتيجة المتوقعة ≈ <span className={directionClass}>{quote}</span> {toSym}</div>
              <div className="text-white/40">سترسل <span className="text-white/70">{amount}</span> {fromSym} وستستلم <span className={directionClass}>{quote}</span> {toSym}</div>
            </>
          )}
          {!fetchingQuote && errorMsg && <div className="text-red-400">{errorMsg}</div>}
          {!fetchingQuote && !errorMsg && minAmountError && <div className="text-red-400">{minAmountError}</div>}
        </div>
        {checkingAllow && <p className="text-[11px] text-white/40">...فحص السماح</p>}
        {needsApproval && !checkingAllow && (
          <TransactionButton
            transaction={() => {
              const fromC = getContract({ client, chain: POLYGON, address: pair.from, abi: ERC20_MINI_ABI as any });
              return prepareContractCall({ contract: fromC, method: "approve", params: [CONVERSION_CONTRACT_ADDRESS, APPROVE_AMOUNT] });
            }}
            onTransactionSent={() => toast.loading("...توثيق", { id: "conv-app", style: toastStyle, position: "bottom-center" })}
            onError={() => toast.error("فشل التوثيق", { id: "conv-app", style: toastStyle, position: "bottom-center" })}
            onTransactionConfirmed={() => { toast.success("تم التوثيق", { id: "conv-app", style: toastStyle, position: "bottom-center" }); setNeedsApproval(false); }}
            className="w-full bg-orange-600 hover:bg-orange-500 text-black font-semibold text-sm rounded-lg py-2"
          >توثيق السماح</TransactionButton>
        )}
        {canConvert && (
          <TransactionButton
            transaction={() => {
              const conv = getContract({ client, chain: POLYGON, address: CONVERSION_CONTRACT_ADDRESS, abi: CONVERSION_ABI as any });
              const amtIn = parseInput(amount, decimalsFrom);
              return prepareContractCall({ contract: conv, method: "convert", params: [pair.from, pair.to, amtIn] });
            }}
            onTransactionSent={() => toast.loading("...تنفيذ", { id: "conv-do", style: toastStyle, position: "bottom-center" })}
            onError={() => toast.error("فشل التحويل", { id: "conv-do", style: toastStyle, position: "bottom-center" })}
            onTransactionConfirmed={() => { toast.success("تم التحويل", { id: "conv-do", style: toastStyle, position: "bottom-center" }); setAmount(""); setQuote(null); }}
            className="w-full bg-gradient-to-r from-orange-500 via-pink-600 to-purple-600 hover:from-orange-400 hover:to-purple-500 text-black font-semibold text-sm rounded-lg py-2"
          >تنفيذ التحويل</TransactionButton>
        )}
        {!needsApproval && !canConvert && amount && !fetchingQuote && !quote && !errorMsg && (
          <p className="text-[11px] text-red-400">تعذر الحصول على تسعير</p>
        )}
        <p className="text-[10px] text-white/30 leading-relaxed pt-1">التحويل محصور بالأزواج المسموح بها فقط. سيتم لاحقاً إضافة أزواج أخرى بعد تحديث العقد.</p>
        {/* Gas Purchase Section */}
        <div className="mt-6 pt-5 border-t border-white/10 space-y-3">
          <h4 className="text-sm font-semibold text-blue-300">شراء عمولة (POL)</h4>
          <div>
            <label className="text-[11px] text-white/50 mb-1 block">الكمية المطلوبة (POL)</label>
            <input value={gasAmount} onChange={e=>setGasAmount(e.target.value.replace(/[^0-9.,]/g,''))} placeholder="0.05" className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
          </div>
          <div className="text-[11px] min-h-[18px]">
            {gasLoading && gasAmount && <span className="text-white/40">...حساب</span>}
            {!gasLoading && gasCostDisplay && <span className="text-white/60">التكلفة ≈ <span className="text-blue-300">{gasCostDisplay}</span> USDT</span>}
            {!gasLoading && gasError && <span className="text-red-400">{gasError}</span>}
          </div>
          {gasAmount && gasCostDisplay && gasNeedsApproval && (
            <TransactionButton
              transaction={() => {
                const usdtC = getContract({ client, chain: POLYGON, address: USDT_CONTRACT_ADDRESS, abi: ERC20_MINI_ABI as any });
                return prepareContractCall({ contract: usdtC, method: "approve", params: [CONVERSION_CONTRACT_ADDRESS, APPROVE_AMOUNT] });
              }}
              onTransactionSent={() => toast.loading("...توثيق", { id: "gas-app", style: toastStyle, position: "bottom-center" })}
              onError={() => toast.error("فشل التوثيق", { id: "gas-app", style: toastStyle, position: "bottom-center" })}
              onTransactionConfirmed={() => { toast.success("تم التوثيق", { id: "gas-app", style: toastStyle, position: "bottom-center" }); setGasNeedsApproval(false); }}
              className="w-full bg-blue-600 hover:bg-blue-500 text-black font-semibold text-sm rounded-lg py-2"
            >توثيق USDT</TransactionButton>
          )}
          {gasAmount && gasCostDisplay && !gasNeedsApproval && !gasError && (
            <TransactionButton
              transaction={() => {
                const conv = getContract({ client, chain: POLYGON, address: CONVERSION_CONTRACT_ADDRESS, abi: CONVERSION_ABI as any });
                const wei = parseMatic(gasAmount);
                return prepareContractCall({ contract: conv, method: "buyGasWithUSDT", params: [wei] });
              }}
              onTransactionSent={() => toast.loading("...شراء", { id: "gas-buy", style: toastStyle, position: "bottom-center" })}
              onError={() => toast.error("فشل الشراء", { id: "gas-buy", style: toastStyle, position: "bottom-center" })}
              onTransactionConfirmed={() => { toast.success("تم شراء الغاز", { id: "gas-buy", style: toastStyle, position: "bottom-center" }); setGasAmount(""); setGasCostDisplay(null); }}
              className="w-full bg-gradient-to-r from-blue-500 via-cyan-500 to-emerald-500 hover:from-blue-400 hover:to-emerald-400 text-black font-semibold text-sm rounded-lg py-2"
            >شراء الغاز الآن</TransactionButton>
          )}
          <p className="text-[10px] text-white/30 leading-relaxed">السعر يعتمد على تسعيرة المطور, ستكون 0.1 كمية كافية لعدة معاملات</p>
        </div>
      </div>
    </div>
  );
}
