"use client";
export const dynamic = "force-dynamic";

import MarketTab from "../components/MarketTab";
import ApproveFireForMarketplace from "../components/ApproveFireForMarketplace";
import { useActiveAccount } from "thirdweb/react";

export default function Buy() {
	// Simplified marketplace page (history removed per latest requirements)
	useActiveAccount();
	return (
		<div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white px-4 py-8 space-y-10">
			<ApproveFireForMarketplace />
			<MarketTab />
		</div>
	);
}