"use client";
import { useRouter } from "next/navigation";
import { NFT as NFTType } from "thirdweb";
import { TransactionButton } from "thirdweb/react";
import { createListing } from "thirdweb/extensions/marketplace";
import toast from "react-hot-toast";
import { MARKETPLACE, NFT_COLLECTION, FIRE_CONTRACT_ADDRESS } from "../../const/addresses";
import toastStyle from "../../util/toastConfig";


export default function DirectListingButton({
	nft,
	pricePerToken,
	quantity = "1",
}: {
	nft: NFTType;
	pricePerToken: string;
	quantity?: string | number;
}) {
	const router = useRouter();
	return (
		<TransactionButton
			transaction={() => {
				return createListing({
					contract: MARKETPLACE,
					assetContractAddress: NFT_COLLECTION.address,
					tokenId: nft.id,
					pricePerToken,
					currencyContractAddress: FIRE_CONTRACT_ADDRESS as any,
					quantity: BigInt(quantity || 1),
				});
			}}
			onTransactionSent={() => {
				toast.loading("Listing...", {
					id: "direct",
					style: toastStyle,
					position: "bottom-center",
				});
			}}
			onError={(error) => {
				toast(`Listing Failed!`, {
					icon: "❌",
					id: "direct",
					style: toastStyle,
					position: "bottom-center",
				});
			}}
			onTransactionConfirmed={(txResult) => {
				toast("Listed Successfully!", {
					icon: "🥳",
					id: "direct",
					style: toastStyle,
					position: "bottom-center",
				});
				router.push(
					`/token/${NFT_COLLECTION.address}/${nft.id.toString()}`
				);
			}}
		>
			List for Sale
		</TransactionButton>
	);
}