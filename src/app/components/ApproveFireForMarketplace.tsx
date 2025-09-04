"use client";
import { useEffect, useState } from "react";
import { useActiveAccount, TransactionButton } from "thirdweb/react";
import { FIRE_CONTRACT, MARKETPLACE_ADDRESS } from "../const/addresses";
import { readContract, prepareContractCall } from "thirdweb";
import { getContract } from "thirdweb";
import { POLYGON } from "../const/addresses";
import toast from "react-hot-toast";
import toastStyle from "../util/toastConfig";

const ERC20_ABI = [
  { type: "function", name: "allowance", stateMutability: "view", inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [
      { name: "spender", type: "address" }, { name: "amount", type: "uint256" }
    ], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "approveMax", stateMutability: "nonpayable", inputs: [
      { name: "spender", type: "address" }
    ], outputs: [{ name: "", type: "bool" }] }
];

// Removed persistent localStorage gating; always verify on-chain each session

export default function ApproveFireForMarketplace() {
  const account = useActiveAccount();
  const [needsApproval, setNeedsApproval] = useState(false);
  const [checking, setChecking] = useState(true);
  const [allowanceValue, setAllowanceValue] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useFallbackApprove, setUseFallbackApprove] = useState(false);
  const [txBusy, setTxBusy] = useState(false);
  const [recheckKey, setRecheckKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    async function check() {
      if (!account?.address) { setChecking(false); setAllowanceValue(null); return; }
      try {
        setError(null);
        const contract = getContract({ client: FIRE_CONTRACT.client, chain: POLYGON, address: FIRE_CONTRACT.address, abi: ERC20_ABI as any });
        const allowance: bigint = await readContract({ contract, method: "allowance", params: [account.address, MARKETPLACE_ADDRESS] }) as unknown as bigint;
        if (!ignore) {
          setAllowanceValue(allowance);
          setNeedsApproval(allowance === 0n);
        }
      } catch (e) {
          console.warn("Allowance check failed", e);
          const msg = (e as any)?.message || 'فشل فحص السماح';
          if (!ignore) {
            setError(msg);
            setNeedsApproval(true); // show button so user can attempt approve
          }
      } finally {
        if (!ignore) setChecking(false);
      }
    }
    check();
    return () => { ignore = true; };
  }, [account?.address, recheckKey]);

  if (!account?.address) return null;
  // Show a slim bar while checking
  if (checking) {
    return (
      <div className="mb-6 max-w-2xl mx-auto text-center text-white/50 text-sm animate-pulse">
        ...فحص سماح المتجر
      </div>
    );
  }
  if (!needsApproval) return null;

  return (
    <div className="mb-6 p-4 border border-yellow-500/40 bg-yellow-500/10 rounded-xl max-w-2xl mx-auto text-center animate-fade-in">
      <p className="mb-3 text-sm sm:text-base font-semibold text-yellow-200">
        يجب توثيق المتجر للسماح له باستخدام رصيد FIRE (مرة واحدة فقط)
      </p>
      {allowanceValue !== null && (
        <p className="text-[11px] text-white/40 mb-2">القيمة الحالية للسماح: {allowanceValue.toString()}</p>
      )}
      {error && (
        <p className="text-[11px] text-red-400 mb-2 break-all">خطأ الفحص: {error}</p>
      )}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <TransactionButton
          transaction={() => {
            const contract = getContract({ client: FIRE_CONTRACT.client, chain: POLYGON, address: FIRE_CONTRACT.address, abi: ERC20_ABI as any });
            setTxBusy(true); setError(null);
            if (useFallbackApprove) {
              return prepareContractCall({ contract, method: 'approve', params: [MARKETPLACE_ADDRESS, BigInt('100000000000')] });
            }
            return prepareContractCall({ contract, method: 'approveMax', params: [MARKETPLACE_ADDRESS] });
          }}
          onTransactionSent={() => toast.loading("...جاري التوثيق", { id: "approve-fire", style: toastStyle, position: "bottom-center" })}
          onTransactionConfirmed={async () => {
            toast.success("تم التوثيق بنجاح", { id: "approve-fire", style: toastStyle, position: "bottom-center" });
            setNeedsApproval(false); setTxBusy(false); setUseFallbackApprove(false);
          }}
          onError={(e) => {
            setTxBusy(false);
            const msg = (e as any)?.shortMessage || (e as any)?.message || 'فشل التوثيق';
            toast.error("فشل التوثيق", { id: "approve-fire", style: toastStyle, position: "bottom-center" });
            setError(msg);
          }}
          className="w-full sm:w-auto px-6 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-sm shadow-lg transition disabled:opacity-50"
        >{useFallbackApprove ? 'توثيق (approve)' : 'توثيق المتجر'}</TransactionButton>
        <button
          onClick={() => { setChecking(true); setNeedsApproval(false); setError(null); setAllowanceValue(null); setRecheckKey(k => k + 1); }}
          className="w-full sm:w-auto px-6 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-semibold border border-white/15"
          disabled={txBusy}
        >إعادة الفحص</button>
        {!useFallbackApprove && error && (
          <button
            onClick={() => setUseFallbackApprove(true)}
            className="w-full sm:w-auto px-6 py-2 rounded-lg bg-orange-600/30 hover:bg-orange-600/50 text-orange-200 text-sm font-semibold border border-orange-400/30"
            disabled={txBusy}
          >استخدام approve العادية</button>
        )}
      </div>
    </div>
  );
}
