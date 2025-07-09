import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { soNumber } = req.query;

    if (!soNumber) {
      return res.status(400).json({ error: 'SO/PO number is required' });
    }

    // Get scans for this SO/PO number
    const scans = await kv.get(soNumber) || [];
    
    console.log(`Retrieved ${scans.length} scans for SO ${soNumber}`);
    
    res.status(200).json({ 
      success: true, 
      soNumber,
      scans,
      totalScans: scans.length 
    });
    
  } catch (error) {
    console.error('Error retrieving scans:', error);
    res.status(500).json({ error: 'Failed to retrieve scans' });
  }
} 