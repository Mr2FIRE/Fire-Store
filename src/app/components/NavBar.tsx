"use client";

import { client } from "../client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useActiveWallet,
  useActiveAccount,
  useWalletBalance,
  ConnectButton,
} from "thirdweb/react";
import { inAppWallet, createWallet } from "thirdweb/wallets";
import { BSC_TESTNET } from "../const/addresses";
import { FIRE_CONTRACT } from "../const/addresses";
import { useState, useEffect } from "react";
import { Flame, Layers, ArrowLeftRight, Sun, Moon } from "lucide-react";
import { useTheme } from "../providers/ThemeProvider";

export default function Navbar() {
  const pathname = usePathname();
  const wallet = useActiveWallet();
  const account = useActiveAccount();
  const address = account?.address;
  const { data: fireBal } = useWalletBalance({
    client: FIRE_CONTRACT.client,
    chain: FIRE_CONTRACT.chain,
    address,
    tokenAddress: FIRE_CONTRACT.address,
  });
  const short = address
    ? `${address.slice(0, 4)}...${address.slice(-4)}`
    : "";
  const [open, setOpen] = useState(false);
  const { theme, toggle } = useTheme();

  const links = [
    { href: "/", label: "محفظتي", icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 4h18M5 8h14l-1 10H6L5 8z"/><path d="M9 12h6"/></svg>
    ) },
    { href: "/buy", label: "السوق", icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
    ) },
    { href: "/fire", label: "FIRE", icon: <Flame className="w-4 h-4" /> },
    { href: "/my-cards", label: "بطاقاتي", icon: <Layers className="w-4 h-4" /> },
    { href: "/p2p", label: "P2P", icon: <ArrowLeftRight className="w-4 h-4" /> },
  ];

  const activeClass = (href: string) =>
    pathname === href
      ? "text-white bg-purple-600/60 shadow-inner"
      : "text-white/60 hover:text-white hover:bg-white/10";

  // Force LTR specifically for thirdweb connect wallet popups rendered via portal
  useEffect(() => {
    const applyLTR = () => {
      // Target typical dialog / portal roots
      const dialogs = document.querySelectorAll('[role="dialog"], [data-overlay-root], .tw-connect-wallet, .tw-connected-wallet');
      dialogs.forEach((el) => {
        if (el instanceof HTMLElement) {
          if (!el.dataset._ltrApplied) {
            el.setAttribute('dir', 'ltr');
            el.style.direction = 'ltr';
            el.dataset._ltrApplied = '1';
          }
        }
      });
    };
    // Run immediately in case already open
    applyLTR();
    const obs = new MutationObserver(() => applyLTR());
    obs.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('focus', applyLTR, true);
    return () => { obs.disconnect(); window.removeEventListener('focus', applyLTR, true); };
  }, []);

  return (
  <nav dir="ltr" className="sticky top-0 z-40 w-full backdrop-blur-md bg-black/55 border-b border-white/10 supports-[backdrop-filter]:bg-black/40">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="h-14 flex items-center justify-between gap-4">
          {/* Left: Brand */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center group">
              <span className="text-lg font-extrabold tracking-wide bg-gradient-to-r from-orange-400 via-purple-400 to-pink-400 bg-clip-text text-transparent group-hover:from-orange-300 group-hover:to-pink-300 transition-all">
                Fire&nbsp;Store
              </span>
            </Link>
          </div>

            {/* Desktop Links */}
            <div className="hidden md:flex items-center gap-1">
              {wallet &&
                links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${activeClass(
                      l.href
                    )}`}
                  >
                    {l.icon}
                    <span className="font-medieval">{l.label}</span>
                  </Link>
                ))}
            </div>

          {/* Right cluster */}
          <div className="flex items-center gap-3 ml-auto">
            {wallet && (
              <div className="hidden sm:flex items-center gap-2 rounded-md px-3 py-1.5 bg-white/5 border border-white/10 text-xs text-white/70">
                <span className="font-mono">{short}</span>
                <span className="w-px h-4 bg-white/15" />
                <span className="text-orange-300 font-semibold">
                  {(fireBal?.displayValue || 0).toString().slice(0, 6)} فاير
                </span>
              </div>
            )}
            <div className="md:hidden">
              {wallet && (
                <button
                  onClick={() => setOpen((o) => !o)}
                  aria-label="Menu"
                  className="p-2 rounded-md bg-white/10 hover:bg-white/20 text-white/80"
                >
                  {open ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
                  )}
                </button>
              )}
            </div>
            <div className="connect-ltr" dir="ltr">
            <ConnectButton
              client={client}
              chain={BSC_TESTNET}
              wallets={[
                inAppWallet({
                  auth: {
                    options: [
                      "email",
                      "telegram",
                      "passkey",
                      "phone",
                      "google",
                      "apple",
                      "facebook",
                    ],
                  },
                }),
                createWallet("io.metamask"),
                createWallet("com.coinbase.wallet"),
                createWallet("walletConnect"),
              ]}
              connectButton={{
                label: (
                  <span className={`font-semibold text-sm sm:text-base ${theme === 'light' ? 'text-black' : 'text-white'}`}>
                    {wallet ? "" : "تسجيل الدخول"}
                  </span>
                ),
                className: theme === 'light'
                  ? 'bg-white text-black hover:bg-white/90 border border-black/10 rounded-md px-4 py-2 transition shadow-sm'
                  : 'bg-black text-white hover:bg-black/90 border border-white/10 rounded-md px-4 py-2 transition shadow-sm',
              }}
            />
            </div>
            {/* Theme toggle placed after connect button to be visible globally */}
            <div>
              <button
                onClick={() => toggle()}
                title="Toggle theme"
                className={theme === 'light' ? 'p-2 rounded bg-white border border-black/10 text-black' : 'p-2 rounded bg-white/5 hover:bg-white/10 text-white'}
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile dropdown */}
        {wallet && open && (
          <div className="md:hidden pb-3 animate-fade-in">
            <div className="flex flex-col gap-1 bg-black/50 rounded-lg p-2 border border-white/10">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${activeClass(
                    l.href
                  )}`}
                >
                  {l.icon}
                  <span className="font-medieval">{l.label}</span>
                </Link>
              ))}
              <div className="mt-1 flex items-center gap-2 px-3 py-2 rounded-md bg-white/5 text-xs text-white/70">
                <span className="font-mono">{short}</span>
                <span className="w-px h-4 bg-white/15" />
                <span className="text-orange-300 font-semibold">{(fireBal?.displayValue || 0).toString().slice(0,6)} فاير</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}