"use client";
import React, { useEffect, useState } from "react";
// Custom animated flame icon (replaces previous FireBox)
function FlameIcon() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <svg
        viewBox="0 0 64 64"
        className="w-24 h-24 drop-shadow-[0_0_10px_rgba(255,140,40,0.6)]"
      >
        <defs>
          <radialGradient id="flameGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff6e6" />
            <stop offset="40%" stopColor="#ffb347" />
            <stop offset="75%" stopColor="#ff6a00" />
            <stop offset="100%" stopColor="#d23600" />
          </radialGradient>
          <linearGradient id="flameCore" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffe7c7" />
            <stop offset="55%" stopColor="#ff9d2f" />
            <stop offset="100%" stopColor="#ff4d00" />
          </linearGradient>
        </defs>
        {/* Outer flame */}
        <path
          d="M34 4c2 6 0 9 4 13s6 5 8 10c5 11-1 25-14 25S15 49 16 37c1-12 11-15 9-25 3 2 5 6 5 10 1-5 2-9 4-13Z"
          fill="url(#flameGlow)"
          className="animate-[pulse_2.2s_ease-in-out_infinite]"
          opacity={0.9}
        />
        {/* Inner core */}
        <path
          d="M33 14c1 4-1 6 2 9 2 2 3 3 4 6 2 6-2 13-9 13s-10-7-8-13c1-6 6-7 5-13 2 1 4 4 4 6 0-3 1-5 2-8Z"
          fill="url(#flameCore)"
          className="animate-[pulse_1.4s_ease-in-out_infinite]"
        />
        {/* Spark dots */}
        <circle cx="18" cy="18" r="2" fill="#ffa94d" className="animate-[ping_2.5s_linear_infinite]" />
        <circle cx="46" cy="22" r="1.8" fill="#ffcf7a" className="animate-[ping_3s_linear_infinite]" />
        <circle cx="30" cy="6" r="1.6" fill="#ffd9a3" className="animate-[ping_2.8s_linear_infinite]" />
      </svg>
    </div>
  );
}

// One-time introductory overlay using localStorage
export default function IntroLanding() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const forceIntro = params.get("intro") === "1";
      const key = "fs_intro_seen_v1";
      const seenLocal = localStorage.getItem(key);
      const seenSession = sessionStorage.getItem(key);
      if (forceIntro) {
        setShow(true);
        return;
      }
      if (!seenLocal && !seenSession) {
        console.debug("[IntroLanding] First time detected -> showing intro");
        setShow(true);
        try { localStorage.setItem(key, Date.now().toString()); } catch {}
        try { sessionStorage.setItem(key, "1"); } catch {}
      } else {
        console.debug("[IntroLanding] Intro already seen (local/session)");
      }
    } catch (err) {
      console.warn("[IntroLanding] Storage check failed", err);
      setShow(true); // fallback to show so user still sees intro
    }
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm text-white p-4 animate-fade-in">
      <div className="relative w-full max-w-2xl mx-auto">
        {/* Glow circles */}
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-purple-600/30 blur-3xl animate-pulse" />
        <div className="absolute -bottom-20 -right-16 w-60 h-60 rounded-full bg-orange-500/30 blur-3xl animate-pulse [animation-delay:400ms]" />
        <div className="relative border border-white/10 rounded-2xl overflow-hidden bg-gradient-to-br from-gray-900/80 via-gray-800/70 to-black/80 shadow-[0_0_25px_-5px_rgba(255,115,0,0.6)]">
          <div className="p-6 sm:p-10 flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative w-40 h-40 shrink-0">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-orange-500 via-purple-600 to-pink-600 animate-spin-slow [animation-duration:12s] opacity-60" />
                <div className="absolute inset-[6px] rounded-lg bg-black/80 flex items-center justify-center">
                  <FlameIcon />
                </div>
              </div>
              <div className="flex-1 text-center sm:text-right space-y-3">
                <h1 className="text-3xl sm:text-5xl font-extrabold bg-gradient-to-r from-orange-400 via-purple-400 to-pink-400 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(255,120,40,0.5)]">
                  مرحباً بك في سوق فاير
                </h1>
                <p className="text-white/80 text-[15px] leading-relaxed">
                  اكتشف و تداول الأصول الرقمية النارية: عناصر <span className="text-orange-300">تيكتوك</span>، <span className="text-purple-300">ببجي</span>، و <span className="text-pink-300">اسيا</span>.<br />
                  اشترِ مباشرة بعملة <span className="text-orange-400 font-semibold">فاير</span> في بيئة سريعة و آمنة.
                </p>
                <div className="bg-white/[0.04] border border-white/10 rounded-lg p-3 sm:p-4 text-[13px] sm:text-sm leading-relaxed text-white/80 shadow-inner">
                  <p>
                    <span className="font-bold text-orange-400">عملة فاير (FIRE)</span> صُممت لتخفيض القيود و التكاليف: رسوم التحويل فقط <span className="text-green-400 font-semibold">0.6%</span> بدون حدود إزعاج، مما يمنحك تجربة تداول سلسة و فعّالة.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center sm:justify-end text-[10px]">
                  {['تيكتوك (0-6)','ببجي (7-13)','اسيا (14-18)','مزاد و بيع مباشر','رسوم منخفضة'].map(t => (
                    <span key={t} className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-purple-500 transition">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            {/* Feature grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-[11px] sm:text-xs">
              {[{
                title: 'سرعة', desc: 'تنفيذ سريع على BSC Testnet'
              },{
                title: 'أمان', desc: 'عقود ذكية موثوقة'
              },{
                title: 'تنوع', desc: 'مجموعات متعددة'
              },{
                title: 'سيولة', desc: 'بيع و شراء فوري'
              }].map(card => (
                <div key={card.title} className="relative group overflow-hidden rounded-lg bg-white/[0.04] border border-white/10 p-3">
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-gradient-to-br from-purple-600/10 via-orange-500/10 to-pink-500/10" />
                  <h3 className="font-semibold mb-1 text-orange-300 text-xs tracking-wide">{card.title}</h3>
                  <p className="text-white/65 text-[11px] leading-snug">{card.desc}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-2">
              <button
                onClick={() => setShow(false)}
                className="flex-1 relative overflow-hidden rounded-lg bg-gradient-to-r from-orange-500 via-purple-600 to-pink-600 py-3 font-bold text-base tracking-wide shadow-lg hover:shadow-orange-500/30 focus:outline-none"
              >
                <span className="relative z-10">ابدأ الآن</span>
                <span className="absolute inset-0 animate-pulse bg-gradient-to-r from-white/10 via-transparent to-white/10" />
              </button>
              <button
                onClick={() => setShow(false)}
                className="px-5 py-3 rounded-lg border border-white/15 text-white/70 hover:text-white hover:border-white/40 text-base"
              >لاحقاً</button>
            </div>
          </div>
          {/* Close */}
          <button
            onClick={() => setShow(false)}
            aria-label="إغلاق"
            className="absolute top-2 left-2 text-white/50 hover:text-white transition text-xl"
          >×</button>
        </div>
      </div>
    </div>
  );
}

// Simple animation utilities (can reside in globals if desired)
// Tailwind directives for custom animations should exist; fallback to inline classes defined via arbitrary values.