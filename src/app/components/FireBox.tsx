"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import ChestImg from "../../../public/assets/FireBox.png";

const shakeAnimation = {
  animate: {
    x: [
      0, -2, 2, -3, 3, 0, 1, -1, 2, -2, 0,
    ],
    y: [
      0, 1, -2, 2, -1, 1, -3, 2, -2, 1, 0,
    ],
    transition: {
      repeat: Infinity,
      duration: 2,
      ease: "easeInOut",
    },
  },
};

export default function FireBox() {
  return (
    <motion.div
      className="w-40 h-40 flex items-center justify-center"
      variants={shakeAnimation}
      animate="animate"
    >
      <Image
        src={ChestImg}
        alt="Fire Box"
        width={160}
        height={160}
        className="object-contain"
      />
    </motion.div>
  );
}
