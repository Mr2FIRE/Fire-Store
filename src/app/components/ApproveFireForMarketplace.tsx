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
  { "type": "function", "name": "allowance", "stateMutability": "view", "inputs": [
      { "name": "owner", "type": "address" },
      { "name": "spender", "type": "address" }
    ], "outputs": [{ "name": "", "type": "uint256" }] },
  { "type": "function", "name": "approveMax", "stateMutability": "nonpayable", "inputs": [
      { "name": "spender", "type": "address" }
    ], "outputs": [{ "name": "", "type": "bool" }] }
];

const LOCAL_STORAGE_KEY = "fs_fire_allowance_marketplace_v1";

export default function ApproveFireForMarketplace() {
  const account = useActiveAccount();
  const [needsApproval, setNeedsApproval] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let ignore = false;
    async function check() {
      if (!account?.address) { setChecking(false); return; }
      try {
        // If we already stored a flag, skip network call for speed
        if (localStorage.getItem(LOCAL_STORAGE_KEY) === "1") {
          setNeedsApproval(false);
          setChecking(false);
          return;
        }
        const contract = getContract({ client: FIRE_CONTRACT.client, chain: POLYGON, address: FIRE_CONTRACT.address, abi: ERC20_ABI as any });
        const allowance: bigint = await readContract({ contract, method: "allowance", params: [account.address, MARKETPLACE_ADDRESS] }) as unknown as bigint;
        if (!ignore) {
          if (allowance === 0n) {
            setNeedsApproval(true);
          } else {
            localStorage.setItem(LOCAL_STORAGE_KEY, "1");
            setNeedsApproval(false);
          }
        }
      } catch (e) {
        console.warn("Allowance check failed", e);
        if (!ignore) setNeedsApproval(true); // Fall back to prompting
      } finally {
        if (!ignore) setChecking(false);
      }
    }
    check();
    return () => { ignore = true; };
  }, [account?.address]);

  if (!account?.address) return null;
  if (checking) return null;
  if (!needsApproval) return null;

  return (
    <div className="mb-6 p-4 border border-yellow-500/40 bg-yellow-500/10 rounded-xl max-w-2xl mx-auto text-center animate-fade-in">
      <p className="mb-4 text-sm sm:text-base font-semibold text-yellow-200">
        يجب توثيق المتجر للسماح له باستخدام رصيد FIRE (مرة واحدة فقط)
      </p>
      <TransactionButton
        transaction={() => {
          const contract = getContract({ client: FIRE_CONTRACT.client, chain: POLYGON, address: FIRE_CONTRACT.address, abi: ERC20_ABI as any });
          return prepareContractCall({ contract, method: "approveMax", params: [MARKETPLACE_ADDRESS] });
        }}
        onTransactionSent={() => toast.loading("...جاري التوثيق", { id: "approve-fire", style: toastStyle, position: "bottom-center" })}
        onTransactionConfirmed={() => {
          localStorage.setItem(LOCAL_STORAGE_KEY, "1");
          toast.success("تم التوثيق بنجاح", { id: "approve-fire", style: toastStyle, position: "bottom-center" });
          setNeedsApproval(false);
        }}
        onError={() => toast.error("فشل التوثيق", { id: "approve-fire", style: toastStyle, position: "bottom-center" })}
        className="w-full sm:w-auto px-6 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-sm shadow-lg transition disabled:opacity-50"
      >توثيق المتجر</TransactionButton>
    </div>
  );
}
