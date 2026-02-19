"use client";

import { useEffect, useState } from "react";
import { useActiveWallet } from "thirdweb/react";
import { getOwnedNFTs } from "thirdweb/extensions/erc1155";
import {
  CARD_CONTRACT_ADDRESS,
  FIRE_CONTRACT_ADDRESS,
  PACK_ATTEMPTS,
  PACK_ATTEMPTS_ADDRESS,
  PACK_IDS,
  BSC_TESTNET,
} from "../const/addresses";
import { defineChain, getContract, readContract, prepareContractCall } from "thirdweb";
import { safeSendTransaction } from "../util/safeSend";
import Image from "next/image";
import { client } from "../client";
import { motion, AnimatePresence } from "framer-motion";
import { useActiveAccount } from "thirdweb/react";
import FireBox from "../components/FireBox";
import ApproveForStore from "../components/ApproveForStore";
function RewardFlameIcon() {
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full">
      <defs>
        <radialGradient id="rewardFlameGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff6e6" />
          <stop offset="40%" stopColor="#ffb347" />
          <stop offset="75%" stopColor="#ff6a00" />
          <stop offset="100%" stopColor="#d23600" />
        </radialGradient>
        <linearGradient id="rewardFlameCore" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffe7c7" />
          <stop offset="55%" stopColor="#ff9d2f" />
          <stop offset="100%" stopColor="#ff4d00" />
        </linearGradient>
      </defs>
      <path d="M34 4c2 6 0 9 4 13s6 5 8 10c5 11-1 25-14 25S15 49 16 37c1-12 11-15 9-25 3 2 5 6 5 10 1-5 2-9 4-13Z" fill="url(#rewardFlameGlow)" className="animate-[pulse_2.2s_ease-in-out_infinite]" opacity={0.9} />
      <path d="M33 14c1 4-1 6 2 9 2 2 3 3 4 6 2 6-2 13-9 13s-10-7-8-13c1-6 6-7 5-13 2 1 4 4 4 6 0-3 1-5 2-8Z" fill="url(#rewardFlameCore)" className="animate-[pulse_1.4s_ease-in-out_infinite]" />
      <circle cx="18" cy="18" r="2" fill="#ffa94d" className="animate-[ping_2.5s_linear_infinite]" />
      <circle cx="46" cy="22" r="1.8" fill="#ffcf7a" className="animate-[ping_3s_linear_infinite]" />
      <circle cx="30" cy="6" r="1.6" fill="#ffd9a3" className="animate-[ping_2.8s_linear_infinite]" />
    </svg>
  );
}
import DirectListingButton from "../components/SaleInfo/DirectListingButton";
import ApprovalButton from "../components/SaleInfo/ApproveButton";
import toast from "react-hot-toast";
import toastStyle from "../util/toastConfig";

type NFT = {
  metadata: {
    image: string;
    name: string;
    description: string;
    attributes: {
      trait_type: string;
      value: string | number;
    }[];
  };
  quantityOwned: string;
  supply: string;
};

export default function MyCardsPage() {
  const [nfts, setNfts] = useState<any[]>([]);
  const [packs, setPacks] = useState<any[]>([]);
  const [attemptsMap, setAttemptsMap] = useState<Record<number, bigint>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNft, setSelectedNft] = useState<NFT | null>(null);
  const [activeTab, setActiveTab] = useState("NFTs");
  const [refreshing, setRefreshing] = useState(false);
  const [price, setPrice] = useState("0");
  const [openingPack, setOpeningPack] = useState(false);
  const [rewards, setRewards] = useState<any[] | null>(null);
  const [showRewards, setShowRewards] = useState(false);

  const walletInfo = useActiveWallet();
  const chain = defineChain(walletInfo?.getChain()?.id ?? BSC_TESTNET.id);
  const walletAddress = walletInfo?.getAccount()?.address ?? "0x";
  const account = useActiveAccount();

  const cardsContract = getContract({
    address: CARD_CONTRACT_ADDRESS,
    chain,
    client,
  });

  // New PackAttempts contract reference
  const packAttempts = PACK_ATTEMPTS;

  // Minimal ABI for attempts and open
  const PACK_ABI = [
    { type: "function", name: "attempts", stateMutability: "view", inputs: [ { name: "packId", type: "uint256" }, { name: "user", type: "address" } ], outputs: [ { name: "", type: "uint256" } ] },
    { type: "function", name: "open", stateMutability: "nonpayable", inputs: [ { name: "packId", type: "uint256" } ], outputs: [] },
  ] as const;

  useEffect(() => {
    if (walletAddress !== "0x") {
      refreshAll();
    }
  }, [walletAddress]);

  const refreshAll = async () => {
    if (!walletAddress) return;
    try {
      setRefreshing(true);
      const fetchedNFTs = await getOwnedNFTs({
          contract: cardsContract,
            start: 0,
            count: 50,
            address: walletAddress,
          });
      // Load attempts for configured pack IDs
      const attEntries: [number, bigint][] = await Promise.all(
        PACK_IDS.map(async (id) => {
          try {
            const value = await readContract({
              contract: getContract({ client, chain, address: PACK_ATTEMPTS_ADDRESS, abi: PACK_ABI as any }),
              method: "attempts",
              params: [BigInt(id), walletAddress],
            }) as unknown as bigint;
            return [id, value];
          } catch {
            return [id, 0n];
          }
        })
      );
      const next: Record<number, bigint> = {};
      for (const [id, val] of attEntries) next[id] = val;
      setAttemptsMap(next);
      setNfts(fetchedNFTs);
      toast.success("تم التحديث", { style: toastStyle, position: "bottom-center" });
    } catch (e) {
      toast.error("فشل التحديث", { style: toastStyle, position: "bottom-center" });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const handleCardClick = (nft: NFT) => setSelectedNft(nft);
  const handleClose = () => setSelectedNft(null);

  const openNewPack = async (packId: number) => {
    if (openingPack) return;
    try {
      if (!account) {
        toast.error("لم يتم العثور على الحساب", { style: toastStyle, position: "bottom-center" });
        return;
      }
      setOpeningPack(true);
      toast.loading("...فتح الصندوق", { id: "open-pack", style: toastStyle, position: "bottom-center" });
      const currentAttempts = attemptsMap[packId] || 0n;
      if (currentAttempts === 0n) {
        toast.error("لا توجد محاولات متاحة", { id: 'open-pack', style: toastStyle, position: 'bottom-center' });
        setOpeningPack(false);
        return;
      }

  let gasOverride: bigint | undefined;
  const GWEI = 1_000_000_000n;
  let maxPriorityFeePerGas: bigint = 26n * GWEI;  // 26 gwei tip (>= 25 min)
  let maxFeePerGas: bigint = 50n * GWEI;          // 50 gwei cap
      try {
        const txForEstimate = await prepareContractCall({
          contract: getContract({ client, chain, address: PACK_ATTEMPTS_ADDRESS, abi: PACK_ABI as any }),
          method: 'open',
          params: [BigInt(packId)],
        });
        if (account?.estimateGas) {
            const est = await account.estimateGas(txForEstimate);
            if (typeof est === 'bigint') {
              gasOverride = (est * 130n) / 100n; // +30% buffer
            }
        }
      } catch (e) {
        console.warn('[PackOpen] Gas estimation failed, using fallback', e);
      }
      if (!gasOverride) {
        gasOverride = 1_000_000n;
      }
      if (maxPriorityFeePerGas > maxFeePerGas) {
        maxFeePerGas = maxPriorityFeePerGas + 5n * GWEI;
      }
      try {
  const gweiNum = Number(maxFeePerGas / GWEI); 
        const gasNum = Number(gasOverride);
        const capPOL = (gweiNum * gasNum) / 1_000_000_000;
        toast.dismiss('open-pack');
  toast.loading(`إرسال المعاملة... (سقف أقصى ≈ ${capPOL.toFixed(3)} BNB، التكلفة الفعلية غالباً أقل)`, { id: 'open-pack', style: toastStyle, position: 'bottom-center' });
      } catch {}

      const transaction = await prepareContractCall({
        contract: getContract({ client, chain, address: PACK_ATTEMPTS_ADDRESS, abi: PACK_ABI as any }),
        method: 'open',
        params: [BigInt(packId)],
        gas: gasOverride,
        maxFeePerGas,
        maxPriorityFeePerGas,
      } as any);

      await safeSendTransaction({ transaction, account });
      setAttemptsMap((prev) => ({ ...prev, [packId]: (prev[packId] || 0n) - 1n }));
      try {
        await new Promise((res) => setTimeout(res, 1200));
        const latestNFTs = await getOwnedNFTs({ contract: cardsContract, start: 0, count: 100, address: walletAddress });
        setNfts(latestNFTs);
      } catch {}
      setRewards([
        { metadata: { name: 'مكافأة', image: '__flame_svg__', description: 'تم استلام مكافأة من الصندوق', attributes: [] }, id: 'reward', gained: '1' }
      ]);
      setShowRewards(true);
      toast.success("تم استلام المكافآت", { id: "open-pack", style: toastStyle, position: "bottom-center" });
    } catch (e: any) {
      console.error('[PackOpen] failed', e);
      const msg: string = e?.message || '';
      let friendly = 'فشل فتح الصندوق';
      if (/insufficient funds|out of gas|intrinsic gas/i.test(msg)) {
        friendly = 'فشل بسبب الغاز: تحقق من الرصيد أو ارفع حد الغاز';
      } else if (/revert/i.test(msg)) {
        const m = /revert(?:ed)?\s?[:]?\s?(.*)/i.exec(msg);
        if (m && m[1]) friendly = 'فشل: ' + m[1];
      }
      // Append raw snippet (trim) for debugging
      const snippet = msg.replace(/\n/g,' ').slice(0,140);
      toast.error(friendly + (snippet ? `\n[${snippet}]` : ''), { id: 'open-pack', style: toastStyle, position: 'bottom-center', duration: 7000 });
    } finally {
      setOpeningPack(false);
    }
  };

  function ipfsToHttp(url: string) {
    if (!url) return "";
    if (url.startsWith("ipfs://")) return url.replace("ipfs://", "https://ipfs.io/ipfs/");
    return url;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white px-4 py-8 flex flex-col items-center w-full">
      <h1 className="text-2xl font-bold mb-6 text-purple-400 font-medieval">بطاقاتي</h1>
      <ApproveForStore tokenAddress={FIRE_CONTRACT_ADDRESS} spenderAddress={PACK_ATTEMPTS_ADDRESS} tokenLabel="فاير" />
      <div className="flex space-x-4 mb-6 items-center">
        <button
          onClick={() => setActiveTab("NFTs")}
          className={`px-6 py-2 rounded-md transition-colors ${
            activeTab === "NFTs" ? "bg-purple-700 text-white" : "text-gray-300 hover:text-white bg-gray-800"
          }`}
        >
          ايتمات
        </button>
        <button
          onClick={() => setActiveTab("Packs")}
          className={`px-6 py-2 rounded-md transition-colors ${
            activeTab === "Packs" ? "bg-purple-700 text-white" : "text-gray-300 hover:text-white bg-gray-800"
          }`}
        >
          صناديق
        </button>
        <button
          onClick={refreshAll}
          disabled={refreshing}
          className="ml-4 px-4 py-2 text-sm rounded-md bg-gray-700 hover:bg-gray-600 disabled:opacity-50"
        >
          {refreshing ? "..." : "↻"}
        </button>
      </div>

      {activeTab === "NFTs" && (isLoading ? (
        <div>
          <motion.div
            className="flex justify-center items-center h-64"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeInOut", repeat: Infinity }}
          >
            <motion.div
              className="border-t-4 border-blue-500 rounded-full w-16 h-16"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            />
          </motion.div>
          <h1 className="text-3xl font-bold mb-8 text-center font-medieval">... جاري التحميل</h1>
        </div>
      ) : (
        <div className="w-full">
          <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 justify-items-center auto-rows-fr w-full">
            {nfts
              .sort((a, b) => Number(a.id ?? a.tokenId) - Number(b.id ?? b.tokenId))
              .map((nft, index) => (
                <motion.div
                  key={index}
                  className="bg-gray-800 rounded-lg shadow-md overflow-hidden flex flex-col w-full max-w-[140px] sm:max-w-[160px] h-[210px] sm:h-[220px] cursor-pointer border border-white/10 hover:border-purple-600 transition"
                  onClick={() => handleCardClick(nft)}
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <div className="relative w-full flex-1 bg-white/[.04]">
                    <Image
                      src={ipfsToHttp(nft.metadata.image)}
                      alt={nft.metadata.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 15vw"
                    />
                  </div>
                  <div className="p-3 flex flex-col items-center">
                    <div className="font-bold text-purple-400 text-xs truncate w-full text-center">
                      {nft.metadata.name || `#${nft.tokenId ?? nft.id}`}
                    </div>
                    <div className="text-xs text-white/60 mt-1">
                      العدد : {nft.quantityOwned?.toString() ?? nft.amount?.toString()}
                    </div>
                  </div>
                </motion.div>
              ))}
          </div>
        </div>
      ))}

  {activeTab === "Packs" && (
        <div className="w-full flex justify-center">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-7xl px-4">
    {PACK_IDS.map((pid, index) => (
              <motion.div
                key={index}
                className="bg-gray-800 rounded-lg flex flex-col items-center justify-start p-4 border border-white/10 hover:border-purple-600 transition"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <FireBox />
                <div className="mt-4 w-full text-center text-white">
      <h2 className="text-xl font-medieval mb-2">صندوق #{pid}</h2>
      <p className="text-sm mb-2 font-medieval">محاولاتك: { (attemptsMap[pid] || 0n).toString() }</p>
                  <button
        onClick={() => openNewPack(pid)}
        disabled={openingPack || (attemptsMap[pid] || 0n) === 0n}
                    className="w-full bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-bold py-2 px-4 rounded transition duration-200 font-medieval mt-2"
                  >
        {openingPack ? "..." : "فتح"}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {selectedNft && (
          <motion.div
            className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-gray-900/95 border border-white/10 rounded-lg shadow-2xl p-4 sm:p-6 w-full max-w-lg md:max-w-2xl relative flex flex-col items-center justify-start max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 50 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <button
                onClick={handleClose}
                className="sticky self-end top-0 -mt-2 -mr-2 mb-2 text-gray-400 hover:text-white font-bold text-xl z-10"
              >
                ✕
              </button>
              <div className="flex flex-col items-center justify-center space-y-6 w-full">
                <div className="relative mx-auto w-full h-56 sm:h-64 md:h-72 flex-shrink-0 flex justify-center items-center overflow-hidden rounded-lg">
                  <Image
                    src={ipfsToHttp(selectedNft.metadata.image)}
                    alt={selectedNft.metadata.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-grow text-white font-medieval w-full">
                  <h2 className="text-2xl sm:text-3xl font-bold mb-3 text-center text-purple-400">{selectedNft.metadata.name}</h2>
                  <div className="mb-6">
                    <h3 className="text-xl font-semibold mb-2 text-center text-white/80"> الخصائص : </h3>
                    <ul className="grid grid-cols-2 gap-2">
                      {selectedNft.metadata.attributes.map((attribute, index) => (
                        <li key={index} className="bg-gray-800 rounded-md p-2 text-center border border-white/10 text-xs">
                          <span className="font-bold">{attribute.trait_type}:</span> {attribute.value}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-lg text-center text-white/80">لديك : {selectedNft.quantityOwned.toString()} </p>
                  <p className="text-sm sm:text-base mb-4 text-center text-white/60 leading-relaxed">{selectedNft.metadata.description}</p>
                  <div className="bg-gray-800/80 border border-white/10 rounded-lg p-3 md:p-4 mb-4 w-full max-w-md mx-auto relative">
                    <h3 className="text-sm font-semibold mb-2 text-white"> بيع مقابل فاير </h3>
                    <label className="text-xs text-white/60 mb-1 block">سعر القطعة بفاير</label>
                    <input
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      type="number"
                      step="0.000001"
                      className="w-full mb-2 px-2 py-1.5 rounded-md bg-gray-900 border border-white/10 focus:outline-none focus:border-purple-600 text-xs"
                    />
                    <label className="text-xs text-white/60 mb-1 block">الكمية المراد بيعها</label>
                    <input
                      defaultValue={"1"}
                      id="sell-qty-input"
                      type="number"
                      min="1"
                      step="1"
                      className="w-full mb-2 px-2 py-1.5 rounded-md bg-gray-900 border border-white/10 focus:outline-none focus:border-purple-600 text-xs"
                      onChange={(e) => { (window as any)._sellQty = e.target.value; }}
                    />
                    <div className="flex gap-2 flex-col sm:flex-row text-xs">
                      <ApprovalButton />
                      <DirectListingButton
                        nft={selectedNft as any}
                        pricePerToken={price}
                        quantity={(window as any)._sellQty || "1"}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showRewards && rewards && (
          <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-gray-900/95 border border-white/10 rounded-xl shadow-2xl p-5 w-full max-w-2xl relative"
              initial={{ scale: 0.85, y: 40 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 40 }}
              transition={{ type: "spring", stiffness: 260, damping: 25 }}
            >
              <button
                onClick={() => setShowRewards(false)}
                className="absolute top-2 left-2 text-gray-400 hover:text-white text-xl"
                aria-label="اغلاق"
              >✕</button>
              <h2 className="text-2xl font-bold mb-4 text-center text-purple-400">المكافآت الجديدة</h2>
              <p className="text-center text-white/60 mb-6 text-sm">تم فتح الصندوق واستلام العناصر التالية في محفظتك:</p>
              <div className={`${rewards.length === 1 ? 'flex justify-center' : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4'} gap-4`}>
                {rewards.map((r: any, idx: number) => (
                  <div key={idx} className="bg-gray-800/70 rounded-lg p-3 border border-white/10 flex flex-col items-center text-center ${rewards.length === 1 ? 'w-40' : ''}">
                    <div className="relative w-full h-28 mb-3 overflow-hidden rounded-md bg-white/5">
                      {r.metadata?.image === "__flame_svg__" ? (
                        <div className="flex items-center justify-center w-full h-full p-2">
                          <RewardFlameIcon />
                        </div>
                      ) : r.metadata?.image ? (
                        <img
                          src={ipfsToHttp(r.metadata.image)}
                          alt={r.metadata.name}
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="text-xs font-bold text-purple-300 truncate w-full" title={r.metadata?.name}>{r.metadata?.name || `#${r.id}`}</div>
                    <div className="text-[11px] text-white/70 mt-1">+{r.gained}</div>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => setShowRewards(false)}
                  className="px-6 py-2 rounded-lg bg-purple-700 hover:bg-purple-800 text-sm font-semibold"
                >حسناً</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
