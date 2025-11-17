"use client";
import React, { useEffect } from "react";

type AdProps = {
  adSlot?: string; // data-ad-slot id from AdSense
  adClient?: string; // data-ad-client, defaults to your pub id
  className?: string;
};

export default function AdSlot({ adSlot = "REPLACE_AD_SLOT_ID", adClient = "ca-pub-2211206432268473", className = "" }: AdProps) {
  const insRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    function alreadyHasAd(el: HTMLElement | null) {
      if (!el) return false;
      // AdSense sets data-adsbygoogle-status="done" after filling
      return el.getAttribute('data-adsbygoogle-status') === 'done';
    }

    function tryPush(el: HTMLElement | null) {
      if (!el) return;
      if (alreadyHasAd(el)) return;
      try {
        // @ts-ignore
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (err: any) {
        const msg = String(err?.message || err || '');
        // Ignore known benign TagError messages
        if (msg.includes('No slot size for availableWidth') || msg.includes("All 'ins' elements in the DOM with class=adsbygoogle already have ads in them")) {
          return;
        }
        // otherwise rethrow to surface unexpected errors
        console.warn('adsbygoogle.push error', err);
      }
    }

    const el = insRef.current;
    if (!el) return;

    // If element already has width and no ad yet, push immediately
    const elementNode = el.querySelector('ins.adsbygoogle') as HTMLElement | null;
    if (elementNode && elementNode.clientWidth > 0 && !alreadyHasAd(elementNode)) {
      tryPush(elementNode);
      return;
    }

    // Use IntersectionObserver to wait until visible (and layouted) before pushing
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (cancelled) return;
        const target = entry.target as HTMLElement;
        if (entry.isIntersecting && target.clientWidth > 0 && !alreadyHasAd(target)) {
          tryPush(target);
          io.disconnect();
          return;
        }
      }
    }, { threshold: [0, 0.01, 0.5, 1] });

    if (elementNode) io.observe(elementNode);

    return () => { cancelled = true; io.disconnect(); };
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
