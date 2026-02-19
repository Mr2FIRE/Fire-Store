"use client";
import type { NFT as NFTType } from "thirdweb";
import React from "react";
import NFT, { LoadingNFTComponent } from "./NFT";

type Props = {
  nftData: {
    tokenId: bigint | string;
    nft?: NFTType;
    priceDisplay?: string;
    listedQuantity?: string;
    isAuction?: boolean;
  }[];
  overrideOnclickBehavior?: (nft: NFTType) => void;
  emptyText?: string;
};

export default function NFTGrid({
  nftData,
  overrideOnclickBehavior,
  emptyText = "No NFTs found for this collection.",
}: Props) {
  if (nftData && nftData.length > 0) {
    return (
  <div className="grid justify-start grid-cols-3 gap-1.5 sm:gap-2 md:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {nftData.map((nft) => (
          <NFT
            key={nft.tokenId}
            {...nft}
            overrideOnclickBehavior={overrideOnclickBehavior}
            priceDisplay={nft.priceDisplay} 
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center h-[250px]">
      <p className="max-w-lg text-lg font-semibold text-center text-white/60">
        {emptyText}
      </p>
    </div>
  );
}

export function NFTGridLoading() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {[...Array(12)].map((_, index) => (
        <LoadingNFTComponent key={index} />
      ))}
    </div>
  );
}