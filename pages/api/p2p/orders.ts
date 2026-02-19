import { NextApiRequest, NextApiResponse } from 'next';
import { readDB, writeDB } from './db';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = readDB();
  if (req.method === 'GET') {
    res.status(200).json(db.orders || []);
    return;
  }
  if (req.method === 'POST') {
    const order = req.body;
    order.id = Date.now().toString();
    order.createdAt = new Date().toISOString();
    db.orders.push(order);
    writeDB(db);
    res.status(201).json(order);
    return;
  }
  if (req.method === 'PUT') {
    const { id, status } = req.body;
    const idx = db.orders.findIndex((o: any) => o.id === id);
    if (idx === -1) return res.status(404).json({ error: 'order not found' });
    db.orders[idx].status = status;
    writeDB(db);
    res.status(200).json(db.orders[idx]);
    return;
  }
  res.status(405).end();
}
