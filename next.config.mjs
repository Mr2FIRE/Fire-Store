/** @type {import('next').NextConfig} */
const nextConfig = {
  // fixes wallet connect dependency issue https://docs.walletconnect.com/web3modal/nextjs/about#extra-configuration
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
  images: {
    domains: ["ipfs.io", "QmRid7mHMkpfXuUP4w6EJXJC6iuUgP2gDhbXZuqK88UtVp", "ipfs://", "QmRnJJX87Rd2fGTEMMjtXhevgUdMGTG8noM9FDGfosU37A"],
  },
};

export default nextConfig;
