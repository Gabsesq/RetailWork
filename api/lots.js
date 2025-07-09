import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        if (req.method === 'POST') {
            // Store new lots data
            const { soNumber, sku, lotCode, quantity, unit, template } = req.body;
            
            if (!soNumber || !sku) {
                return res.status(400).json({
                    success: false,
                    error: 'SO/PO number and SKU are required'
                });
            }

            const timestamp = new Date().toISOString();
            const entry = {
                id: `${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp,
                soNumber,
                sku,
                lotCode: lotCode || '',
                quantity: quantity || '',
                unit: unit || '',
                template: template || 'unknown'
            };

            // Check if there are existing entries for this SO/PO number
            const existingLots = await kv.hgetall('lots');
            if (existingLots) {
                const existingEntries = Object.values(existingLots)
                    .map(entry => JSON.parse(entry))
                    .filter(entry => entry.soNumber === soNumber);
                
                // Remove existing entries for this SO/PO number
                for (const existingEntry of existingEntries) {
                    await kv.hdel('lots', existingEntry.id);
                    await kv.zrem('lots_by_date', existingEntry.id);
                }
                
                console.log(`Removed ${existingEntries.length} existing entries for SO/PO: ${soNumber}`);
            }

            // Store new entry in Vercel KV
            await kv.hset('lots', entry.id, JSON.stringify(entry));
            
            // Also store in a sorted set for easy retrieval by date
            await kv.zadd('lots_by_date', { score: new Date(timestamp).getTime(), member: entry.id });

            res.status(200).json({
                success: true,
                message: 'Lot data stored successfully (replaced existing entries)',
                entry
            });

        } else if (req.method === 'GET') {
            // Retrieve lots data
            const { soNumber, sku, lotCode, date, limit = 1000 } = req.query;
            
            // Get all lots data
            const lotsData = await kv.hgetall('lots');
            
            if (!lotsData) {
                return res.status(200).json({
                    success: true,
                    lots: []
                });
            }

            // Convert to array and parse JSON
            let lots = Object.values(lotsData)
                .map(entry => JSON.parse(entry))
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            // Apply filters if provided
            if (soNumber) {
                lots = lots.filter(entry => 
                    entry.soNumber && entry.soNumber.toLowerCase().includes(soNumber.toLowerCase())
                );
            }

            if (sku) {
                lots = lots.filter(entry => 
                    entry.sku && entry.sku.toLowerCase().includes(sku.toLowerCase())
                );
            }

            if (lotCode) {
                lots = lots.filter(entry => 
                    entry.lotCode && entry.lotCode.toLowerCase().includes(lotCode.toLowerCase())
                );
            }

            if (date) {
                const targetDate = new Date(date).toDateString();
                lots = lots.filter(entry => 
                    new Date(entry.timestamp).toDateString() === targetDate
                );
            }

            // Apply limit
            lots = lots.slice(0, parseInt(limit));

            res.status(200).json({
                success: true,
                lots
            });

        } else {
            res.status(405).json({
                success: false,
                error: 'Method not allowed'
            });
        }

    } catch (error) {
        console.error('Error in lots API:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
} 