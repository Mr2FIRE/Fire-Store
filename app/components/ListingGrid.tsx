export const dynamic = "force-dynamic";
export const revalidate = 0;

import {
  getAllValidAuctions,
  getAllValidListings,
} from "thirdweb/extensions/marketplace";
import { NFT as NFTType, ThirdwebContract } from "thirdweb";
import React, { Suspense } from "react";
import NFTGrid, { NFTGridLoading } from "./NFTGrid";
import { formatEther } from "viem";

type Props = {
  marketplace: ThirdwebContract;
  collection: ThirdwebContract;
  overrideOnclickBehavior?: (nft: NFTType) => void;
  emptyText: string;
};

export default async function ListingGrid(props: Props) {
  const { marketplace, collection } = props;
  const listingsPromise = getAllValidListings({
    contract: marketplace,
  });
  const auctionsPromise = getAllValidAuctions({
    contract: marketplace,
  });

  const [listings, auctions] = await Promise.all([
    listingsPromise,
    auctionsPromise,
  ]);

  // Retrieve all NFTs from the listings
  const tokenIds = Array.from(
    new Set([
      ...listings
        .filter(
          (l) => l.assetContractAddress === collection.address
        )
        .map((l) => l.tokenId),
      ...auctions
        .filter(
          (a) => a.assetContractAddress === collection.address
        )
        .map((a) => a.tokenId),
    ])
  );

  const nftData = tokenIds.map((tokenId) => {
    const direct = listings.find((l) => l.tokenId === tokenId);
    const auction = auctions.find((a) => a.tokenId === tokenId);
    return {
      tokenId: tokenId.toString(),
      priceDisplay: direct
        ? `${formatEther(direct.currencyValuePerToken.value)} FIRE`
        : auction
          ? `${formatEther(auction.minimumBidCurrencyValue.value)} FIRE`
          : undefined,
      listedQuantity: direct?.quantity?.toString(),
      isAuction: !direct && !!auction,
    };
  });

  return (
    <Suspense fallback={<NFTGridLoading />}>
      <NFTGrid
        nftData={nftData}
        emptyText={props.emptyText}
        overrideOnclickBehavior={props.overrideOnclickBehavior}
      />
    </Suspense>
  );
}