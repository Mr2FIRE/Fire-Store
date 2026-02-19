import { NextApiRequest, NextApiResponse } from 'next';
import { readDB, writeDB } from './db';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = readDB();
  if (req.method === 'GET') {
    res.status(200).json(db.ads || []);
    return;
  }
  if (req.method === 'POST') {
    const ad = req.body;
    ad.id = (db.ads.length + 1).toString();
    db.ads.push(ad);
    writeDB(db);
    res.status(201).json(ad);
    return;
  }
  res.status(405).end();
}
