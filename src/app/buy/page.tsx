"use client";
export const dynamic = "force-dynamic";

import MarketTab from "../components/MarketTab";
import ApproveFireForMarketplace from "../components/ApproveFireForMarketplace";

export default function Buy() {
	return (
		<div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white px-4 py-8">
			<ApproveFireForMarketplace />
			<MarketTab />
		</div>
	);
}
