"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import { getContract, readContract, prepareContractCall } from "thirdweb";
import { safeSendTransaction } from "../util/safeSend";
import { ethers } from "ethers";
import { BSC_TESTNET, FIRE_CONTRACT_ADDRESS, USDT_CONTRACT_ADDRESS, FIRE_DIVIDEND_DISTRIBUTOR_ADDRESS, FIRE_REWARDS_CONTRACT_ADDRESS, P2P_ESCROW_CONTRACT } from "../const/addresses";
import { client } from "../client";
import toast from "react-hot-toast";
import toastStyle from "../util/toastConfig";

// Secret admin key (change this to your own secret)
// IMPORTANT: In production, use proper authentication (e.g., auth0, jwt, nextauth)
const ADMIN_SECRET = "FIRE";

const FIRE_ABI = [
  { type: "function", name: "usdt", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "firePerUSDT", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "firePerBNB", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "setRates", stateMutability: "nonpayable", inputs: [{ name: "_firePerUSDT", type: "uint256" }, { name: "_firePerBNB", type: "uint256" }], outputs: [] },
  { type: "function", name: "setFees", stateMutability: "nonpayable", inputs: [{ name: "d", type: "uint256" }, { name: "m", type: "uint256" }, { name: "t", type: "uint256" }, { name: "r", type: "uint256" }], outputs: [] },
  { type: "function", name: "setFeeWallets", stateMutability: "nonpayable", inputs: [{ name: "d", type: "address" }, { name: "m", type: "address" }, { name: "t", type: "address" }], outputs: [] },
  { type: "function", name: "setRewardsContract", stateMutability: "nonpayable", inputs: [{ name: "r", type: "address" }], outputs: [] },
  { type: "function", name: "setExcludedFromFees", stateMutability: "nonpayable", inputs: [{ name: "a", type: "address" }, { name: "b", type: "bool" }], outputs: [] },
  { type: "function", name: "enableTrading", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "buyFIRE", stateMutability: "nonpayable", inputs: [{ name: "usdtAmount", type: "uint256" }], outputs: [] },
  { type: "function", name: "sellFIRE", stateMutability: "nonpayable", inputs: [{ name: "fireAmount", type: "uint256" }], outputs: [] },
  { type: "function", name: "buyGasWithFIRE", stateMutability: "nonpayable", inputs: [{ name: "fireAmount", type: "uint256" }], outputs: [] },
  { type: "function", name: "rescueBNB", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "rescueToken", stateMutability: "nonpayable", inputs: [{ name: "token", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
];

const USDT_ABI = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
];

const DISTRIBUTOR_ABI = [
  { type: "function", name: "usdtPerBNB", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "setUSDTPerBNB", stateMutability: "nonpayable", inputs: [{ name: "rate", type: "uint256" }], outputs: [] },
  { type: "function", name: "fundUSDT", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "buyGasWithUSDT", stateMutability: "nonpayable", inputs: [{ name: "usdtAmount", type: "uint256" }], outputs: [] },
  { type: "function", name: "setExcludedFromRewards", stateMutability: "nonpayable", inputs: [{ name: "account", type: "address" }, { name: "excluded", type: "bool" }], outputs: [] },
  { type: "function", name: "rescueBNB", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "rescueToken", stateMutability: "nonpayable", inputs: [{ name: "token", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
];

export default function AdminPage() {
  const router = useRouter();
  const account = useActiveAccount();
  const [authenticated, setAuthenticated] = useState(false);
  const [secretInput, setSecretInput] = useState("");
  const [loading, setLoading] = useState(false);

  // State for displays
  const [accumulatedFireFees, setAccumulatedFireFees] = useState<bigint | null>(null);
  const [distributorUsdtBalance, setDistributorUsdtBalance] = useState<bigint | null>(null);
  const [feesWalletAddress, setFeesWalletAddress] = useState<string | null>(null);
  const [contractFireBalance, setContractFireBalance] = useState<bigint | null>(null);
  const [fireDecimals, setFireDecimals] = useState(2);
  const [usdtDecimals, setUsdtDecimals] = useState(6);
  const [contractUsdtBalance, setContractUsdtBalance] = useState<bigint | null>(null);
  const [usdtTokenAddr, setUsdtTokenAddr] = useState<string | null>(null);
  const [fireRate, setFireRate] = useState<bigint | null>(null);
  const [rateDecimalsState, setRateDecimalsState] = useState<number | null>(null);
  const [pendingUsdt, setPendingUsdt] = useState<bigint | null>(null);
  const [totalAccrued, setTotalAccrued] = useState<bigint | null>(null);
  const [totalClaimed, setTotalClaimed] = useState<bigint | null>(null);
  const [bnbPrice, setBnbPrice] = useState<bigint | null>(null);
  const [eligibleSupply, setEligibleSupply] = useState<bigint | null>(null);

  // P2P token addresses
  const [p2pUsdt, setP2pUsdt] = useState<string | null>(null);
  const [p2pAsia, setP2pAsia] = useState<string | null>(null);
  const [p2pZain, setP2pZain] = useState<string | null>(null);
  const [p2pMaster, setP2pMaster] = useState<string | null>(null);
  const [p2pFire, setP2pFire] = useState<string | null>(null);
  const [setP2pUsdtInput, setSetP2pUsdtInput] = useState("");
  const [setP2pAsiaInput, setSetP2pAsiaInput] = useState("");
  const [setP2pZainInput, setSetP2pZainInput] = useState("");
  const [setP2pMasterInput, setSetP2pMasterInput] = useState("");
  const [setP2pFireInput, setSetP2pFireInput] = useState("");

  // Inputs for new actions
  const [setUsdtInput, setSetUsdtInput] = useState("");
  const [setRateInput, setSetRateInput] = useState("");
  const [setRateDecimalsInput, setSetRateDecimalsInput] = useState(0);
  const [setMaticPriceInput, setSetMaticPriceInput] = useState("");
  const [withdrawUsdtTo, setWithdrawUsdtTo] = useState("");
  const [withdrawUsdtAmount, setWithdrawUsdtAmount] = useState("");

  // State for actions
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [feeRateBps, setFeeRateBps] = useState("200");
  const [fundAmount, setFundAmount] = useState("");
  const [fundBnbAmount, setFundBnbAmount] = useState("");
  const [distributeAmount, setDistributeAmount] = useState("");
  const [excludeAddress, setExcludeAddress] = useState("");
  const [excludeState, setExcludeState] = useState(false);
  const [excludeDevAddr, setExcludeDevAddr] = useState("");
  const [excludeDevState, setExcludeDevState] = useState(false);
  const [excludeHoldersAddr, setExcludeHoldersAddr] = useState("");
  const [excludeHoldersState, setExcludeHoldersState] = useState(false);
  const [feesWalletInput, setFeesWalletInput] = useState("");
  const [topUpFireAmount, setTopUpFireAmount] = useState("");

  // Verify secret
  function handleVerify() {
    if (secretInput === ADMIN_SECRET) {
      setAuthenticated(true);
      setSecretInput("");
      loadData();
    } else {
      toast.error("Incorrect secret", { style: toastStyle, position: "bottom-center" });
    }
  }

  // Load data
  async function loadData() {
    try {
      setLoading(true);
      const fireC = getContract({ client, chain: BSC_TESTNET, address: FIRE_CONTRACT_ADDRESS, abi: FIRE_ABI as any });
      const usdtC = getContract({ client, chain: BSC_TESTNET, address: USDT_CONTRACT_ADDRESS, abi: USDT_ABI as any });
      const distC = getContract({ client, chain: BSC_TESTNET, address: FIRE_DIVIDEND_DISTRIBUTOR_ADDRESS, abi: DISTRIBUTOR_ABI as any });

      const [
        fees,
        dist,
        fd,
        ud,
        fw,
        contractBal,
        contractUsdtBal,
        usdtTok,
        rate,
        rdec,
        pend,
        accrued,
        claimed,
        bnbP,
        elig
      ] = await Promise.all([
        readContract({ contract: fireC, method: "accumulatedFees", params: [] }) as Promise<bigint>,
        readContract({ contract: usdtC, method: "balanceOf", params: [FIRE_DIVIDEND_DISTRIBUTOR_ADDRESS] }) as Promise<bigint>,
        readContract({ contract: fireC, method: "decimals", params: [] }) as Promise<number>,
        readContract({ contract: usdtC, method: "decimals", params: [] }) as Promise<number>,
        readContract({ contract: fireC, method: "feesWallet", params: [] }) as Promise<string>,
        readContract({ contract: fireC, method: "balanceOf", params: [FIRE_DIVIDEND_DISTRIBUTOR_ADDRESS] }) as Promise<bigint>,
        // contract USDT balance
        readContract({ contract: usdtC, method: "balanceOf", params: [FIRE_CONTRACT_ADDRESS] }) as Promise<bigint>,
        readContract({ contract: fireC, method: "usdtToken", params: [] }) as Promise<string>,
        readContract({ contract: fireC, method: "fireToUsdtRate", params: [] }) as Promise<bigint>,
        readContract({ contract: fireC, method: "rateDecimals", params: [] }) as Promise<number>,
        readContract({ contract: fireC, method: "pendingUSDT", params: [] }) as Promise<bigint>,
        readContract({ contract: fireC, method: "totalAccruedUSDT", params: [] }) as Promise<bigint>,
        readContract({ contract: fireC, method: "totalClaimedUSDT", params: [] }) as Promise<bigint>,
        readContract({ contract: distC, method: "usdtPerBNB", params: [] }) as Promise<bigint>,
        readContract({ contract: fireC, method: "getEligibleSupply", params: [] }) as Promise<bigint>,
      ]);

      setAccumulatedFireFees(fees);
      setDistributorUsdtBalance(dist);
      setFireDecimals(fd);
      setUsdtDecimals(ud);
      setFeesWalletAddress(fw);
      setContractFireBalance(contractBal);
      setContractUsdtBalance(contractUsdtBal);
      setUsdtTokenAddr(usdtTok);
      setFireRate(rate);
      setRateDecimalsState(rdec);
      setPendingUsdt(pend);
      setTotalAccrued(accrued);
      setTotalClaimed(claimed);
      setBnbPrice(bnbP);
      setEligibleSupply(elig);
      // load P2P addresses
      try {
        const p2pC = P2P_ESCROW_CONTRACT;
        const [u,a,z,m,f] = await Promise.all([
          readContract({ contract: p2pC, method: "usdtAddress", params: [] }) as Promise<string>,
          readContract({ contract: p2pC, method: "asiaAddress", params: [] }) as Promise<string>,
          readContract({ contract: p2pC, method: "zainAddress", params: [] }) as Promise<string>,
          readContract({ contract: p2pC, method: "masterAddress", params: [] }) as Promise<string>,
          readContract({ contract: p2pC, method: "fireAddress", params: [] }) as Promise<string>
        ]);
        setP2pUsdt(u);
        setP2pAsia(a);
        setP2pZain(z);
        setP2pMaster(m);
        setP2pFire(f);
      } catch (e) { console.debug('p2p load error', e); }
    } catch (e) {
      console.error("load data error", e);
      toast.error("Failed to load data", { style: toastStyle, position: "bottom-center" });
    } finally {
      setLoading(false);
    }
  }

  const handleSetFeesWallet = async () => {
    if (!feesWalletInput || !account?.address) { toast.error("أدخل العنوان", { style: toastStyle, position: "bottom-center" }); return; }
    try {
      setLoading(true);
      const fireC = getContract({ client, chain: BSC_TESTNET, address: FIRE_CONTRACT_ADDRESS, abi: FIRE_ABI as any });
      const tx = prepareContractCall({ contract: fireC, method: "setFeesWallet", params: [feesWalletInput] });
      await safeSendTransaction({ transaction: tx, account });
      toast.success("تم تعيين محفظة الرسوم", { style: toastStyle, position: "bottom-center" });
      setFeesWalletInput("");
      await loadData();
    } catch (e) { toast.error(`Error: ${(e as any)?.message || "unknown"}`, { style: toastStyle, position: "bottom-center" }); }
    finally { setLoading(false); }
  };

  const handleTopUpFire = async () => {
    if (!topUpFireAmount || !account?.address) { toast.error("أدخل المبلغ واتصل بالمحفظة", { style: toastStyle, position: "bottom-center" }); return; }
    try {
      setLoading(true);
      const fireC = getContract({ client, chain: BSC_TESTNET, address: FIRE_CONTRACT_ADDRESS, abi: FIRE_ABI as any });
      const amt = BigInt(topUpFireAmount) * BigInt(10) ** BigInt(fireDecimals);
      // owner will call transfer to move FIRE to contract
      const tx = prepareContractCall({ contract: fireC, method: "transfer", params: [FIRE_DIVIDEND_DISTRIBUTOR_ADDRESS, amt] });
      await safeSendTransaction({ transaction: tx, account });
      toast.success("تم تحويل FIRE إلى العقد", { style: toastStyle, position: "bottom-center" });
      setTopUpFireAmount("");
      await loadData();
    } catch (e) { toast.error(`Error: ${(e as any)?.message || "unknown"}`, { style: toastStyle, position: "bottom-center" }); }
    finally { setLoading(false); }
  };

  const handleSetUSDTToken = async () => {
    if (!setUsdtInput || !account?.address) { toast.error("Enter rewards contract address", { style: toastStyle, position: "bottom-center" }); return; }
    try {
      setLoading(true);
      const fireC = getContract({ client, chain: BSC_TESTNET, address: FIRE_CONTRACT_ADDRESS, abi: FIRE_ABI as any });
      const tx = prepareContractCall({ contract: fireC, method: "setRewardsContract", params: [setUsdtInput] });
      await safeSendTransaction({ transaction: tx, account });
      toast.success("Rewards contract set", { style: toastStyle, position: "bottom-center" });
      setSetUsdtInput("");
      await loadData();
    } catch (e) { toast.error(`Error: ${(e as any)?.message || "unknown"}`, { style: toastStyle, position: "bottom-center" }); }
    finally { setLoading(false); }
  };

  const handleSetRate = async () => {
    if (!setRateInput || !account?.address) { toast.error("Enter rate", { style: toastStyle, position: "bottom-center" }); return; }
    try {
      setLoading(true);
      const fireC = getContract({ client, chain: BSC_TESTNET, address: FIRE_CONTRACT_ADDRESS, abi: FIRE_ABI as any });
      // parse the human FIRE->USDT rate into firePerUSDT (scaled 1e18)
      const firePerUSDT = ethers.utils.parseUnits(String(setRateInput), 18);
      // keep current firePerBNB value
      const currentFirePerBNB: bigint = await readContract({ contract: fireC, method: "firePerBNB", params: [] }) as any;
      const tx = prepareContractCall({ contract: fireC, method: "setRates", params: [BigInt(firePerUSDT.toString()), currentFirePerBNB] });
      await safeSendTransaction({ transaction: tx, account });
      toast.success("Rate set", { style: toastStyle, position: "bottom-center" });
      setSetRateInput(""); setSetRateDecimalsInput(0);
      await loadData();
    } catch (e) { toast.error(`Error: ${(e as any)?.message || "unknown"}`, { style: toastStyle, position: "bottom-center" }); }
    finally { setLoading(false); }
  };

  const handleSetMaticPrice = async () => {
    if (!setMaticPriceInput || !account?.address) { toast.error("Enter BNB price in USDT (e.g. 0.5)", { style: toastStyle, position: "bottom-center" }); return; }
    try {
      setLoading(true);
      const distC = getContract({ client, chain: BSC_TESTNET, address: FIRE_REWARDS_CONTRACT_ADDRESS, abi: DISTRIBUTOR_ABI as any });
      const bn = ethers.utils.parseUnits(String(setMaticPriceInput), 18);
      const scaled = BigInt(bn.toString());
      const tx = prepareContractCall({ contract: distC, method: "setUSDTPerBNB", params: [scaled] });
      await safeSendTransaction({ transaction: tx, account });
      toast.success("BNB price set", { style: toastStyle, position: "bottom-center" });
      setSetMaticPriceInput("");
      await loadData();
    } catch (e) { toast.error(`Error: ${(e as any)?.message || "unknown"}`, { style: toastStyle, position: "bottom-center" }); }
    finally { setLoading(false); }
  };

  const handleWithdrawUSDT = async () => {
    if (!withdrawUsdtAmount || !account?.address) { toast.error("Enter amount", { style: toastStyle, position: "bottom-center" }); return; }
    try {
      setLoading(true);
      const fireC = getContract({ client, chain: BSC_TESTNET, address: FIRE_CONTRACT_ADDRESS, abi: FIRE_ABI as any });
      const amt = BigInt(withdrawUsdtAmount) * BigInt(10) ** BigInt(usdtDecimals);
      // rescueToken transfers the token to the contract owner
      const tx = prepareContractCall({ contract: fireC, method: "rescueToken", params: [USDT_CONTRACT_ADDRESS, amt] });
      await safeSendTransaction({ transaction: tx, account });
      toast.success("USDT withdrawn to owner", { style: toastStyle, position: "bottom-center" });
      setWithdrawUsdtAmount("");
      await loadData();
    } catch (e) { toast.error(`Error: ${(e as any)?.message || "unknown"}`, { style: toastStyle, position: "bottom-center" }); }
    finally { setLoading(false); }
  };

  function formatAmount(raw: bigint, decimals: number) {
    const whole = raw / BigInt(10) ** BigInt(decimals);
    const frac = raw % (BigInt(10) ** BigInt(decimals));
    if (frac === 0n) return whole.toString();
    return `${whole}.${frac.toString().padStart(decimals, "0").slice(0, 6).replace(/0+$/, "")}`;
  }

  // Actions
  const handleWithdrawFees = async () => {
    if (!withdrawAmount || !account?.address) {
      toast.error("Enter amount and connect wallet", { style: toastStyle, position: "bottom-center" });
      return;
    }
    try {
      setLoading(true);
      const fireC = getContract({ client, chain: BSC_TESTNET, address: FIRE_CONTRACT_ADDRESS, abi: FIRE_ABI as any });
      const amt = BigInt(withdrawAmount) * BigInt(10) ** BigInt(fireDecimals);
      // Rescue FIRE tokens to owner (rescueToken)
      const tx = prepareContractCall({ contract: fireC, method: "rescueToken", params: [FIRE_CONTRACT_ADDRESS, amt] });
      await safeSendTransaction({ transaction: tx, account });
      toast.success("Fees (FIRE) rescued to owner", { style: toastStyle, position: "bottom-center" });
      setWithdrawAmount("");
      await loadData();
    } catch (e) {
      toast.error(`Error: ${(e as any)?.message || "unknown"}`, { style: toastStyle, position: "bottom-center" });
    } finally {
      setLoading(false);
    }
  };

  const handleSetFeeRate = async () => {
    if (!account?.address) return;
    try {
      setLoading(true);
      const fireC = getContract({ client, chain: BSC_TESTNET, address: FIRE_CONTRACT_ADDRESS, abi: FIRE_ABI as any });
      const bps = parseInt(feeRateBps) || 0;
      const tx = prepareContractCall({ contract: fireC, method: "setTransferFeeBps", params: [bps] });
      await safeSendTransaction({ transaction: tx, account });
      toast.success("Fee rate updated", { style: toastStyle, position: "bottom-center" });
    } catch (e) {
      toast.error(`Error: ${(e as any)?.message || "unknown"}`, { style: toastStyle, position: "bottom-center" });
    } finally {
      setLoading(false);
    }
  };

  const handleEnableTrading = async () => {
    if (!account?.address) return;
    try {
      setLoading(true);
      const fireC = getContract({ client, chain: BSC_TESTNET, address: FIRE_CONTRACT_ADDRESS, abi: FIRE_ABI as any });
      const tx = prepareContractCall({ contract: fireC, method: "enableTrading", params: [] });
      await safeSendTransaction({ transaction: tx, account });
      toast.success("Trading enabled", { style: toastStyle, position: "bottom-center" });
    } catch (e) {
      toast.error(`Error: ${(e as any)?.message || "unknown"}`, { style: toastStyle, position: "bottom-center" });
    } finally {
      setLoading(false);
    }
  };

  const handleFundUSDT = async () => {
    if (!fundAmount || !account?.address) {
      toast.error("Enter amount and connect wallet", { style: toastStyle, position: "bottom-center" });
      return;
    }
    try {
      setLoading(true);
      const usdtC = getContract({ client, chain: BSC_TESTNET, address: USDT_CONTRACT_ADDRESS, abi: USDT_ABI as any });
      const distC = getContract({ client, chain: BSC_TESTNET, address: FIRE_DIVIDEND_DISTRIBUTOR_ADDRESS, abi: DISTRIBUTOR_ABI as any });
      const amt = BigInt(fundAmount) * BigInt(10) ** BigInt(usdtDecimals);
      // First approve
      const approveTx = prepareContractCall({ contract: usdtC, method: "approve", params: [FIRE_DIVIDEND_DISTRIBUTOR_ADDRESS, amt] });
      await safeSendTransaction({ transaction: approveTx, account });
      toast.loading("Funding...", { id: "fund", style: toastStyle, position: "bottom-center" });
      // Then fund
      const fundTx = prepareContractCall({ contract: distC, method: "fundUSDT", params: [amt] });
      await safeSendTransaction({ transaction: fundTx, account });
      toast.success("USDT funded", { id: "fund", style: toastStyle, position: "bottom-center" });
      setFundAmount("");
      await loadData();
    } catch (e) {
      toast.error(`Error: ${(e as any)?.message || "unknown"}`, { id: "fund", style: toastStyle, position: "bottom-center" });
    } finally {
      setLoading(false);
    }
  };

  const handleFundPOL = async () => {
    if (!fundBnbAmount || !account?.address) {
      toast.error("Enter BNB amount and connect wallet", { style: toastStyle, position: "bottom-center" });
      return;
    }
    try {
      setLoading(true);
      // parse BNB amount to wei
      const weiBn = ethers.utils.parseEther(String(fundBnbAmount || "0"));
      const weiBigInt = BigInt(weiBn.toString());
      // send native BNB directly to FireRewards contract (receive() payable)
      const txObj = { to: FIRE_REWARDS_CONTRACT_ADDRESS, value: weiBn.toString() } as any;
      await safeSendTransaction({ transaction: txObj, account });
      toast.success("تمت إضافة BNB إلى العقد", { style: toastStyle, position: "bottom-center" });
      setFundBnbAmount("");
      await loadData();
    } catch (e) {
      toast.error(`Error: ${(e as any)?.message || "unknown"}`, { style: toastStyle, position: "bottom-center" });
    } finally { setLoading(false); }
  };

  // P2P setters
  const handleSetP2pUsdt = async () => {
    if (!setP2pUsdtInput || !account?.address) { toast.error("Enter address"); return; }
    try {
      setLoading(true);
      const p2pC = P2P_ESCROW_CONTRACT;
      const tx = prepareContractCall({ contract: p2pC, method: "setUsdtAddress", params: [setP2pUsdtInput] });
      await safeSendTransaction({ transaction: tx, account });
      toast.success("P2P USDT address set");
      setSetP2pUsdtInput("");
      await loadData();
    } catch (e) { toast.error(`Error: ${(e as any)?.message || 'unknown'}`); } finally { setLoading(false); }
  };

  const handleSetP2pAsia = async () => {
    if (!setP2pAsiaInput || !account?.address) { toast.error("Enter address"); return; }
    try { setLoading(true); const p2pC = P2P_ESCROW_CONTRACT; const tx = prepareContractCall({ contract: p2pC, method: "setAsiaAddress", params: [setP2pAsiaInput] }); await safeSendTransaction({ transaction: tx, account }); toast.success("P2P ASIA address set"); setSetP2pAsiaInput(""); await loadData(); } catch (e) { toast.error(`Error: ${(e as any)?.message || 'unknown'}`); } finally { setLoading(false); }
  };

  const handleSetP2pZain = async () => {
    if (!setP2pZainInput || !account?.address) { toast.error("Enter address"); return; }
    try { setLoading(true); const p2pC = P2P_ESCROW_CONTRACT; const tx = prepareContractCall({ contract: p2pC, method: "setZainAddress", params: [setP2pZainInput] }); await safeSendTransaction({ transaction: tx, account }); toast.success("P2P ZAIN address set"); setSetP2pZainInput(""); await loadData(); } catch (e) { toast.error(`Error: ${(e as any)?.message || 'unknown'}`); } finally { setLoading(false); }
  };

  const handleSetP2pMaster = async () => {
    if (!setP2pMasterInput || !account?.address) { toast.error("Enter address"); return; }
    try { setLoading(true); const p2pC = P2P_ESCROW_CONTRACT; const tx = prepareContractCall({ contract: p2pC, method: "setMasterAddress", params: [setP2pMasterInput] }); await safeSendTransaction({ transaction: tx, account }); toast.success("P2P MASTER address set"); setSetP2pMasterInput(""); await loadData(); } catch (e) { toast.error(`Error: ${(e as any)?.message || 'unknown'}`); } finally { setLoading(false); }
  };

  const handleSetP2pFire = async () => {
    if (!setP2pFireInput || !account?.address) { toast.error("Enter address"); return; }
    try { setLoading(true); const p2pC = P2P_ESCROW_CONTRACT; const tx = prepareContractCall({ contract: p2pC, method: "setFireAddress", params: [setP2pFireInput] }); await safeSendTransaction({ transaction: tx, account }); toast.success("P2P FIRE address set"); setSetP2pFireInput(""); await loadData(); } catch (e) { toast.error(`Error: ${(e as any)?.message || 'unknown'}`); } finally { setLoading(false); }
  };

  const handleDistributeUSDT = async () => {
    if (!distributeAmount || !account?.address) {
      toast.error("Enter amount and connect wallet", { style: toastStyle, position: "bottom-center" });
      return;
    }
    try {
      setLoading(true);
      const distC = getContract({ client, chain: BSC_TESTNET, address: FIRE_DIVIDEND_DISTRIBUTOR_ADDRESS, abi: DISTRIBUTOR_ABI as any });
      const amt = BigInt(distributeAmount) * BigInt(10) ** BigInt(usdtDecimals);
      const tx = prepareContractCall({ contract: distC, method: "distributeUSDT", params: [amt] });
      await safeSendTransaction({ transaction: tx, account });
      toast.success("USDT distributed", { style: toastStyle, position: "bottom-center" });
      setDistributeAmount("");
      await loadData();
    } catch (e) {
      toast.error(`Error: ${(e as any)?.message || "unknown"}`, { style: toastStyle, position: "bottom-center" });
    } finally {
      setLoading(false);
    }
  };

  // Render P2P admin UI section
  const P2PAdminSection = () => (
    <div className="bg-gray-900 p-4 rounded-lg border mt-6">
      <h3 className="text-lg font-semibold mb-3">P2P Escrow Admin</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="text-sm mb-1">USDT (on-chain)</div>
          <div className="text-xs text-white/70 mb-2">{p2pUsdt || '—'}</div>
          <input value={setP2pUsdtInput} onChange={e => setSetP2pUsdtInput(e.target.value)} placeholder="new USDT address" className="w-full p-2 bg-gray-800 rounded mb-2" />
          <button onClick={handleSetP2pUsdt} className="bg-blue-600 px-3 py-2 rounded">Set USDT</button>
        </div>

        <div>
          {authenticated && <P2PAdminSection />}
        </div>
        <div>
          <div className="text-sm mb-1">ASIA token</div>
          <div className="text-xs text-white/70 mb-2">{p2pAsia || '—'}</div>
          <input value={setP2pAsiaInput} onChange={e => setSetP2pAsiaInput(e.target.value)} placeholder="new ASIA address" className="w-full p-2 bg-gray-800 rounded mb-2" />
          <button onClick={handleSetP2pAsia} className="bg-blue-600 px-3 py-2 rounded">Set ASIA</button>
        </div>
        <div>
          <div className="text-sm mb-1">ZAIN token</div>
          <div className="text-xs text-white/70 mb-2">{p2pZain || '—'}</div>
          <input value={setP2pZainInput} onChange={e => setSetP2pZainInput(e.target.value)} placeholder="new ZAIN address" className="w-full p-2 bg-gray-800 rounded mb-2" />
          <button onClick={handleSetP2pZain} className="bg-blue-600 px-3 py-2 rounded">Set ZAIN</button>
        </div>
        <div>
          <div className="text-sm mb-1">MASTER token</div>
          <div className="text-xs text-white/70 mb-2">{p2pMaster || '—'}</div>
          <input value={setP2pMasterInput} onChange={e => setSetP2pMasterInput(e.target.value)} placeholder="new MASTER address" className="w-full p-2 bg-gray-800 rounded mb-2" />
          <button onClick={handleSetP2pMaster} className="bg-blue-600 px-3 py-2 rounded">Set MASTER</button>
        </div>
        <div>
          <div className="text-sm mb-1">FIRE token</div>
          <div className="text-xs text-white/70 mb-2">{p2pFire || '—'}</div>
          <input value={setP2pFireInput} onChange={e => setSetP2pFireInput(e.target.value)} placeholder="new FIRE address" className="w-full p-2 bg-gray-800 rounded mb-2" />
          <button onClick={handleSetP2pFire} className="bg-blue-600 px-3 py-2 rounded">Set FIRE</button>
        </div>
      </div>
    </div>
  );

  const handleExcludeFromRewards = async () => {
    if (!excludeAddress || !account?.address) {
      toast.error("Enter address", { style: toastStyle, position: "bottom-center" });
      return;
    }
    try {
      setLoading(true);
      const distC = getContract({ client, chain: BSC_TESTNET, address: FIRE_DIVIDEND_DISTRIBUTOR_ADDRESS, abi: DISTRIBUTOR_ABI as any });
      const tx = prepareContractCall({ contract: distC, method: "excludeFromRewards", params: [excludeAddress, excludeState] });
      await safeSendTransaction({ transaction: tx, account });
      toast.success(excludeState ? "Address excluded" : "Address included", { style: toastStyle, position: "bottom-center" });
      setExcludeAddress("");
    } catch (e) {
      toast.error(`Error: ${(e as any)?.message || "unknown"}`, { style: toastStyle, position: "bottom-center" });
    } finally {
      setLoading(false);
    }
  };

  const handleExcludeDevFees = async () => {
    if (!excludeDevAddr || !account?.address) { toast.error("Enter address", { style: toastStyle, position: "bottom-center" }); return; }
    try {
      setLoading(true);
      const distC = getContract({ client, chain: BSC_TESTNET, address: FIRE_DIVIDEND_DISTRIBUTOR_ADDRESS, abi: DISTRIBUTOR_ABI as any });
      const tx = prepareContractCall({ contract: distC, method: "setExcludedFromDevFees", params: [excludeDevAddr, excludeDevState] });
      await safeSendTransaction({ transaction: tx, account });
      toast.success(excludeDevState ? "Address excluded from dev fees" : "Address included in dev fees", { style: toastStyle, position: "bottom-center" });
      setExcludeDevAddr("");
    } catch (e) { toast.error(`Error: ${(e as any)?.message || "unknown"}`, { style: toastStyle, position: "bottom-center" }); }
    finally { setLoading(false); }
  };

  const handleExcludeHoldersFees = async () => {
    if (!excludeHoldersAddr || !account?.address) { toast.error("Enter address", { style: toastStyle, position: "bottom-center" }); return; }
    try {
      setLoading(true);
      const distC = getContract({ client, chain: BSC_TESTNET, address: FIRE_DIVIDEND_DISTRIBUTOR_ADDRESS, abi: DISTRIBUTOR_ABI as any });
      const tx = prepareContractCall({ contract: distC, method: "setExcludedFromHoldersFees", params: [excludeHoldersAddr, excludeHoldersState] });
      await safeSendTransaction({ transaction: tx, account });
      toast.success(excludeHoldersState ? "Address excluded from holders fees" : "Address included in holders fees", { style: toastStyle, position: "bottom-center" });
      setExcludeHoldersAddr("");
    } catch (e) { toast.error(`Error: ${(e as any)?.message || "unknown"}`, { style: toastStyle, position: "bottom-center" }); }
    finally { setLoading(false); }
  };

  const resolveDispute = async (orderId: number, winner: number) => {
    if (!account?.address) { toast.error("Wallet not connected", { style: toastStyle, position: "bottom-center" }); return; }
    try {
      setLoading(true);
      const tx = prepareContractCall({ contract: P2P_ESCROW_CONTRACT, method: "function resolveDispute(uint256,uint8)", params: [BigInt(orderId), winner] });
      await safeSendTransaction({ transaction: tx, account });
      toast.success(`Dispute resolved, funds released to ${winner === 0 ? 'buyer' : 'seller'}`, { style: toastStyle, position: "bottom-center" });
    } catch (e) { toast.error(`Error: ${(e as any)?.message || "unknown"}`, { style: toastStyle, position: "bottom-center" }); }
    finally { setLoading(false); }
  };

  if (!authenticated) {
    return (
      <div dir="ltr" className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white flex items-center justify-center px-4">
        <div className="bg-gray-800/50 border border-white/10 rounded-2xl p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold mb-4">Admin Access</h1>
          <p className="text-white/60 text-sm mb-4">Enter the secret key to access admin functions.</p>
          <input
            type="password"
            placeholder="Secret key"
            value={secretInput}
            onChange={(e) => setSecretInput(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 mb-4 outline-none focus:border-orange-400"
          />
          <button
            onClick={handleVerify}
            disabled={loading}
            className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-400 hover:to-pink-500 font-semibold disabled:opacity-50"
          >
            Verify
          </button>
        </div>
      </div>
    );
  }

  return (
    <div dir="ltr" className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent mb-2">Admin Panel</h1>
          <p className="text-white/60">Manage FIRE token and rewards</p>
        </header>

        {/* Status Cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <p className="text-white/50 text-sm mb-2">Accumulated FIRE Fees</p>
            <p className="text-2xl font-bold text-orange-300">
              {accumulatedFireFees !== null ? formatAmount(accumulatedFireFees, fireDecimals) : "..."} FIRE
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <p className="text-white/50 text-sm mb-2">Distributor USDT Balance</p>
            <p className="text-2xl font-bold text-green-300">
              {distributorUsdtBalance !== null ? formatAmount(distributorUsdtBalance, usdtDecimals) : "..."} USDT
            </p>
          </div>
        </div>

        {/* FIRE Token Management */}
        <div className="bg-gradient-to-br from-gray-800/50 to-black/70 border border-white/10 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-bold text-orange-300">FIRE Token Management</h2>

          {/* Withdraw Fees */}
          <div className="space-y-2">
            <label className="text-sm text-white/70">Withdraw FIRE Fees</label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Amount in FIRE"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 outline-none focus:border-orange-400"
              />
              <button
                onClick={handleWithdrawFees}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 font-semibold disabled:opacity-50"
              >
                Withdraw
              </button>
            </div>
          </div>

          {/* Set Fee Rate */}
          <div className="space-y-2">
            <label className="text-sm text-white/70">Transfer Fee Rate (basis points)</label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="e.g., 200 for 2%"
                value={feeRateBps}
                onChange={(e) => setFeeRateBps(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 outline-none focus:border-orange-400"
              />
              <button
                onClick={handleSetFeeRate}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 font-semibold disabled:opacity-50"
              >
                Set
              </button>
            </div>
          </div>

          {/* Enable Trading */}
          <button
            onClick={handleEnableTrading}
            disabled={loading}
            className="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold disabled:opacity-50"
          >
            Enable Trading
          </button>
        </div>

        {/* Rewards Distributor Management */}
        <div className="bg-gradient-to-br from-gray-800/50 to-black/70 border border-white/10 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-bold text-green-300">Rewards Distributor Management</h2>

          {/* Fund USDT */}
          <div className="space-y-2">
            <label className="text-sm text-white/70">Fund Distributor with USDT</label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Amount in USDT"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 outline-none focus:border-green-400"
              />
              <button
                onClick={handleFundUSDT}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 font-semibold disabled:opacity-50"
              >
                Fund
              </button>
            </div>
          </div>

          {/* Fund contract with native BNB (BNB) */}
          <div className="space-y-2">
            <label className="text-sm text-white/70">إضافة BNB إلى العقد (BNB)</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="المبلغ بـ BNB (مثال: 0.1)"
                value={fundBnbAmount}
                onChange={(e) => setFundBnbAmount(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 outline-none focus:border-green-400"
              />
              <button
                onClick={handleFundPOL}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold disabled:opacity-50"
              >
                أرسل BNB
              </button>
            </div>
            <p className="text-[11px] text-white/40">أدخل كمية BNB لإرسالها مباشرة إلى العقد (تُدفع الرسوم على الشبكة من المحفظة).</p>
          </div>

          {/* Distribute USDT */}
          <div className="space-y-2">
            <label className="text-sm text-white/70">Distribute USDT to FIRE Holders</label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Amount to distribute"
                value={distributeAmount}
                onChange={(e) => setDistributeAmount(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 outline-none focus:border-green-400"
              />
              <button
                onClick={handleDistributeUSDT}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 font-semibold disabled:opacity-50"
              >
                Distribute
              </button>
            </div>
          </div>
          {/* Set Rewards Contract */}
          <div className="space-y-2 mt-4">
            <label className="text-sm text-white/70">Set Rewards Contract (address)</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Rewards contract address"
                value={setUsdtInput}
                onChange={(e) => setSetUsdtInput(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 outline-none focus:border-green-400"
              />
              <button onClick={handleSetUSDTToken} disabled={loading} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold disabled:opacity-50">Set</button>
            </div>
            <div className="text-[11px] text-white/40">Current rewards contract: {usdtTokenAddr ?? '—'}</div>
          </div>

          {/* Set Rate */}
          <div className="space-y-2 mt-4">
            <label className="text-sm text-white/70">Set FIRE→USDT Rate (human)</label>
            <div className="flex gap-2">
              <input type="text" placeholder="e.g. 0.69" value={setRateInput} onChange={(e)=>setSetRateInput(e.target.value)} className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 outline-none focus:border-green-400" />
              <input type="number" placeholder="decimals" value={setRateDecimalsInput} onChange={(e)=>setSetRateDecimalsInput(Number(e.target.value))} className="w-28 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 outline-none" />
              <button onClick={handleSetRate} disabled={loading} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold disabled:opacity-50">Set Rate</button>
            </div>
            <div className="text-[11px] text-white/40">Current raw rate: {fireRate !== null ? fireRate.toString() : '—'} (decimals: {rateDecimalsState ?? '—'})</div>
          </div>

          {/* Set BNB Price */}
          <div className="space-y-2 mt-4">
            <label className="text-sm text-white/70">Set BNB price in USDT (human, e.g. 0.5)</label>
            <div className="flex gap-2">
              <input type="text" placeholder="e.g. 0.5" value={setMaticPriceInput} onChange={(e)=>setSetMaticPriceInput(e.target.value)} className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 outline-none focus:border-green-400" />
              <button onClick={handleSetMaticPrice} disabled={loading} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold disabled:opacity-50">Set Price</button>
            </div>
            <div className="text-[11px] text-white/40">Current usdtPerBNB (scaled 1e18): {bnbPrice !== null ? bnbPrice.toString() : '—'}</div>
          </div>

          {/* Withdraw USDT helper */}
          <div className="space-y-2 mt-4">
            <label className="text-sm text-white/70">Withdraw USDT from Contract</label>
            <div className="flex gap-2">
              <input type="text" placeholder="to address" value={withdrawUsdtTo} onChange={(e)=>setWithdrawUsdtTo(e.target.value)} className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 outline-none" />
              <input type="number" placeholder="amount USDT" value={withdrawUsdtAmount} onChange={(e)=>setWithdrawUsdtAmount(e.target.value)} className="w-40 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 outline-none" />
              <button onClick={handleWithdrawUSDT} disabled={loading} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 font-semibold disabled:opacity-50">Withdraw USDT</button>
            </div>
            <div className="text-[11px] text-white/40">Contract USDT balance: {contractUsdtBalance !== null ? formatAmount(contractUsdtBalance, usdtDecimals) : '—'}</div>
          </div>

          {/* Exclude from Rewards */}
          <div className="space-y-2">
            <label className="text-sm text-white/70">Exclude/Include Address from Rewards</label>
            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                placeholder="Address to exclude/include"
                value={excludeAddress}
                onChange={(e) => setExcludeAddress(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 outline-none focus:border-green-400 text-xs"
              />
              <select
                value={excludeState ? "exclude" : "include"}
                onChange={(e) => setExcludeState(e.target.value === "exclude")}
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white outline-none focus:border-green-400 text-sm"
              >
                <option value="exclude">Exclude</option>
                <option value="include">Include</option>
              </select>
              <button
                onClick={handleExcludeFromRewards}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 font-semibold disabled:opacity-50"
              >
                Update
              </button>
            </div>
          </div>

          {/* Exclude From Dev Fees */}
          <div className="space-y-2 mt-3">
            <label className="text-sm text-white/70">Exclude/Include Address from Dev Fees</label>
            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                placeholder="Address"
                value={excludeDevAddr}
                onChange={(e) => setExcludeDevAddr(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 outline-none focus:border-green-400 text-xs"
              />
              <select
                value={excludeDevState ? "exclude" : "include"}
                onChange={(e) => setExcludeDevState(e.target.value === "exclude")}
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white outline-none focus:border-green-400 text-sm"
              >
                <option value="exclude">Exclude</option>
                <option value="include">Include</option>
              </select>
              <button
                onClick={handleExcludeDevFees}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 font-semibold disabled:opacity-50"
              >
                Update
              </button>
            </div>
          </div>

          {/* Exclude From Holders Fees */}
          <div className="space-y-2 mt-3">
            <label className="text-sm text-white/70">Exclude/Include Address from Holders Fees</label>
            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                placeholder="Address"
                value={excludeHoldersAddr}
                onChange={(e) => setExcludeHoldersAddr(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 outline-none focus:border-green-400 text-xs"
              />
              <select
                value={excludeHoldersState ? "exclude" : "include"}
                onChange={(e) => setExcludeHoldersState(e.target.value === "exclude")}
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white outline-none focus:border-green-400 text-sm"
              >
                <option value="exclude">Exclude</option>
                <option value="include">Include</option>
              </select>
              <button
                onClick={handleExcludeHoldersFees}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 font-semibold disabled:opacity-50"
              >
                Update
              </button>
            </div>
          </div>
        </div>

        {/* P2P Disputes */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4 text-white">P2P Disputes</h3>
          <div className="space-y-2">
            {/* Mock disputes - in real app, fetch from contract or backend */}
            <div className="bg-red-900/20 border border-red-500/30 rounded p-3">
              <p className="text-sm">Order ID: 12345 - Reported as scam by buyer</p>
              <p className="text-xs text-white/60">Reason: Did not receive payment</p>
              <button onClick={() => resolveDispute(12345, 0)} className="mt-2 px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm">Release to Buyer</button>
              <button onClick={() => resolveDispute(12345, 1)} className="mt-2 ml-2 px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm">Release to Seller</button>
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-sm text-white/60 leading-relaxed">
          <p className="font-semibold text-white/80 mb-2">How it works:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Accumulated Fees:</strong> FIRE tokens collected from transfer fees. Withdraw to your wallet.</li>
            <li><strong>Fund Distributor:</strong> Deposit USDT into the distributor so users can claim rewards.</li>
            <li><strong>Distribute:</strong> Call this to allocate USDT to all FIRE holders (proportional to holdings).</li>
            <li><strong>Exclude:</strong> Prevent certain addresses from earning rewards.</li>
            <li><strong>Trading:</strong> Disabled by default. Enable when ready to allow public transfers.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
