import { NextApiRequest, NextApiResponse } from 'next';
import { readDB, writeDB } from '../../p2p/db';

function makeNonce() {
  return Math.floor(Math.random() * 1e12).toString();
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { address } = req.query;
  if (!address || typeof address !== 'string') return res.status(400).json({ error: 'address required' });
  const db = readDB();
  const nonce = makeNonce();
  db.nonces[address.toLowerCase()] = nonce;
  writeDB(db);
  res.status(200).json({ nonce });
}
