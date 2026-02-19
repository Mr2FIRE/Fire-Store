import { sendTransaction } from "thirdweb";
import toast from "react-hot-toast";

export async function safeSendTransaction(opts: { transaction: any; account?: any }) {
  const { transaction, account } = opts;
  if (!account || !account.address) {
    toast.error("Connect wallet");
    throw new Error("NO_ACCOUNT_CONNECTED");
  }
  return await sendTransaction({ transaction, account });
}
