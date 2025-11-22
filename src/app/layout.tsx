import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThirdwebProvider } from "thirdweb/react";
import { Toaster } from "react-hot-toast";
import Navbar from "./components/NavBar";
import IntroLanding from "./components/IntroLanding";
import BottomNav from "./components/BottomNav";


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
      <head />
      <body className={inter.className}>
  <ThirdwebProvider>
  <Navbar />
  <IntroLanding />
    {/* Ads removed */}
    <main className="pb-20">{children}</main>
  <BottomNav />
  {/* Global toast portal */}
  <Toaster />
  </ThirdwebProvider>
      </body>
    </html>
  );
}
