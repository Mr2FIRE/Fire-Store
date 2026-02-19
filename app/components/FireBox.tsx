"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import ChestImg from "../../../public/assets/FireBox.png";

const floatVariants = {
  initial: { y: 0 },
  animate: {
    y: [0, -6, 0, -3, 0],
    transition: { duration: 5, repeat: Infinity, ease: "easeInOut" },
  },
};

const glowPulse = {
  initial: { opacity: 0.35, scale: 0.85 },
  animate: {
    opacity: [0.25, 0.5, 0.3, 0.55, 0.35],
    scale: [0.85, 1.05, 0.9, 1.08, 0.85],
    transition: { duration: 6, repeat: Infinity, ease: "easeInOut" },
  },
};

const ringVariants = {
  initial: { opacity: 0.15, scale: 0.6 },
  animate: {
    opacity: [0.15, 0.4, 0.2, 0.45, 0.15],
    scale: [0.6, 1.15, 0.8, 1.2, 0.6],
    transition: { duration: 7, repeat: Infinity, ease: "easeInOut" },
  },
};

function Sparks() {
  return (
    <div className="absolute inset-0 overflow-visible pointer-events-none">
      {[...Array(14)].map((_, i) => {
        const delay = (i * 0.7) % 5;
        const duration = 4 + (i % 5) * 1.7;
        const size = 3 + (i % 4);
        const left = (i * 37) % 100;
        return (
          <span
            key={i}
            style={{
              left: left + '%',
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
              width: size,
              height: size,
            }}
            className="absolute bottom-0 bg-gradient-to-br from-orange-400 via-yellow-300 to-pink-400 rounded-full opacity-40 animate-[riseFire_6s_linear_infinite] blur-[0.5px]" />
        );
      })}
      <style>{`@keyframes riseFire {0%{transform:translateY(0) scale(.6);opacity:.05}50%{opacity:.55}100%{transform:translateY(-120px) scale(1.2);opacity:0}}`}</style>
    </div>
  );
}

export default function FireBox() {
  return (
    <div className="relative w-44 h-44 group select-none">
      {/* Outer subtle rotating gradient ring */}
      <motion.div
        variants={ringVariants}
        initial="initial"
        animate="animate"
        className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,rgba(255,140,0,0.25),rgba(255,0,128,0.2),rgba(100,70,255,0.25),rgba(255,140,0,0.25))] blur-xl"/>

      {/* Core glow */}
      <motion.div
        variants={glowPulse}
        initial="initial"
        animate="animate"
        className="absolute inset-4 rounded-2xl bg-gradient-to-br from-orange-500/25 via-pink-500/20 to-purple-600/25 blur-xl"/>

      {/* Sparks */}
      <Sparks />

      {/* Hover aura */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-orange-500/20 via-pink-500/10 to-purple-600/20 blur-2xl"/>

      {/* Chest image with gentle float & hover pop */}
      <motion.div
        variants={floatVariants}
        initial="initial"
        animate="animate"
        whileHover={{ scale: 1.08, rotate: 1.5, y: -8 }}
        transition={{ type: 'spring', stiffness: 180, damping: 14 }}
        className="relative w-full h-full flex items-center justify-center drop-shadow-[0_0_12px_rgba(255,140,0,0.35)]"
      >
        <Image
          src={ChestImg}
          alt="Fire Box"
          width={176}
          height={176}
          priority
          className="object-contain pointer-events-none select-none"
        />
        {/* Light beam */}
        <div className="absolute -bottom-3 w-24 h-24 bg-gradient-to-t from-orange-500/30 via-pink-400/10 to-transparent blur-xl rounded-full group-hover:scale-125 transition-transform" />
      </motion.div>

      {/* Label overlay (optional) */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[10px] tracking-wider font-semibold text-orange-200/80 bg-black/40 px-2 py-0.5 rounded-full border border-orange-400/30 backdrop-blur-sm group-hover:text-orange-100">
        FIRE BOX
      </div>
    </div>
  );
}
