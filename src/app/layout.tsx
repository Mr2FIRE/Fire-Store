import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThirdwebProvider } from "thirdweb/react";
import { Toaster } from "react-hot-toast";
import Navbar from "./components/NavBar";
import IntroLanding from "./components/IntroLanding";
import BottomNav from "./components/BottomNav";
import Script from "next/script";
import AdSlot from "./components/ads";


const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FireStore",
  description:
    "A decentralized marketplace for trading digital assets",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
  <html lang="ar" dir="rtl">
      <head>
        {/* Google AdSense - async script included on every page */}
        <Script
          id="adsense-script"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2211206432268473"
          strategy="afterInteractive"
          crossOrigin="anonymous"
        />
      </head>
      <body className={inter.className}>
  <ThirdwebProvider>
  <Navbar />
  <IntroLanding />
    {/* Top banner ad (replace adSlot with your production slot id) */}
    <AdSlot adSlot="REPLACE_TOP_SLOT_ID" className="my-4 px-4" />
    <main className="pb-20">{children}</main>
  <BottomNav />
  {/* Global toast portal */}
  <Toaster />
  </ThirdwebProvider>
      </body>
    </html>
  );
}
