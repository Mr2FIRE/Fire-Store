import { NextApiRequest, NextApiResponse } from 'next';
import { readDB, writeDB } from './db';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = readDB();
  if (req.method === 'GET') {
    res.status(200).json(db.reports || []);
    return;
  }
  if (req.method === 'POST') {
    const report = req.body;
    report.id = Date.now().toString();
    report.timestamp = new Date().toISOString();
    db.reports.push(report);
    writeDB(db);
    res.status(201).json(report);
    return;
  }
  res.status(405).end();
}
