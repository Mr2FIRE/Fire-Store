import { NextApiRequest, NextApiResponse } from 'next';
import { readDB, writeDB } from '../../../p2p/db';
import { ethers } from 'ethers';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { address, signature } = req.body;
  if (!address || !signature) return res.status(400).json({ error: 'address and signature required' });
  const db = readDB();
  const nonce = db.nonces[address.toLowerCase()];
  if (!nonce) return res.status(400).json({ error: 'nonce not found' });
  try {
    const message = `Sign this nonce to authenticate: ${nonce}`;
    const recovered = ethers.verifyMessage(message, signature);
    if (recovered.toLowerCase() !== address.toLowerCase()) return res.status(401).json({ error: 'signature mismatch' });
    // Auth success - clear nonce and return simple session token (timestamp)
    delete db.nonces[address.toLowerCase()];
    writeDB(db);
    const token = Buffer.from(`${address}:${Date.now()}`).toString('base64');
    res.status(200).json({ token, address });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'verification failed' });
  }
}
