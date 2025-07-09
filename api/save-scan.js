import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { soNumber, sku, date } = req.body;

    if (!soNumber || !sku || !date) {
      return res.status(400).json({ error: 'Missing required fields: soNumber, sku, date' });
    }

    // Get existing scans for this SO/PO number
    const existingScans = await kv.get(soNumber) || [];
    
    // Add new scan
    const newScan = { sku, date, timestamp: new Date().toISOString() };
    const updatedScans = [...existingScans, newScan];
    
    // Save back to KV
    await kv.set(soNumber, updatedScans);
    
    console.log(`Saved scan: SO ${soNumber}, SKU ${sku}, Date ${date}`);
    
    res.status(200).json({ 
      success: true, 
      message: 'Scan saved successfully',
      totalScans: updatedScans.length 
    });
    
  } catch (error) {
    console.error('Error saving scan:', error);
    res.status(500).json({ error: 'Failed to save scan' });
  }
} 