"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, Store, ArrowLeftRight, Layers, Flame } from "lucide-react";

type NavLink = {
  href: string;
  label: string;
  icon: any;
  comingSoon?: boolean;
};

const links: NavLink[] = [
  { href: "/", label: "محفظتي", icon: Wallet },
  { href: "/buy", label: "السوق", icon: Store },
  { href: "/fire", label: "FIRE", icon: Flame },
  { href: "/my-cards", label: "بطاقاتي", icon: Layers },
  { href: "/p2p", label: "P2P", icon: ArrowLeftRight },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="التنقل السفلي"
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden backdrop-blur-md bg-black/70 border-t border-white/10 flex justify-around px-2 py-2"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.25rem)" }}
    >
  {links.map(({ href, label, icon: Icon, comingSoon }) => {
        const active = !comingSoon && pathname === href;
        const baseClasses = `group flex flex-col items-center gap-1 px-3 py-1 rounded-md text-[11px] font-medium transition`;
        if (comingSoon) {
          return (
            <div
              key={href + label}
              className={`${baseClasses} text-white/30 cursor-not-allowed`}
              aria-disabled="true"
              title="قريباً"
            >
              <span className="relative flex items-center justify-center w-9 h-9 rounded-full bg-white/5">
                <Icon className="w-5 h-5" />
                <span className="absolute -bottom-1 text-[9px] font-bold text-orange-400">قريباً</span>
              </span>
              {label}
            </div>
          );
        }
        const isFire = href === "/fire";
        return (
          <Link key={href} href={href} className={`${baseClasses} ${active ? "text-white" : "text-white/50 hover:text-white"}`}>
            <span className={`relative flex items-center justify-center w-9 h-9 rounded-full transition-all overflow-hidden ${active ? (isFire ? "bg-gradient-to-br from-orange-500 via-purple-600 to-pink-600 shadow-[0_0_0_2px_rgba(255,255,255,0.25)]" : "bg-gradient-to-br from-purple-600 to-pink-600 shadow-[0_0_0_2px_rgba(255,255,255,0.15)]") : (isFire ? "bg-gradient-to-br from-orange-500/30 via-purple-600/30 to-pink-600/30" : "bg-white/5 group-hover:bg-white/10")}`}>
              {isFire && (
                <span className="absolute inset-0 animate-spin-slow opacity-30 bg-[conic-gradient(from_0deg,rgba(255,140,0,.6),rgba(255,0,128,.4),rgba(120,80,255,.5),rgba(255,140,0,.6))]" />
              )}
              <Icon className="w-5 h-5 relative" />
              {active && <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-orange-400" />}
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
