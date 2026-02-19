"use client";
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useActiveAccount, useWalletBalance } from "thirdweb/react";
import { getContract, readContract, prepareContractCall, sendTransaction } from "thirdweb";
import { safeSendTransaction } from "../util/safeSend";
import { ArrowLeftRight, Plus, AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";
import ApproveForStore from "../components/ApproveForStore";
import { useTheme } from "../providers/ThemeProvider";
import { USDT_CONTRACT_ADDRESS, USDT_CONTRACT, FIRE_CONTRACT_ADDRESS, BSC_TESTNET, P2P_ESCROW_CONTRACT_ADDRESS, P2P_ABI, BSC_SCAN_URL, ASIA_TOKEN_ADDRESS, ZAIN_TOKEN_ADDRESS, MASTER_TOKEN_ADDRESS, P2P_ESCROW_CONTRACT } from "../const/addresses";
import toast from "react-hot-toast";
import { client } from "../client";

interface Ad {
  id: string;
  type: "sell" | "buy";
  amount: number;
  unitPrice: number;
  minOrderAmount: number;
  paymentToken?: string;
  lockedPaymentAmount?: number;
  paymentMethod: string;
  token?: string;
  user: string;
  description?: string;
}

interface Order {
  id: string;
  adId: string;
  buyer: string;
  seller: string;
  amount: number;
  unitPrice: number;
  paymentMethod: string;
  status: "pending" | "paid" | "released" | "disputed";
  createdAt: Date;
}

export default function P2PPage() {
  const { theme } = useTheme();
  const account = useActiveAccount();
  const currentUser = account?.address || "Anonymous";

  const { data: usdtBalance } = useWalletBalance({ client, tokenAddress: USDT_CONTRACT_ADDRESS, address: account?.address, chain: BSC_TESTNET });
  const { data: fireBalance } = useWalletBalance({ client, tokenAddress: FIRE_CONTRACT_ADDRESS, address: account?.address, chain: BSC_TESTNET });

  const [ads, setAds] = useState<Ad[]>([]);
  const [adCounter, setAdCounter] = useState(1);
  const [adTxMap, setAdTxMap] = useState<Record<string,string>>({});
  const [adEventMap, setAdEventMap] = useState<Record<string,{placed:string[];released:string[]}>>({});
  const [selectedAdId, setSelectedAdId] = useState<string | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [paymentTokenFilter, setPaymentTokenFilter] = useState<string>("all");
  const [showPostAd, setShowPostAd] = useState(false);
  const [newAd, setNewAd] = useState({ type: "sell" as "sell" | "buy", amount: 0, unitPrice: 1, minOrderAmount: 1, paymentMethod: "FIRE", description: "" });

  const [showPlaceOrder, setShowPlaceOrder] = useState<Ad | null>(null);
  const [orderAmount, setOrderAmount] = useState<number>(1);
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedAdLocked, setSelectedAdLocked] = useState<number | null>(null);
  const [loadingSelectedLocked, setLoadingSelectedLocked] = useState(false);
  const MAX_APPROVAL = "10000000000000000000000000000000000000"; // very large approval amount

  function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

  function isRateLimitError(e: any) {
    if (!e) return false;
    const m = (e.message || '').toString().toLowerCase();
    if (m.includes('rate') || m.includes('rate limited') || m.includes('rate limit') || m.includes('429') || m.includes('too many requests')) return true;
    if (e.code && (e.code === 429 || e.code === 'RATE_LIMIT' || e.code === 'SERVER_ERROR')) return true;
    return false;
  }

  async function retryRpc<T>(fn: () => Promise<T>, attempts = 3, baseDelay = 800): Promise<T> {
    let lastErr: any;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (e: any) {
        lastErr = e;
        if (!isRateLimitError(e)) throw e;
        const delay = baseDelay * Math.pow(2, i);
        await sleep(delay);
      }
    }
    throw lastErr;
  }

  async function retryTx<T>(fn: () => Promise<T>, attempts = 3, baseDelay = 800): Promise<T> {
    let lastErr: any;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (e: any) {
        lastErr = e;
        if (!isRateLimitError(e)) throw e;
        const delay = baseDelay * Math.pow(2, i);
        await sleep(delay);
      }
    }
    throw lastErr;
  }

  useEffect(() => {
    // start with no example ads — load on-chain ads
    setAds([]);
    setAdCounter(1);
    loadAds();
    const poll = setInterval(loadAds, 15000);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    if (selectedAdId) {
      // refresh locked amount whenever the user opens an ad detail
      refreshLockedForSelected(selectedAdId);
    } else {
      setSelectedAdLocked(null);
    }
  }, [selectedAdId, ads]);

  function getProviderInstance() {
    if ((window as any).ethereum) {
      // prefer ethers v6 BrowserProvider when available
      if ((ethers as any).BrowserProvider) {
        try { return new (ethers as any).BrowserProvider((window as any).ethereum); } catch {}
      }
      // fallback to Web3Provider if present (ethers v5 style)
      if ((ethers as any).providers && (ethers as any).providers.Web3Provider) {
        try { return new (ethers as any).providers.Web3Provider((window as any).ethereum); } catch {}
      }
      if ((ethers as any).Web3Provider) {
        try { return new (ethers as any).Web3Provider((window as any).ethereum); } catch {}
      }
    }
    return new (ethers as any).JsonRpcProvider("https://data-seed-prebsc-1-s1.binance.org:8545/");
  }

  // Ethers compatibility helpers (works with v5 and v6)
  function parseUnits(value: string, decimals?: number) {
    const d = typeof decimals === 'number' ? decimals : 18;
    if ((ethers as any).parseUnits) return (ethers as any).parseUnits(value, d);
    if ((ethers as any).utils && (ethers as any).utils.parseUnits) return (ethers as any).utils.parseUnits(value, d);
    throw new Error('parseUnits unavailable');
  }

  function formatUnits(value: any, decimals?: number) {
    const d = typeof decimals === 'number' ? decimals : 18;
    if ((ethers as any).formatUnits) return (ethers as any).formatUnits(value, d);
    if ((ethers as any).utils && (ethers as any).utils.formatUnits) return (ethers as any).utils.formatUnits(value, d);
    // fallback: try toString
    return String(value);
  }

  function bnLt(a: any, b: any) {
    try {
      if (typeof a === 'bigint' || typeof b === 'bigint') return BigInt(a) < BigInt(b);
      if (a && typeof a.lt === 'function') return a.lt(b);
      return BigInt(a.toString()) < BigInt(b.toString());
    } catch (e) {
      return false;
    }
  }

  function bnMulDiv(a: any, b: any, div: any) {
    try {
      if (typeof a === 'bigint' || typeof b === 'bigint' || typeof div === 'bigint') {
        return (BigInt(a) * BigInt(b)) / BigInt(div);
      }
      if (a && typeof a.mul === 'function') return a.mul(b).div(div);
      return BigInt(a.toString()) * BigInt(b.toString()) / BigInt(div.toString());
    } catch (e) {
      throw e;
    }
  }

  function toBigInt(v: any) {
    if (typeof v === 'bigint') return v;
    if (v && typeof v.toString === 'function') return BigInt(v.toString());
    return BigInt(v);
  }

  async function loadAds() {
    try {
      const readProvider = getProviderInstance();
      const contract = new (ethers as any).Contract(P2P_ESCROW_CONTRACT_ADDRESS, P2P_ABI as any, readProvider as any);

      const res: any = await retryRpc(() => contract.getAllAds());
      const ids = res[0] as any[];
      const sellers = res[1] as any[];
      const tokens = res[2] as any[];
      const amounts = res[3] as any[];
      const paymentTokens = res[4] as any[];
      const minOrderAmounts = res[5] as any[];
      const unitPrices = res[6] as any[];
      const paymentMethods = res[7] as any[];
      const actives = res[8] as any[];
      const lockedAmounts = res[9] as any[];
      const lockedPaymentAmounts = res[10] as any[];
      const isBuys = res[11] as any[];

      const mapped: Ad[] = [];
      for (let i = 0; i < ids.length; i++) {
          const rawAmount = amounts[i];
          // token decimals set to 2 for now
          const amountNum = Number(formatUnits(rawAmount, 2));
          const minOrder = Number(formatUnits(minOrderAmounts[i], 2)) || 1;
          const unitPriceNum = Number(formatUnits(unitPrices[i], 18)) || 1;
          mapped.push({
            id: String(ids[i].toString()),
            type: isBuys[i] ? 'buy' : 'sell',
            amount: amountNum,
            unitPrice: unitPriceNum,
            minOrderAmount: minOrder,
            paymentToken: String(paymentTokens[i] || ''),
            lockedPaymentAmount: Number(formatUnits(lockedPaymentAmounts[i] || 0, 18)),
            token: String(tokens[i] || ''),
            paymentMethod: paymentMethods[i],
            user: sellers[i],
            description: ''
          });
      }
      setAds(mapped);

      // events
      const created: any = await retryRpc(() => contract.queryFilter(contract.filters.AdCreated()));
      const adMap: Record<string,string> = {};
      created.forEach((ev: any) => { try { const aid = ev.args?.[0]?.toString(); if (aid) adMap[aid] = ev.transactionHash; } catch {} });
      setAdTxMap(adMap);
      const placed: any = await retryRpc(() => contract.queryFilter(contract.filters.OrderPlaced()));
      const released: any = await retryRpc(() => contract.queryFilter(contract.filters.OrderReleased()));
      const eventsByAd: Record<string,{placed:string[];released:string[]}> = {};
      placed.forEach((ev: any) => { try { const orderId = ev.args?.[0]?.toString(); const adId = ev.args?.[1]?.toString(); if (adId) { eventsByAd[adId] = eventsByAd[adId] || {placed:[], released:[]}; eventsByAd[adId].placed.push(ev.transactionHash); } } catch {} });
      released.forEach((ev: any) => { try { const orderId = ev.args?.[0]?.toString(); const adId = ev.args?.[1] ? ev.args?.[1].toString() : undefined; if (adId) { eventsByAd[adId] = eventsByAd[adId] || {placed:[], released:[]}; eventsByAd[adId].released.push(ev.transactionHash); } } catch {} });
      setAdEventMap(eventsByAd);

    } catch (e) {
      console.error('loadAds error', e);
    }
  }

  const refreshLockedForSelected = async (adId?: string) => {
    try {
      const id = adId || selectedAdId;
      if (!id) return;
      const ad = ads.find(a => a.id === id);
      if (!ad || !ad.token) {
        setSelectedAdLocked(null);
        return;
      }
      setLoadingSelectedLocked(true);
      const res: any = await (readContract as any)({ contract: P2P_ESCROW_CONTRACT as any, method: 'totalLockedForToken', params: [ad.token] }).catch(() => 0n);
      const val = Number((ethers as any).utils.formatUnits(res || 0n, 2));
      setSelectedAdLocked(Number.isFinite(val) ? val : 0);
    } catch (e) {
      console.error('refreshLockedForSelected error', e);
      setSelectedAdLocked(null);
    } finally {
      setLoadingSelectedLocked(false);
    }
  };

  const paymentLabel = (m: string) => {
    switch (m) {
      case 'Asia': return 'اسيا';
      case 'ZainCash': return 'زين كاش';
      case 'Master': return 'ماستر';
      case 'FIRE': return 'فاير';
      default: return m;
    }
  }

  const paymentTokenLabel = (addr?: string) => {
    if (!addr) return 'خارج الشبكة';
    if (addr === '0x0000000000000000000000000000000000000000') return 'خارج الشبكة';
    if (addr.toLowerCase() === FIRE_CONTRACT_ADDRESS.toLowerCase()) return 'فاير';
    if (addr.toLowerCase() === USDT_CONTRACT_ADDRESS.toLowerCase()) return 'USDT';
    return `${addr.slice(0,6)}...${addr.slice(-4)}`;
  }

  const tokenLabel = (addr?: string) => {
    if (!addr) return 'رمز';
    if (addr.toLowerCase() === USDT_CONTRACT_ADDRESS.toLowerCase()) return 'USDT';
    if (addr.toLowerCase() === FIRE_CONTRACT_ADDRESS.toLowerCase()) return 'فاير';
    return `${addr.slice(0,6)}...${addr.slice(-4)}`;
  }

  const openPlaceOrder = (ad: Ad) => {
    setShowPlaceOrder(ad);
    setOrderAmount(ad.minOrderAmount || 1);
  };

  const handlePostAd = async () => {
    if (newAd.type === "sell") {
      const usdtNeeded = newAd.amount;
      const usdtBal = usdtBalance ? Number(usdtBalance.displayValue) : 0;
      if (usdtBal < usdtNeeded) return toast.error("رصيد USDT غير كافٍ");

      try {
        if (!account?.address) return toast.error("Connect wallet");
        setActionLoading("postAd");
        const toastId = toast.loading("Approving USDT...");

        const erc20Abi = [
          "function approve(address spender,uint256 amount) public returns (bool)",
          "function allowance(address owner,address spender) view returns (uint256)"
        ];
        const usdtC = getContract({ client: (USDT_CONTRACT as any)?.client || undefined, chain: BSC_TESTNET, address: USDT_CONTRACT_ADDRESS, abi: erc20Abi as any });
        // token decimals set to 2 (but we approve a very large allowance to avoid repeated approvals)
        const amountWei = parseUnits(String(usdtNeeded), 2);
        // check existing allowance first to avoid approving every time
        try {
          const ownerAddr = account?.address;
          const erc20AbiCheck = ["function allowance(address owner,address spender) view returns (uint256)"];
          const provider = getProviderInstance();
          const readToken = new (ethers as any).Contract(USDT_CONTRACT_ADDRESS, erc20AbiCheck, provider as any);
          const allowance: any = await readToken.allowance(ownerAddr, P2P_ESCROW_CONTRACT_ADDRESS);
          if (bnLt(allowance, amountWei)) {
            const tx = (prepareContractCall as any)({ contract: usdtC as any, method: 'approve', params: [P2P_ESCROW_CONTRACT_ADDRESS, toBigInt(MAX_APPROVAL)] });
            await safeSendTransaction({ transaction: tx, account });
          }
        } catch (err: any) {
          console.error('approve error', err);
          if (isRateLimitError(err)) {
            toast.error('مزود الشبكة مشغول — حاول مرة أخرى لاحقًا');
            setActionLoading(null);
            return;
          }
          throw err;
        }
        toast.loading("Creating ad on-chain...", { id: toastId });

        // Optionally check owner on-chain; skip automatic setter calls to avoid owner-only writes
        try {
          const p2p = P2P_ESCROW_CONTRACT as any;
          const ownerOnChain = await (readContract as any)({ contract: p2p, method: 'owner', params: [] }).catch(() => null);
          // we do not perform owner-only setter calls from the frontend
        } catch (e) {
          // ignore errors and continue
        }
        // map paymentMethod to on-chain payment token address (or zero for off-chain)
        let paymentTokenAddr = ethers.ZeroAddress;
        if (newAd.paymentMethod === 'FIRE') paymentTokenAddr = FIRE_CONTRACT_ADDRESS;
        if (newAd.paymentMethod === 'Asia') paymentTokenAddr = ASIA_TOKEN_ADDRESS && ASIA_TOKEN_ADDRESS !== 'NA' ? ASIA_TOKEN_ADDRESS : ethers.ZeroAddress;
        if (newAd.paymentMethod === 'ZainCash') paymentTokenAddr = ZAIN_TOKEN_ADDRESS && ZAIN_TOKEN_ADDRESS !== 'NA' ? ZAIN_TOKEN_ADDRESS : ethers.ZeroAddress;
        if (newAd.paymentMethod === 'Master') paymentTokenAddr = MASTER_TOKEN_ADDRESS && MASTER_TOKEN_ADDRESS !== 'NA' ? MASTER_TOKEN_ADDRESS : ethers.ZeroAddress;
        const minOrderAmountWei = parseUnits(String(newAd.minOrderAmount || 1), 2);
        const unitPriceWei = parseUnits(String(newAd.unitPrice || 1), 18); // default 1:1 (scaled 1e18)
        const createTx = (prepareContractCall as any)({ contract: P2P_ESCROW_CONTRACT as any, method: 'createAd', params: [USDT_CONTRACT_ADDRESS, toBigInt(amountWei), paymentTokenAddr, toBigInt(minOrderAmountWei), toBigInt(unitPriceWei), newAd.paymentMethod, false] });
        const sent = await safeSendTransaction({ transaction: createTx, account });
        const txHash = (sent as any)?.transactionHash || (sent as any)?.hash || '';
        toast.success((
          <span>
            إعلان منشور — <a href={`${BSC_SCAN_URL}/tx/${txHash}`} target="_blank" rel="noreferrer">عرض على BscScan</a>
          </span>
        ), { id: toastId });

        const ad: Ad = { id: String(adCounter), type: newAd.type, amount: newAd.amount, unitPrice: newAd.unitPrice, minOrderAmount: newAd.minOrderAmount, paymentToken: paymentTokenAddr, token: USDT_CONTRACT_ADDRESS, paymentMethod: newAd.paymentMethod, user: currentUser, description: newAd.description };
        setAds(prev => [...prev, ad]);
        setAdCounter(prev => prev + 1);
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || "خطأ في نشر الإعلان");
      } finally {
        setActionLoading(null);
      }
    } else {
      // buy ad — on-chain: maker deposits paymentToken (escrow) so buyer can sell token instantly
      try {
        if (!account?.address) return toast.error("Connect wallet");
        setActionLoading("postAd");
        const toastId = toast.loading("Approving payment token...");

        // map paymentMethod to on-chain payment token address (must be on-chain for buy ads)
        let paymentTokenAddr = ethers.ZeroAddress;
        if (newAd.paymentMethod === 'FIRE') paymentTokenAddr = FIRE_CONTRACT_ADDRESS;
        if (newAd.paymentMethod === 'Asia') paymentTokenAddr = ASIA_TOKEN_ADDRESS && ASIA_TOKEN_ADDRESS !== 'NA' ? ASIA_TOKEN_ADDRESS : ethers.ZeroAddress;
        if (newAd.paymentMethod === 'ZainCash') paymentTokenAddr = ZAIN_TOKEN_ADDRESS && ZAIN_TOKEN_ADDRESS !== 'NA' ? ZAIN_TOKEN_ADDRESS : ethers.ZeroAddress;
        if (newAd.paymentMethod === 'Master') paymentTokenAddr = MASTER_TOKEN_ADDRESS && MASTER_TOKEN_ADDRESS !== 'NA' ? MASTER_TOKEN_ADDRESS : ethers.ZeroAddress;
        if (paymentTokenAddr === ethers.ZeroAddress) { toast.error('Buy ads require an on-chain payment token'); setActionLoading(null); return; }

        const amountWei = parseUnits(String(newAd.amount), 2);
        const minOrderAmountWei = parseUnits(String(newAd.minOrderAmount || 1), 2);
        const unitPriceWei = parseUnits(String(newAd.unitPrice || 1), 18);
        const paymentTotalWei = bnMulDiv(amountWei, unitPriceWei, "1000000000000000000");

        const erc20Abi = ["function allowance(address owner,address spender) view returns (uint256)", "function approve(address spender,uint256 amount) returns (bool)" ];
        const paymentTokenC = getContract({ client, chain: BSC_TESTNET, address: paymentTokenAddr, abi: erc20Abi as any });
        const ownerAddr = account?.address;
        const provider = getProviderInstance();
        const readToken = new (ethers as any).Contract(paymentTokenAddr, ["function allowance(address owner,address spender) view returns (uint256)"], provider as any);
        const allowance: any = await readToken.allowance(ownerAddr, P2P_ESCROW_CONTRACT_ADDRESS);
        if (bnLt(allowance, paymentTotalWei)) {
          try {
            const paymentContract = getContract({ client, chain: BSC_TESTNET, address: paymentTokenAddr, abi: ["function approve(address spender,uint256 amount) returns (bool)"] as any });
            const tx = (prepareContractCall as any)({ contract: paymentContract as any, method: 'approve', params: [P2P_ESCROW_CONTRACT_ADDRESS, toBigInt(MAX_APPROVAL)] });
            await safeSendTransaction({ transaction: tx, account });
          } catch (err: any) {
            console.error('payment approve error', err);
            if (isRateLimitError(err)) {
              toast.error('مزود الشبكة مشغول — حاول مرة أخرى لاحقًا');
              setActionLoading(null);
              return;
            }
            throw err;
          }
        }

        const p2p = P2P_ESCROW_CONTRACT;
        const createTx = prepareContractCall({ contract: p2p, method: 'createAd', params: [USDT_CONTRACT_ADDRESS, toBigInt(amountWei), paymentTokenAddr, toBigInt(minOrderAmountWei), toBigInt(unitPriceWei), newAd.paymentMethod, true] });
        const sent = await safeSendTransaction({ transaction: createTx, account });
        const txHash = (sent as any)?.transactionHash || (sent as any)?.hash || '';
        toast.success((
          <span>
            إعلان شراء منشور — <a href={`${BSC_SCAN_URL}/tx/${txHash}`} target="_blank" rel="noreferrer">عرض على BscScan</a>
          </span>
        ), { id: toastId });

        const ad: Ad = { id: String(adCounter), type: 'buy', amount: newAd.amount, unitPrice: newAd.unitPrice, minOrderAmount: newAd.minOrderAmount, paymentToken: paymentTokenAddr, lockedPaymentAmount: Number(formatUnits(paymentTotalWei, 18)), token: USDT_CONTRACT_ADDRESS, paymentMethod: newAd.paymentMethod, user: currentUser, description: newAd.description };
        setAds(prev => [...prev, ad]);
        setAdCounter(prev => prev + 1);
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || "خطأ في نشر الإعلان");
      } finally {
        setActionLoading(null);
      }
    }
    setShowPostAd(false);
  };

  const confirmPlaceOrder = async () => {
    if (!showPlaceOrder || !account?.address) return toast.error("Connect wallet");
    const ad = showPlaceOrder;
    if (orderAmount < ad.minOrderAmount || orderAmount > ad.amount) return toast.error("Invalid amount");

    // For sell ads we call placeOrder on-chain
    if (ad.type === "sell") {
      try {
        setActionLoading("placeOrder");
        const toastId = toast.loading("Placing order on-chain...");
        // amount uses token decimals = 2
        const amountWei = parseUnits(String(orderAmount), 2);

        // If payment token is on-chain, ensure allowance via readContract and prepareContractCall
        if (ad.paymentToken && ad.paymentToken !== ethers.ZeroAddress && ad.paymentToken !== "") {
          const unitPriceWei = parseUnits(String(ad.unitPrice || 1), 18);
          const paymentAmountWei = bnMulDiv(amountWei, unitPriceWei, "1000000000000000000");
          // check allowance by reading ERC20 contract directly via provider
          const erc20Abi = ["function allowance(address owner,address spender) view returns (uint256)"];
          const provider = getProviderInstance();
          const token = new (ethers as any).Contract(ad.paymentToken, erc20Abi, provider as any);
          const allowance = await token.allowance(account?.address, P2P_ESCROW_CONTRACT_ADDRESS).catch(() => 0);

          if (bnLt(allowance, paymentAmountWei)) {
            // prepare approve via thirdweb so the connected app wallet signs
            try {
              await retryTx(async () => {
                const payC = getContract({ client, chain: BSC_TESTNET, address: String(ad.paymentToken), abi: ["function approve(address spender,uint256 amount) returns (bool)"] as any });
                const t = (prepareContractCall as any)({ contract: payC as any, method: 'approve', params: [P2P_ESCROW_CONTRACT_ADDRESS, toBigInt(MAX_APPROVAL)] });
                await safeSendTransaction({ transaction: t, account });
              }, 4, 800);
            } catch (err: any) {
              console.error('paymentToken approve error', err);
              if (isRateLimitError(err)) {
                toast.error('مزود الشبكة مشغول — حاول مرة أخرى لاحقًا');
                setActionLoading(null);
                return;
              }
              throw err;
            }
          }
        }

        // call placeOrder on the escrow contract using the connected app wallet
        const prepared = (prepareContractCall as any)({ contract: P2P_ESCROW_CONTRACT as any, method: "placeOrder", params: [BigInt(ad.id), amountWei] });
        const sent = await safeSendTransaction({ transaction: prepared, account });
        const txHash = (sent as any)?.transactionHash || (sent as any)?.hash || '';
        toast.success((
          <span>
            طلب مُقدَّم — <a href={`${BSC_SCAN_URL}/tx/${txHash}`} target="_blank" rel="noreferrer">عرض على BscScan</a>
          </span>
        ), { id: toastId });
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || "خطأ في وضع الطلب");
      } finally {
        setActionLoading(null);
      }
    }

    // If we just placed an on-chain order for a sell ad, consider it settled instantly
    const initialStatus: Order['status'] = ad.type === "sell" ? 'released' : 'pending';
    const order: Order = { id: String(Date.now()), adId: ad.id, buyer: ad.type === "sell" ? currentUser : ad.user, seller: ad.type === "sell" ? ad.user : currentUser, amount: orderAmount, unitPrice: ad.unitPrice, paymentMethod: ad.paymentMethod, status: initialStatus, createdAt: new Date() };
    setOrders(prev => [...prev, order]);
    setCurrentOrder(order);
    setAds(prev => prev.map(a => a.id === ad.id ? { ...a, amount: a.amount - orderAmount } : a));
    setShowPlaceOrder(null);
  };

  const markAsPaid = async () => {
    if (!currentOrder) return;
    if (!account?.address) return toast.error("Connect wallet");
    try {
      setActionLoading("markPaid");
      const toastId = toast.loading("Marking as paid on-chain...");
      const prepared = (prepareContractCall as any)({ contract: P2P_ESCROW_CONTRACT as any, method: "markPaid", params: [BigInt(currentOrder.id)] });
      const sent = await safeSendTransaction({ transaction: prepared, account });
      const txHash = (sent as any)?.transactionHash || (sent as any)?.hash || '';
      toast.success((<span>تم تأكيد الدفع — <a href={`${BSC_SCAN_URL}/tx/${txHash}`} target="_blank" rel="noreferrer">عرض على BscScan</a></span>), { id: toastId });
      setOrders(prev => prev.map(o => o.id === currentOrder.id ? { ...o, status: "paid" } : o));
      setCurrentOrder({ ...currentOrder, status: "paid" });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "خطأ في تأكيد الدفع");
    } finally {
      setActionLoading(null);
    }
  };

  const releaseAssets = async () => {
    if (!currentOrder) return;
    if (!account?.address) return toast.error("Connect wallet");
    try {
      setActionLoading("release");
      const toastId = toast.loading("Releasing on-chain...");
      const prepared = (prepareContractCall as any)({ contract: P2P_ESCROW_CONTRACT as any, method: "release", params: [BigInt(currentOrder.id)] });
      const sent = await safeSendTransaction({ transaction: prepared, account });
      const txHash = (sent as any)?.transactionHash || (sent as any)?.hash || '';
      toast.success((<span>تم الإفراج — <a href={`${BSC_SCAN_URL}/tx/${txHash}`} target="_blank" rel="noreferrer">عرض على BscScan</a></span>), { id: toastId });
      setOrders(prev => prev.map(o => o.id === currentOrder.id ? { ...o, status: "released" } : o));
      setCurrentOrder({ ...currentOrder, status: "released" });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "خطأ في الإفراج");
    } finally {
      setActionLoading(null);
    }
  };

  const reportScammer = async (reason: string) => {
    if (!currentOrder) return;
    if (!account?.address) return toast.error("Connect wallet");
    try {
      setActionLoading("dispute");
      const toastId = toast.loading("Submitting dispute on-chain...");
      const prepared = (prepareContractCall as any)({ contract: P2P_ESCROW_CONTRACT as any, method: "dispute", params: [BigInt(currentOrder.id)] });
      const sent = await safeSendTransaction({ transaction: prepared, account });
      const txHash = (sent as any)?.transactionHash || (sent as any)?.hash || '';
      toast.success((<span>تم الإبلاغ — <a href={`${BSC_SCAN_URL}/tx/${txHash}`} target="_blank" rel="noreferrer">عرض على BscScan</a></span>), { id: toastId });
      setOrders(prev => prev.map(o => o.id === currentOrder.id ? { ...o, status: "disputed" } : o));
      setCurrentOrder({ ...currentOrder, status: "disputed" });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "خطأ في الإبلاغ");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredAds = ads.filter(ad => ad.amount > 0 && (paymentFilter === 'all' || ad.paymentMethod === paymentFilter) && (paymentTokenFilter === 'all' || (ad.paymentToken || '') === paymentTokenFilter));

  return (
    <div dir="rtl" className={`min-h-screen`}>
      <div className="container mx-auto px-3 py-4 sm:py-8 mt-2 sm:mt-4">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2"><ArrowLeftRight className="w-6 h-6" /> تبادل P2P</h1>
          <div />
        </div>

        {/* Top approval prompts to avoid runtime allowance/approve errors */}
        <ApproveForStore tokenAddress={FIRE_CONTRACT_ADDRESS} spenderAddress={P2P_ESCROW_CONTRACT_ADDRESS} tokenLabel="فاير" />
        <ApproveForStore tokenAddress={USDT_CONTRACT_ADDRESS} spenderAddress={P2P_ESCROW_CONTRACT_ADDRESS} tokenLabel="USDT" />

        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <button onClick={() => setShowPostAd(true)} className="bg-white text-black px-3 py-2 rounded-lg flex items-center gap-2 shadow-lg"><Plus className="w-4 h-4" /> نشر إعلان</button>
          <div className="flex items-center gap-3">
            <div>
              <label className="text-sm block mb-1">طريقة الدفع</label>
              <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="p-2 bg-white rounded border border-gray-200 text-sm text-black">
                <option value="all">جميع الطرق</option>
                <option value="Asia">اسيا</option>
                <option value="ZainCash">زين كاش</option>
                <option value="Master">ماستر</option>
                <option value="FIRE">فاير</option>
              </select>
            </div>
            <div>
              <label className="text-sm block mb-1">Token الدفع</label>
              <select value={paymentTokenFilter} onChange={(e) => setPaymentTokenFilter(e.target.value)} className="p-2 bg-white rounded border border-gray-200 text-sm text-black">
                <option value="all">كل</option>
                <option value={FIRE_CONTRACT_ADDRESS}>فاير (on-chain)</option>
                <option value={USDT_CONTRACT_ADDRESS}>USDT (on-chain)</option>
                <option value="0x0000000000000000000000000000000000000000">خارج الشبكة</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAds.map(ad => (
            <div
              key={ad.id}
              className={`p-4 rounded-xl shadow-lg border ${ad.type === 'buy' ? 'border-green-500/30 bg-gradient-to-br from-green-900/5 to-transparent' : 'border-red-500/30 bg-gradient-to-br from-red-900/5 to-transparent'}`}
            >
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${ad.type === 'buy' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                    {ad.type === 'sell' ? 'بيع' : 'شراء'}
                  </span>
                  <div className={`text-sm ${theme === 'light' ? 'text-gray-800' : 'text-white/80'}`}>{paymentLabel(ad.paymentMethod)}</div>
                </div>
                <div className={`text-xs ${theme === 'light' ? 'text-gray-600' : 'text-white/60'}`}>{tokenLabel(ad.token)}</div>
              </div>

              <div className={`mb-3 text-sm ${theme === 'light' ? 'text-gray-800' : 'text-white/80'}`}>الكمية: <span className="font-semibold">{ad.amount} {tokenLabel(ad.token)}</span></div>

              <div className="mb-3 flex items-baseline justify-between">
                <div>
                    <div className={`text-2xl sm:text-3xl font-bold ${ad.type === 'buy' ? 'text-green-600' : 'text-red-600'}`}>
                    {ad.unitPrice}
                    <span className={`text-sm ml-2 ${theme === 'light' ? 'text-gray-700' : 'text-white/70'}`}>{paymentTokenLabel(ad.paymentToken)}</span>
                  </div>
                  <div className={`${theme === 'light' ? 'text-gray-600' : 'text-white/50'} text-xs mt-1`}>الحد الأدنى: {ad.minOrderAmount} USDT</div>
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => openPlaceOrder(ad)} className="bg-blue-600 px-3 py-1.5 rounded-lg text-sm">وضع طلب</button>
                  <button onClick={() => setSelectedAdId(ad.id)} className={
                    theme === 'light'
                      ? 'px-3 py-1.5 rounded-lg text-sm border border-gray-200 bg-white/50 hover:bg-gray-100'
                      : 'px-3 py-1.5 rounded-lg text-sm border border-white/10 bg-white/3 hover:bg-white/6'
                  }>تفاصيل</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {showPostAd && (
          <div className={`${theme === 'light' ? 'fixed inset-0 bg-white/60' : 'fixed inset-0 bg-black/60'} flex items-center justify-center px-3`}>
            <div className={`${theme === 'light' ? 'bg-white text-black' : 'bg-gray-900 text-white'} p-4 sm:p-6 rounded-xl w-full max-w-md shadow-lg border`}>
              <h2 className="mb-4 text-lg sm:text-xl font-semibold">نشر إعلان</h2>
              <label className="text-sm block mb-1">نوع الإعلان</label>
              <select value={newAd.type} onChange={e => setNewAd({ ...newAd, type: e.target.value as any })} className="w-full mb-2 p-2 bg-gray-800 rounded">
                <option value="sell">بيع USDT</option>
                <option value="buy">شراء USDT</option>
              </select>
              <label className="text-sm block mb-1">طريقة الدفع</label>
              <select value={newAd.paymentMethod} onChange={e => setNewAd({ ...newAd, paymentMethod: e.target.value })} className="w-full mb-2 p-2 bg-gray-800 rounded">
                <option value="Asia">اسيا</option>
                <option value="ZainCash">زين كاش</option>
                <option value="Master">ماستر</option>
                <option value="FIRE">فاير</option>
              </select>
              <input type="number" value={newAd.amount || ''} onChange={e => setNewAd({ ...newAd, amount: Number(e.target.value) })} placeholder="الكمية (USDT)" className="w-full mb-2 p-2 bg-gray-800 rounded" />
              <label className="text-sm block mb-1">سعر الوحدة (مثال: 1.50)</label>
              <input type="number" step="0.01" value={newAd.unitPrice || ''} onChange={e => setNewAd({ ...newAd, unitPrice: Number(e.target.value) })} placeholder="سعر الوحدة" className="w-full mb-2 p-2 bg-gray-800 rounded" />
              <label className="text-sm block mb-1">الحد الأدنى للطلب</label>
              <input type="number" min={1} value={newAd.minOrderAmount || ''} onChange={e => setNewAd({ ...newAd, minOrderAmount: Number(e.target.value) })} placeholder="الحد الأدنى للطلب" className="w-full mb-2 p-2 bg-gray-800 rounded" />
              <textarea value={newAd.description} onChange={e => setNewAd({ ...newAd, description: e.target.value })} placeholder="الوصف" className="w-full mb-4 p-2 bg-gray-800 rounded" />
              <div className="flex gap-2">
                <button onClick={handlePostAd} className="bg-green-600 px-3 py-2 rounded-lg">نشر</button>
                <button onClick={() => setShowPostAd(false)} className={theme === 'light' ? 'bg-gray-100 px-3 py-2 rounded-lg text-black' : 'bg-gray-700 px-3 py-2 rounded-lg'}>إلغاء</button>
              </div>
            </div>
          </div>
        )}

        {showPlaceOrder && (
          <div className={`${theme === 'light' ? 'fixed inset-0 bg-white/60' : 'fixed inset-0 bg-black/60'} flex items-center justify-center px-3`}>
            <div className={`${theme === 'light' ? 'bg-white text-black' : 'bg-gray-900 text-white'} p-4 sm:p-6 rounded-xl w-full max-w-md shadow-lg border`}>
              <h2 className="mb-2 text-lg sm:text-xl font-semibold">وضع طلب</h2>
              <div className="mb-2">الكمية المتاحة: <span className="font-semibold">{showPlaceOrder.amount} {tokenLabel(showPlaceOrder.token)}</span></div>
              <div className="mb-2">
                سعر الوحدة:
                <div className={`inline-block ml-2 text-2xl font-bold ${showPlaceOrder.type === 'buy' ? 'text-green-600' : 'text-red-600'}`}>
                  {showPlaceOrder.unitPrice}
                  <span className={`text-sm ml-2 ${theme === 'light' ? 'text-gray-700' : 'text-white/70'}`}>{paymentTokenLabel(showPlaceOrder.paymentToken)}</span>
                </div>
              </div>
              <input type="number" min={showPlaceOrder.minOrderAmount} max={showPlaceOrder.amount} value={orderAmount} onChange={e => setOrderAmount(Number(e.target.value))} className={`w-full mb-4 p-2 rounded ${theme === 'light' ? 'bg-gray-100 text-black' : 'bg-gray-800 text-white'}`} />
              <div className="flex gap-2">
                <button onClick={confirmPlaceOrder} className="bg-green-600 px-3 py-2 rounded-lg">تأكيد</button>
                <button onClick={() => setShowPlaceOrder(null)} className={theme === 'light' ? 'bg-gray-100 px-3 py-2 rounded-lg text-black' : 'bg-gray-700 px-3 py-2 rounded-lg'}>إلغاء</button>
              </div>
            </div>
          </div>
        )}

        {currentOrder && (
          <div className={`${theme === 'light' ? 'fixed inset-0 bg-white/60' : 'fixed inset-0 bg-black/60'} flex items-center justify-center px-3`}>
            <div className={`${theme === 'light' ? 'bg-white text-black' : 'bg-gray-900 text-white'} p-4 sm:p-6 rounded-xl w-full max-w-2xl shadow-lg border`}>
              <h2 className="font-semibold mb-2 text-lg">الطلب {currentOrder.id}</h2>
              <div className="mb-2">الكمية: <span className="font-semibold">{currentOrder.amount} USDT</span></div>
              <div className="mb-2">الإجمالي: <span className="font-semibold">{(currentOrder.amount * currentOrder.unitPrice).toFixed(2)} {paymentLabel(currentOrder.paymentMethod)}</span></div>
              <div className="mb-4">الحالة: {currentOrder.status === 'pending' ? 'في الانتظار' : currentOrder.status === 'paid' ? 'مدفوع' : currentOrder.status === 'released' ? 'مفرج عنه' : 'متنازع عليه'}</div>
              <div className="flex gap-2">
                {currentOrder.status === 'pending' && (
                  <button onClick={() => reportScammer('scam')} className="bg-red-600 px-3 py-2 rounded-lg">الإبلاغ</button>
                )}
                <button onClick={() => setCurrentOrder(null)} className={theme === 'light' ? 'bg-gray-100 px-3 py-2 rounded-lg text-black' : 'bg-gray-700 px-3 py-2 rounded-lg'}>إغلاق</button>
              </div>
            </div>
          </div>
        )}
        {selectedAdId && (
          <div className={`${theme === 'light' ? 'fixed inset-0 bg-white/60' : 'fixed inset-0 bg-black/60'} flex items-center justify-center px-3 z-40`}>
            <div className={`${theme === 'light' ? 'relative bg-white text-black' : 'relative bg-gray-900 text-white'} p-4 sm:p-6 rounded-xl w-full max-w-md shadow-lg border`}>
              <button onClick={() => setSelectedAdId(null)} aria-label="إغلاق" className={theme === 'light' ? 'absolute -top-3 right-3 bg-white border border-gray-200 text-black rounded-full p-2 shadow' : 'absolute -top-3 right-3 bg-gray-800 hover:bg-gray-700 text-white rounded-full p-2 shadow'}>✕</button>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold mb-3">تفاصيل الإعلان #{selectedAdId}</h3>
                <button onClick={() => refreshLockedForSelected(selectedAdId || undefined)} title="تحديث المحجوز" className={theme === 'light' ? 'text-sm text-gray-600 hover:text-gray-800' : 'text-sm text-white/60 hover:text-white'}>
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>
              <div className={`mb-3 text-sm ${theme === 'light' ? 'text-gray-800' : 'text-white/80'}`}>
                {adTxMap[selectedAdId] ? (
                  <div>إنشاء الإعلان: <a className="text-blue-400" href={`${BSC_SCAN_URL}/tx/${adTxMap[selectedAdId]}`} target="_blank" rel="noreferrer">عرض على BscScan</a></div>
                ) : <div>لا يوجد سجل إنشاء.</div>}
              </div>
              <div className={`text-sm mb-3 ${theme === 'light' ? 'text-gray-700' : 'text-white/70'}`}>
                القيمة المحجوزة حالياً للعقد: {loadingSelectedLocked ? 'جارٍ التحديث...' : (selectedAdLocked !== null ? `${selectedAdLocked.toFixed(2)} USDT` : 'N/A')}
              </div>
              <div className="mb-3">
                <h4 className="font-medium mb-2">طلبات وإفراجات مرتبطة</h4>
                {adEventMap[selectedAdId] ? (
                  <div className="space-y-2 text-sm">
                    {adEventMap[selectedAdId].placed.map((tx, i) => (
                      <div key={i}>وضع طلب: <a className="text-blue-400" href={`${BSC_SCAN_URL}/tx/${tx}`} target="_blank" rel="noreferrer">{tx}</a></div>
                    ))}
                    {adEventMap[selectedAdId].released.map((tx, i) => (
                      <div key={`r-${i}`}>إفراج: <a className="text-blue-400" href={`${BSC_SCAN_URL}/tx/${tx}`} target="_blank" rel="noreferrer">{tx}</a></div>
                    ))}
                  </div>
                ) : <div className="text-sm">لا توجد طلبات مرتبطة بعد.</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
