"use client";
import { useEffect, useState } from "react";
import { useActiveAccount, TransactionButton } from "thirdweb/react";
import { getContract, readContract, prepareContractCall } from "thirdweb";
import { client } from "../client";
import { BSC_TESTNET } from "../const/addresses";
import toast from "react-hot-toast";

const ERC20_ABI = [
  { type: "function", name: "allowance", stateMutability: "view", inputs: [ { name: "owner", type: "address" }, { name: "spender", type: "address" } ], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [ { name: "spender", type: "address" }, { name: "amount", type: "uint256" } ], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "approveMax", stateMutability: "nonpayable", inputs: [ { name: "spender", type: "address" } ], outputs: [{ name: "", type: "bool" }] }
];
const MAX_APPROVAL = BigInt("10000000000000000000000000000000000000");

export default function ApproveForStore(props: { tokenAddress: string; spenderAddress: string; tokenLabel?: string }) {
  const { tokenAddress, spenderAddress, tokenLabel } = props;
  const account = useActiveAccount();
  const [checking, setChecking] = useState(true);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [allowanceValue, setAllowanceValue] = useState<bigint | null>(null);

  async function check() {
    if (!account?.address) { setChecking(false); setNeedsApproval(false); setAllowanceValue(null); return; }
    try {
      setChecking(true);
      const contract = getContract({ client, chain: BSC_TESTNET, address: tokenAddress, abi: ERC20_ABI as any });
      const allowance: bigint = await readContract({ contract, method: "allowance", params: [account?.address, spenderAddress] }) as unknown as bigint;
      setAllowanceValue(allowance);
      setNeedsApproval(allowance === 0n);
    } catch (e) {
      console.warn("ApproveForStore: allowance check failed", e);
      setAllowanceValue(null);
      setNeedsApproval(true);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => { check(); }, [account?.address, tokenAddress, spenderAddress]);

  if (!account?.address) return null;
  if (checking) return null;
  if (!needsApproval) return null;

  return (
    <div className="max-w-4xl mx-auto mb-4 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="text-sm text-yellow-200">
          يجب توثيق {tokenLabel || 'التوكن'} للسماح للعقد باستخدام الرصيد. هذه خطوة لمرة واحدة لكل محفظة.
        </div>
        <div className="flex gap-2">
          <TransactionButton
            transaction={() => {
              const contract = getContract({ client, chain: BSC_TESTNET, address: tokenAddress, abi: ERC20_ABI as any });
              return prepareContractCall({ contract, method: 'approve', params: [spenderAddress, MAX_APPROVAL] });
            }}
            onTransactionSent={() => toast.loading("...جاري التوثيق (approve)", { id: `approve-${tokenAddress}` })}
            onError={(e) => { console.warn('approve failed', e); toast.error("فشل التوثيق (approve)", { id: `approve-${tokenAddress}` }); }}
            onTransactionConfirmed={async () => { toast.success("تم التوثيق", { id: `approve-${tokenAddress}` }); await check(); }}
            className="px-3 py-2 rounded bg-yellow-400 text-black font-semibold text-sm"
          >توثيق (صريح)</TransactionButton>

          <button onClick={() => { setNeedsApproval(false); }} className="px-3 py-2 rounded bg-gray-700 text-sm">تجاهل</button>
        </div>
      </div>
      {allowanceValue !== null && <div className="mt-2 text-[11px] text-white/60">السماح الحالي: {allowanceValue.toString()}</div>}
    </div>
  );
}
