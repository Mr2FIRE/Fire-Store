"use client";

import React, { useEffect, useState, useCallback } from "react";
import NFTGrid, { NFTGridLoading } from "./NFTGrid";
import { getAllValidListings, getAllValidAuctions } from "thirdweb/extensions/marketplace";
import { formatEther } from "viem";
import { MARKETPLACE, NFT_COLLECTION } from "../const/addresses";
import toast from "react-hot-toast";
import toastStyle from "../util/toastConfig";

type MarketItem = {
  tokenId: string;
  priceDisplay?: string;
  listedQuantity?: string;
  isAuction?: boolean;
  type: "direct" | "auction";
  category: CategoryKey;
};

type CategoryKey = "all" | "tiktok" | "pubg" | "asia";

function categorize(tokenIdStr: string): CategoryKey {
  const id = Number(tokenIdStr);
  if (!Number.isFinite(id)) return "all";
  if (id >= 0 && id <= 6) return "tiktok";
  if (id >= 7 && id <= 13) return "pubg";
  if (id >= 14 && id <= 18) return "asia";
  return "all"; // treat out-of-range as general
}

export default function MarketTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<CategoryKey>("all");
  const [items, setItems] = useState<MarketItem[]>([]);

  const fetchMarket = useCallback(async () => {
    try {
      setRefreshing(true);
      const [listings, auctions] = await Promise.all([
        getAllValidListings({ contract: MARKETPLACE }),
        getAllValidAuctions({ contract: MARKETPLACE }),
      ]);

      const tokenIds = Array.from(
        new Set([
          ...listings
            .filter((l) => l.assetContractAddress === NFT_COLLECTION.address)
            .map((l) => l.tokenId),
          ...auctions
            .filter((a) => a.assetContractAddress === NFT_COLLECTION.address)
            .map((a) => a.tokenId),
        ]),
      );

      const data: MarketItem[] = tokenIds.map((tokenId) => {
        const direct = listings.find((l) => l.tokenId === tokenId);
        const auction = auctions.find((a) => a.tokenId === tokenId);
        // Prefer provided displayValue (handles decimals) fallback to manual formatEther
        const priceDisplay = direct
          ? `${direct.currencyValuePerToken.displayValue || formatEther(direct.currencyValuePerToken.value)} فاير`
          : auction
            ? `${auction.minimumBidCurrencyValue.displayValue || formatEther(auction.minimumBidCurrencyValue.value)} فاير`
            : undefined;
        const tokenIdStr = tokenId.toString();
        return {
          tokenId: tokenIdStr,
          priceDisplay,
          listedQuantity: direct?.quantity?.toString(),
          isAuction: !direct && !!auction,
          type: direct ? "direct" : "auction",
          category: categorize(tokenIdStr),
        };
      });
      // Debug log
      console.log("[MarketTab] listings fetched:", data);
      setItems(data);
      if (!loading) {
        toast.success("تم تحديث السوق", { style: toastStyle, position: "bottom-center" });
      }
    } catch (e) {
      toast.error("فشل تحميل السوق", { style: toastStyle, position: "bottom-center" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loading]);

  useEffect(() => {
    fetchMarket();
  }, [fetchMarket]);

  const filtered = items.filter((i) => (filter === "all" ? true : i.category === filter));

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <h2 className="text-3xl sm:text-4xl font-bold text-center sm:text-left flex-1 tracking-wide">السوق</h2>
        <div className="flex items-center gap-3 justify-center sm:justify-end">
          <div className="bg-gray-800 rounded-lg p-1.5 flex text-xs sm:text-sm shadow-inner">
            {[
              { key: "all", label: "الكل" },
              { key: "tiktok", label: "تيكتوك" },
              { key: "pubg", label: "ببجي" },
              { key: "asia", label: "اسيا" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key as CategoryKey)}
                className={`px-3 sm:px-4 py-1.5 rounded-md text-[11px] sm:text-sm font-medium transition-colors border ${
                  filter === t.key
                    ? "bg-purple-700/80 text-white border-purple-500"
                    : "text-gray-300 hover:text-white hover:border-purple-400 border-transparent"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => fetchMarket()}
            disabled={refreshing}
            className="text-xs sm:text-sm bg-gray-700/80 hover:bg-gray-600 px-4 py-2 rounded-md disabled:opacity-50 border border-white/10"
            aria-label="تحديث السوق"
          >{refreshing ? "..." : "↻"}</button>
        </div>
      </div>
      <div className="flex items-center justify-between mb-4 text-sm sm:text-base text-white/60">
        <span className="font-medium">عدد العناصر: <span className="text-white/80">{filtered.length}</span></span>
        {filter !== "all" && (
          <span className="text-white/50 font-medium">
            التصفية: {filter === "tiktok" ? "تيكتوك" : filter === "pubg" ? "ببجي" : filter === "asia" ? "اسيا" : ""}
          </span>
        )}
      </div>
      <div className="my-6 sm:my-8 min-h-[260px]">
        {loading ? (
          <NFTGridLoading />
        ) : (
          <NFTGrid nftData={filtered} emptyText="لا توجد عروض حالياً" />
        )}
      </div>
    </div>
  );
}
