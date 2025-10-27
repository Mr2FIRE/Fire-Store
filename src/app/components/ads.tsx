"use client";
import { useEffect } from "react";

type AdProps = {
  adSlot?: string; // data-ad-slot id from AdSense
  adClient?: string; // data-ad-client, defaults to your pub id
  className?: string;
};

export default function AdSlot({ adSlot = "REPLACE_AD_SLOT_ID", adClient = "ca-pub-2211206432268473", className = "" }: AdProps) {
  useEffect(() => {
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      // ignore until AdSense is active
    }
  }, [adSlot]);

  return (
    <div className={`w-full flex items-center justify-center ${className}`}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={adClient}
        data-ad-slot={adSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
