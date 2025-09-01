"use client";

import React, { useEffect, useState } from "react";
import { NFT as ERC1155NFT } from "thirdweb";
import { NFT_COLLECTION } from "../const/addresses";
// Removed direct/auction listing object props – we now pass only primitive display fields from server component
import { MediaRenderer } from "thirdweb/react";
import { getNFT } from "thirdweb/extensions/erc1155";
import { client } from "../client";
import Skeleton from "../components/Skeleton";
import { useRouter } from "next/navigation";

type Props = {
  tokenId: bigint | string;
  nft?: ERC1155NFT;
  // Pre-computed display data (serialized)
  priceDisplay?: string;
  listedQuantity?: string;
  isAuction?: boolean;
  overrideOnclickBehavior?: (nft: ERC1155NFT) => void;
};

export default function NFTComponent({
  tokenId,
  priceDisplay,
  listedQuantity,
  isAuction,
  overrideOnclickBehavior,
  ...props
}: Props) {
  const router = useRouter();
  const [nft, setNFT] = useState(props.nft);
  const tokenIdBigInt: bigint =
    typeof tokenId === "string" ? BigInt(tokenId) : tokenId;

  useEffect(() => {
    if (!nft || nft.id !== tokenIdBigInt) {
      getNFT({
        contract: NFT_COLLECTION,
        tokenId: tokenIdBigInt,
      })
        .then((nft) => {
          setNFT(nft);
        })
        .catch(() => {
          // swallow errors for now
        });
    }
  }, [tokenIdBigInt, nft?.id]);

  if (!nft) {
    return (
  <div className="cursor-pointer bg-gray-800 rounded-lg shadow-md overflow-hidden flex flex-col w-full h-[205px] sm:h-[215px] border border-white/10 hover:border-purple-600 transition">
        <div className="relative w-full h-[155px] sm:h-[165px] bg-white/[.04]">
          <LoadingNFTComponent />
        </div>
        <div className="px-2 pt-1 pb-1 flex flex-col items-center justify-center gap-1 min-h-[36px]">
          {priceDisplay && (
            <div className="font-bold text-purple-400 text-[10px] text-center w-full leading-tight line-clamp-2">
              {priceDisplay}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="cursor-pointer bg-gray-800 rounded-lg shadow-md overflow-hidden flex flex-col w-full h-[205px] sm:h-[215px] border border-white/10 hover:border-purple-600 transition"
      onClick={
        overrideOnclickBehavior
          ? () => overrideOnclickBehavior(nft!)
          : () =>
              router.push(
                `/token/${NFT_COLLECTION.address}/${tokenIdBigInt.toString()}`
              )
      }
    >
      <div className="relative w-full h-[155px] sm:h-[165px] bg-white/[.04]">
        {nft.metadata.image && (
          <MediaRenderer
            src={nft.metadata.image}
            client={client}
    className="object-cover object-center w-full h-full"
          />
        )}
      </div>
      <div className="px-2 pt-1 pb-1 flex flex-col items-center justify-center gap-1 min-h-[36px]">
        {priceDisplay && (
          <div className="font-bold text-purple-400 text-[10px] text-center w-full leading-tight line-clamp-2">
            {priceDisplay}
          </div>
        )}
      </div>
    </div>
  );
}

export function LoadingNFTComponent() {
  return <Skeleton width="100%" height="100%" />;
}