"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getNFT } from "thirdweb/extensions/erc1155";
import { getAllValidListings, getAllValidAuctions, buyFromListing } from "thirdweb/extensions/marketplace";
import { MARKETPLACE, NFT_COLLECTION, FIRE_CONTRACT_ADDRESS } from "@/app/const/addresses";
import { MediaRenderer } from "thirdweb/react";
import { client } from "@/app/client";
import { TransactionButton, useActiveAccount } from "thirdweb/react";
import toast from "react-hot-toast";
import toastStyle from "@/app/util/toastConfig";
import Link from "next/link";

export default function TokenPage() {
  const params = useParams();
  const tokenIdParam = params?.tokenId as string;
  const tokenId = tokenIdParam ? BigInt(tokenIdParam) : undefined;
  const account = useActiveAccount();

  const [nft, setNft] = useState<any>(null);
  const [listing, setListing] = useState<any>(null);
  const [auction, setAuction] = useState<any>(null);
  const [quantity, setQuantity] = useState("1");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokenId) return;
    (async () => {
      try {
        const [nftData, listings, auctions] = await Promise.all([
          getNFT({ contract: NFT_COLLECTION, tokenId }),
          getAllValidListings({ contract: MARKETPLACE }),
          getAllValidAuctions({ contract: MARKETPLACE }),
        ]);
        setNft(nftData);
        setListing(listings.find(l => l.tokenId === tokenId));
        setAuction(auctions.find(a => a.tokenId === tokenId));
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [tokenId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white px-4 py-6 sm:py-10">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4 text-sm text-white/60 flex items-center gap-2">
          <Link href="/" className="hover:underline">الرئيسية</Link>
          <span>/</span>
          <span>السلعة</span>
        </div>
        {loading && (
          <div className="h-64 flex items-center justify-center text-white/60">...تحميل</div>
        )}
        {!loading && nft && (
          <div className="flex flex-col md:flex-row gap-6">
            <div className="md:w-1/2 w-full bg-white/5 rounded-xl overflow-hidden border border-white/10">
              {nft?.metadata?.image && (
                <MediaRenderer
                  client={client}
                  src={nft.metadata.image}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="flex-1 flex flex-col">
              <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-purple-400">
                {nft.metadata.name || `#${tokenId?.toString()}`}
              </h1>
              <p className="text-sm text-white/70 mb-4 leading-relaxed">
                {nft.metadata.description}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
                <div className="bg-gray-800/70 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-white/50 mb-1">الايدي</p>
                  <p className="text-sm font-semibold">{tokenId?.toString()}</p>
                </div>
                <div className="bg-gray-800/70 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-white/50 mb-1">المعروض</p>
                  <p className="text-sm font-semibold">{listing ? listing.quantity?.toString() : auction ? 'مزاد' : 'غير معروض'}</p>
                </div>
                <div className="bg-gray-800/70 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-white/50 mb-1">لديك</p>
                  <p className="text-sm font-semibold">{nft.quantityOwned?.toString?.() || "-"}</p>
                </div>
              </div>
              {listing && (
                <div className="mb-6 bg-gray-800/70 border border-white/10 rounded-lg p-4">
                  <h2 className="text-lg font-semibold mb-2">بيع مباشر</h2>
                  <p className="text-sm text-white/60 mb-3">السعر لكل قطعة</p>
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-2xl font-bold text-white">
                      {listing.currencyValuePerToken.displayValue}
                    </span>
                    <span className="text-xs font-semibold text-white/60">فاير</span>
                  </div>
                  <label className="block text-xs text-white/60 mb-1">الكمية</label>
                  <input
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    type="number"
                    min={1}
                    max={Number(listing.quantity)}
                    className="w-full mb-3 px-2 py-1.5 rounded-md bg-gray-900 border border-white/10 focus:outline-none focus:border-purple-600 text-sm"
                  />
                  <TransactionButton
                    transaction={() => {
                      return buyFromListing({
                        contract: MARKETPLACE,
                        listingId: listing.id,
                        quantity: BigInt(quantity || "1"),
                        recipient: account?.address!,
                      });
                    }}
                    disabled={!account}
                    onTransactionSent={() =>
                      toast.loading("...جاري الشراء", { id: "buy", style: toastStyle, position: "bottom-center" })
                    }
                    onError={() =>
                      toast.error("فشل الشراء", { id: "buy", style: toastStyle, position: "bottom-center" })
                    }
                    onTransactionConfirmed={() =>
                      toast.success("تم الشراء", { id: "buy", style: toastStyle, position: "bottom-center" })
                    }
                  >
                    شراء الآن
                  </TransactionButton>
                </div>
              )}
              {auction && !listing && (
                <div className="mb-6 bg-gray-800/70 border border-white/10 rounded-lg p-4">
                  <h2 className="text-lg font-semibold mb-2">مزاد</h2>
                  <p className="text-sm text-white/60 mb-1">أقل عرض</p>
                  <p className="text-xl font-bold mb-4">
                    {auction.minimumBidCurrencyValue.displayValue} فاير
                  </p>
                  <p className="text-xs text-white/50">(الشراء المباشر غير مفعل لهذا المزاد)</p>
                </div>
              )}
            </div>
          </div>
        )}
        {!loading && !nft && (
          <div className="text-center text-white/60 py-20">لم يتم العثور على NFT</div>
        )}
      </div>
    </div>
  );
}