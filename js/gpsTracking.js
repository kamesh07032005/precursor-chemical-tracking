// Database configuration
const dbConfig = {
    apiUrl: 'http://localhost:3000'  // JSON Server URL
};

// Import AI system
import { aiSystem } from './aiSystem.js';

// Function to handle GPS data
async function handleGPSData(gpsData) {
    try {
        const { gps_id, lat, lon, vstatus } = gpsData;

        // Validate required fields
        if (!gps_id || !lat || !lon || !vstatus) {
            throw new Error('Missing required parameters: gps_id, lat, lon, or vstatus.');
        }

        // AI Analysis
        const aiAnalysis = await aiSystem.analyzeGPSPattern(gpsData);
        if (aiAnalysis.isAnomaly) {
            await alertSystem.createAlert(alertSystem.alertTypes.SYSTEM, {
                gps_id,
                lat,
                lon,
                vstatus,
                aiAnalysis: {
                    confidence: aiAnalysis.confidence,
                    features: aiAnalysis.features
                }
            });
        }

        // Check if GPS record exists
        const response = await fetch(`${dbConfig.apiUrl}/gps_tracking/${gps_id}`);
        const existingRecord = await response.json();

        let result;
        if (existingRecord.id) {
            result = await updateGPSRecord(gps_id, lat, lon, vstatus);
        } else {
            result = await createGPSRecord(gps_id, lat, lon, vstatus);
        }

        // Predict potential risks
        const riskPrediction = await aiSystem.predictRisks([gpsData]);
        if (riskPrediction[0].requiresAttention) {
            await alertSystem.createAlert(alertSystem.alertTypes.SYSTEM, {
                gps_id,
                lat,
                lon,
                vstatus,
                riskAnalysis: riskPrediction[0]
            });
        }

        // Handle alert if vstatus is "open"
        if (vstatus === "open") {
            await handleAlertUpdate(gps_id, lat, lon);
        }

        return {
            success: true,
            message: 'GPS data processed successfully',
            data: result,
            aiAnalysis,
            riskPrediction: riskPrediction[0]
        };
    } catch (error) {
        console.error('Error handling GPS data:', error);
        return { success: false, error: error.message };
    }
}

// Function to update GPS record
async function updateGPSRecord(gps_id, lat, lon, vstatus) {
    const updateData = {
        gps_id,
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        vstatus,
        updated_at: new Date().toISOString()
    };

    const response = await fetch(`${dbConfig.apiUrl}/gps_tracking/${gps_id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
    });

    if (!response.ok) {
        throw new Error('Failed to update GPS record');
    }

    return await response.json();
}

// Function to create new GPS record
async function createGPSRecord(gps_id, lat, lon, vstatus) {
    const newRecord = {
        gps_id,
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        vstatus,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    const response = await fetch(`${dbConfig.apiUrl}/gps_tracking`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(newRecord)
    });

    if (!response.ok) {
        throw new Error('Failed to create GPS record');
    }

    return await response.json();
}

// Function to handle alert updates
async function handleAlertUpdate(gps_id, lat, lon) {
    try {
        // Get order information
        const orderResponse = await fetch(`${dbConfig.apiUrl}/assigned_orders?gps_id=${gps_id}`);
        const orders = await orderResponse.json();

        if (orders.length > 0) {
            const order = orders[0];

            // Create alert entry
            const alertData = {
                order_id: order.order_id,
                lat: parseFloat(lat),
                lon: parseFloat(lon),
                nozzle: 'open',
                time: new Date().toISOString(),
                status: 'Alert Triggered'
            };

            const alertResponse = await fetch(`${dbConfig.apiUrl}/alerts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(alertData)
            });

            if (!alertResponse.ok) {
                throw new Error('Failed to create alert entry');
            }

            // Update analytics dashboard
            updateAnalyticsDashboard(alertData);
        }
    } catch (error) {
        console.error('Error handling alert update:', error);
        throw error;
    }
}

// Function to update analytics dashboard
function updateAnalyticsDashboard(alertData) {
    // Dispatch custom event for analytics dashboard
    const event = new CustomEvent('newAlertData', { detail: alertData });
    window.dispatchEvent(event);
}

// Export functions
export {
    handleGPSData,
    updateGPSRecord,
    createGPSRecord,
    handleAlertUpdate
};
