"use client";

import { useEffect, useState } from "react";
import { useActiveWallet } from "thirdweb/react";
import { getOwnedNFTs } from "thirdweb/extensions/erc1155";
import {
  CARD_CONTRACT_ADDRESS,
  PACK_CONTRACT_ADDRESS,
  POLYGON,
} from "../const/addresses";
import { defineChain, getContract, sendTransaction } from "thirdweb";
import Image from "next/image";
import { client } from "../client";
import { motion, AnimatePresence } from "framer-motion";
import { openPack } from "thirdweb/extensions/pack";
import { useActiveAccount } from "thirdweb/react";
import FireBox from "../components/FireBox";
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

export default function Profile() {
  const [nfts, setNfts] = useState<any[]>([]);
  const [packs, setPacks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNft, setSelectedNft] = useState<NFT | null>(null);
  const [activeTab, setActiveTab] = useState("NFTs");
  const [refreshing, setRefreshing] = useState(false);
  const [price, setPrice] = useState("0");
  const [openingPack, setOpeningPack] = useState(false);
  const [rewards, setRewards] = useState<any[] | null>(null); // array of gained NFTs with diff
  const [showRewards, setShowRewards] = useState(false);

  const walletInfo = useActiveWallet();
  const chain = defineChain(walletInfo?.getChain()?.id ?? POLYGON.id);
  const walletAddress = walletInfo?.getAccount()?.address ?? "0x";
  const account = useActiveAccount();

  const cardsContract = getContract({
    address: CARD_CONTRACT_ADDRESS,
    chain,
    client,
  });

  const packsContract = getContract({
    address: PACK_CONTRACT_ADDRESS,
    chain,
    client,
  });


  useEffect(() => {
    if (walletAddress !== "0x") {
      refreshAll();
    }
  }, [walletAddress]);

  const refreshAll = async () => {
    if (!walletAddress) return;
    try {
      setRefreshing(true);
      const [fetchedNFTs, fetchedPacks] = await Promise.all([
        getOwnedNFTs({
          contract: cardsContract,
          start: 0,
          count: 50,
          address: walletAddress,
        }),
        getOwnedNFTs({
          contract: packsContract,
          start: 0,
          count: 50,
          address: walletAddress,
        }),
      ]);
      setNfts(fetchedNFTs);
      setPacks(fetchedPacks);
      toast.success("تم التحديث", { style: toastStyle, position: "bottom-center" });
    } catch (e) {
      toast.error("فشل التحديث", { style: toastStyle, position: "bottom-center" });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const handleCardClick = (nft: NFT) => {
    setSelectedNft(nft);
  };

  const handleClose = () => {
    setSelectedNft(null);
  };

  const openNewPack = async (packId: number) => {
    if (openingPack) return;
    try {
      if (!account) {
        toast.error("لم يتم العثور على الحساب", { style: toastStyle, position: "bottom-center" });
        return;
      }
      setOpeningPack(true);
      toast.loading("...فتح الصندوق", { id: "open-pack", style: toastStyle, position: "bottom-center" });

      // Baseline quantities map
      const baseline: Record<string, bigint> = {};
      nfts.forEach((n: any) => {
        const id = (n.id ?? n.tokenId ?? "").toString();
        baseline[id] = BigInt(n.quantityOwned?.toString?.() || n.amount?.toString?.() || "0");
      });

      const transaction = await openPack({
        contract: packsContract,
        packId: BigInt(packId),
        amountToOpen: BigInt(1),
        overrides: {},
      });

      await sendTransaction({
        transaction,
        account: account,
      });

      // Small delay to allow subgraph / RPC indexing; then refetch
      await new Promise((res) => setTimeout(res, 1500));
      const latestNFTs = await getOwnedNFTs({
        contract: cardsContract,
        start: 0,
        count: 100,
        address: walletAddress,
      });
      setNfts(latestNFTs);

      // Compute NFT gains
      const gained = latestNFTs
        .map((n: any) => {
          const id = (n.id ?? n.tokenId ?? "").toString();
          const prev = baseline[id] || BigInt(0);
          const now = BigInt(n.quantityOwned?.toString?.() || n.amount?.toString?.() || "0");
          if (now > prev) return { ...n, gained: (now - prev).toString() };
          return null;
        })
        .filter(Boolean) as any[];

      gained.push({
        metadata: {
          name: "فاير",
          image: "/assets/FireBox.png",
          description: "مكافأة فتح الصندوق",
          attributes: [],
        },
        id: "fire",
        gained: "1",
      });

      setRewards(gained);
      setShowRewards(true);
      toast.success("تم استلام المكافآت", { id: "open-pack", style: toastStyle, position: "bottom-center" });
      // Refresh packs after opening
      const latestPacks = await getOwnedNFTs({
        contract: packsContract,
        start: 0,
        count: 50,
        address: walletAddress,
      });
      setPacks(latestPacks);
    } catch (e) {
      console.error(e);
      toast.error("فشل فتح الصندوق", { id: "open-pack", style: toastStyle, position: "bottom-center" });
    } finally {
      setOpeningPack(false);
    }
  };

  function ipfsToHttp(url: string) {
    if (!url) return "";
    if (url.startsWith("ipfs://")) {
      return url.replace("ipfs://", "https://ipfs.io/ipfs/");
    }
    return url;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white px-4 py-8 flex flex-col items-center w-full">
      <div className="flex space-x-4 mb-6 items-center">
        <button
          onClick={() => setActiveTab("NFTs")}
          className={`px-6 py-2 rounded-md transition-colors ${
            activeTab === "NFTs"
              ? "bg-purple-700 text-white"
              : "text-gray-300 hover:text-white bg-gray-800"
          }`}
        >
          ايتمات
        </button>
        <button
          onClick={() => setActiveTab("Packs")}
          className={`px-6 py-2 rounded-md transition-colors ${
            activeTab === "Packs"
              ? "bg-purple-700 text-white"
              : "text-gray-300 hover:text-white bg-gray-800"
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

      {activeTab === "NFTs" &&
        (isLoading ? (
          <div>
            <motion.div
              className="flex justify-center items-center h-64"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 0.5,
                ease: "easeInOut",
                repeat: Infinity,
              }}
            >
              <motion.div
                className="border-t-4 border-blue-500 rounded-full w-16 h-16"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              />
            </motion.div>
            <h1 className="text-3xl font-bold mb-8 text-center font-medieval">
             ... جاري التحميل
            </h1>
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
            {packs.map((pack, index) => (
              <motion.div
                key={index}
                className="bg-gray-800 rounded-lg flex flex-col items-center justify-start p-4 border border-white/10 hover:border-purple-600 transition"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <FireBox />

                <div className="mt-4 w-full text-center text-white">
                  <h2 className="text-xl font-medieval mb-2">
                    {pack.metadata.name}
                  </h2>
                  <p className="text-sm mb-2 font-medieval">
                    {pack.metadata.description}
                  </p>
                  <p className="text-sm mb-2 font-medieval">
                    لديك : {pack.quantityOwned.toString()} صندوق
                  </p>
                  <button
                    onClick={() => openNewPack(pack.id)}
                    disabled={openingPack}
                    className="w-full bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-bold py-2 px-4 rounded transition duration-200 font-medieval mt-2"
                  >
                    {openingPack ? "..." : "فتح الصندوق"}
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
                  <h2 className="text-2xl sm:text-3xl font-bold mb-3 text-center text-purple-400">
                    {selectedNft.metadata.name}
                  </h2>
                  <div className="mb-6">
                    <h3 className="text-xl font-semibold mb-2 text-center text-white/80"> الخصائص : </h3>
                    <ul className="grid grid-cols-2 gap-2">
                      {selectedNft.metadata.attributes.map(
                        (attribute, index) => (
                          <li
                            key={index}
                            className="bg-gray-800 rounded-md p-2 text-center border border-white/10 text-xs"
                          >
                            <span className="font-bold">
                              {attribute.trait_type}:
                            </span>{" "}
                            {attribute.value}
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                  <p className="text-lg text-center text-white/80">
                    لديك : {selectedNft.quantityOwned.toString()}{" "}
                  </p>
                  <p className="text-sm sm:text-base mb-4 text-center text-white/60 leading-relaxed">
                    {selectedNft.metadata.description}
                  </p>
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
                      onChange={(e) => {
                        (window as any)._sellQty = e.target.value;
                      }}
                    />
                    <div className="flex gap-2 flex-col sm:flex-row text-xs">
                      <ApprovalButton />
                      <DirectListingButton
                        nft={selectedNft as any}
                        pricePerToken={price}
                        quantity={(window as any)._sellQty || "1"}
                      />
                    </div>
                    <p className="text-[10px] text-white/40 mt-2"></p>
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
                      {r.metadata?.image && (
                        <img
                          src={ipfsToHttp(r.metadata.image)}
                          alt={r.metadata.name}
                          className="w-full h-full object-cover"
                        />
                      )}
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
