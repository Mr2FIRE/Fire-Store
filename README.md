<div align="center">
   <h1>🔥 Fire Wallet / Marketplace dApp</h1>
   <p>A Polygon (Mainnet) NFT marketplace + wallet interface with pack opening rewards and a FIRE token economy.</p>
</div>

## Overview
This app lets users:
- View, filter and buy listed NFTs (direct + auction ready structure, currently direct purchase flow active).
- Open on‑chain packs; each opening awards at least 1 FIRE token plus any NFT drops (displayed in a reward modal).
- Manage balances (FIRE + USDT) and transfer tokens.
- List owned ERC1155 NFTs for sale (direct listing flow with approval + listing buttons).
- Experience a one‑time animated landing intro (Arabic UI focus) stored via local/session storage flags.

Primary UI language is Arabic (RTL friendly content) while code and README are English.

## Key Features
- 🔐 Wallet detection & account hooks (Thirdweb v5).
- 🛒 Marketplace tab (client-side fetching of valid listings / auctions + category segmentation by token ID ranges: TikTok 0–6, PUBG 7–13, Asia 14–18).
- 📦 Pack opening animation logic with delta calculation of NFT rewards + guaranteed FIRE reward.
- 💰 Wallet tab with live FIRE ↔ USDT aggregated value (simple static conversion rate constant `FIRE_TO_USDT_RATE`).
- 🎁 Reward modal (centered layout if only one reward).
- ✨ One-time animated intro overlay (`IntroLanding`) with force trigger via `?intro=1`.
- 🌗 Fully responsive Tailwind layout (mobile-first, optimized grid density).
- ⚡ Dynamic data fetch: Home page marked `force-dynamic` to avoid stale caching.
- 🔔 Toast notifications (Arabic) for all critical user actions.

## Tech Stack
- **Framework:** Next.js 14 (App Router) + React 18 + TypeScript
- **Blockchain SDK:** thirdweb v5 (`thirdweb` package) (plus legacy dependency cleanup recommended)
- **Styling:** Tailwind CSS 3 + custom gradients / utility classes
- **Animation:** framer-motion
- **Notifications:** react-hot-toast
- **QR Codes:** react-qr-code (wallet receive modal)
- **Icons / Visual:** Custom SVG flame + minimal local assets

## Project Structure (simplified)
```
FireStore/
   next.config.mjs
   public/
      assets/FireBox.png
   src/app/
      page.tsx              # Home (market + wallet tabs)
      profile/page.tsx       # Owned NFTs & pack opening
      buy/page.tsx           # Alternate buying view
      token/[contract]/[tokenId]/page.tsx # Single token view / buy
      components/            # Reusable UI (MarketTab, IntroLanding, etc.)
      const/addresses.ts     # Chain + contract references
      client.ts              # Thirdweb client init (env-based)
```

## Environment Variables
Create `FireStore/.env` (or add in Vercel project settings):
```
NEXT_PUBLIC_TEMPLATE_CLIENT_ID=your_thirdweb_client_id
```
The code throws at startup if this is missing (`client.ts`).

Optional / future (not yet consumed in current code):
```
THIRDWEB_SECRET_KEY=        # For server-side actions if added later
PRIVATE_KEY=                # For scripted listings / backend jobs
```

## Contracts (Polygon Mainnet)
Defined in `src/app/const/addresses.ts`:
- FIRE token: `FIRE_CONTRACT_ADDRESS`
- USDT (canonical Polygon USDT)
- CARD (ERC1155 collection)
- PACK (ERC1155 pack contract)
- MARKETPLACE (Direct listings / auctions)

If you redeploy new contracts, update these constants (or refactor to read from env `NEXT_PUBLIC_*`).

## Development
Using npm (package-lock) or yarn (yarn.lock) – keep only one. Example with npm:
```bash
cd FireStore
npm install
npm run dev
```
Visit: http://localhost:3000

## Build & Deploy (Vercel)
1. Set project root to `FireStore/` (not the parent folder).
2. Add env var: `NEXT_PUBLIC_TEMPLATE_CLIENT_ID`.
3. (Optional) Remove unused lockfile (either `yarn.lock` or `package-lock.json`).
4. (Recommended) Clean `images.domains` in `next.config.mjs` to valid hostnames only (e.g. `ipfs.io`).
5. Trigger deploy: Vercel will run `next build` automatically.

## Usage Flow
1. Connect wallet (Thirdweb auto-detects injected wallet).
2. Market tab: Browse NFT listings (Arabic labels, category filters).
3. Profile: Open packs – reward modal shows gained NFTs + 1 FIRE token.
4. Wallet tab: View FIRE & USDT balances, send or receive via QR.
5. List NFTs: Open NFT details from profile and create direct listing (approval + listing buttons).

## Customization Ideas
- Replace hardcoded FIRE↔USDT rate with on-chain oracle.
- Add auctions UI (currently only direct list purchase exposed to user).
- Server actions for secure listing automation (would use `THIRDWEB_SECRET_KEY`).
- Add RTL `<html dir="rtl">` root if full RTL layout desired.
- Dynamic FIRE reward (read from pack contract instead of hardcoded).

## Known Considerations
- Images config currently includes non-host entries (CIDs / `ipfs://`). Adjust before production for Next Image Optimization.
- Some components use `any` for speed; production hardening should introduce strict types.
- No global error boundary or custom 404 page yet (optional).

## Scripts
```bash
npm run dev     # Start development server
npm run build   # Production build
npm run start   # Start production server (after build)
npm run lint    # Lint
```

## License
Project intent: internal / prototype usage. Add a proper LICENSE file if distributing publicly.

## Attribution
Built with Thirdweb SDK, Next.js, Tailwind, framer-motion, react-hot-toast, and community tooling.

---
Feel free to extend functionality (dynamic pricing, auctions, analytics dashboards, etc.).