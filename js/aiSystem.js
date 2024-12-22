// AI System for Chemical Tracking
class AISystem {
    constructor() {
        this.anomalyThreshold = 0.8;
        this.modelEndpoint = 'https://api.openai.com/v1/chat/completions';
        this.patterns = new Map();
        this.historicalData = [];
    }

    // Initialize TensorFlow.js
    async initialize() {
        try {
            // Load pre-trained model if available
            this.model = await tf.loadLayersModel('indexeddb://chemical-tracking-model');
            console.log('AI Model loaded successfully');
        } catch (error) {
            console.log('Creating new model...');
            this.model = this.createModel();
        }
    }

    // Create a simple anomaly detection model
    createModel() {
        const model = tf.sequential();
        model.add(tf.layers.dense({ units: 32, activation: 'relu', inputShape: [8] }));
        model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
        model.add(tf.layers.dense({ units: 8, activation: 'relu' }));
        model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));

        model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'binaryCrossentropy',
            metrics: ['accuracy']
        });

        return model;
    }

    // Analyze GPS patterns for anomalies
    async analyzeGPSPattern(gpsData) {
        const features = this.extractFeatures(gpsData);
        const tensor = tf.tensor2d([features]);
        
        const prediction = this.model.predict(tensor);
        const anomalyScore = await prediction.data();
        
        return {
            isAnomaly: anomalyScore[0] > this.anomalyThreshold,
            confidence: anomalyScore[0],
            features: features
        };
    }

    // Extract relevant features from GPS data
    extractFeatures(gpsData) {
        const {
            speed,
            acceleration,
            direction,
            stopDuration,
            distanceFromRoute,
            timeOfDay,
            dayOfWeek,
            weatherCondition
        } = this.calculateFeatures(gpsData);

        return [
            speed,
            acceleration,
            direction,
            stopDuration,
            distanceFromRoute,
            timeOfDay,
            dayOfWeek,
            weatherCondition
        ];
    }

    // Calculate derived features from raw GPS data
    calculateFeatures(gpsData) {
        const now = new Date();
        const timeOfDay = now.getHours() / 24;
        const dayOfWeek = now.getDay() / 7;

        return {
            speed: this.calculateSpeed(gpsData),
            acceleration: this.calculateAcceleration(gpsData),
            direction: this.calculateDirection(gpsData),
            stopDuration: this.calculateStopDuration(gpsData),
            distanceFromRoute: this.calculateRouteDeviation(gpsData),
            timeOfDay,
            dayOfWeek,
            weatherCondition: 1.0 // Placeholder for weather API integration
        };
    }

    // Analyze chemical quantities for suspicious patterns
    async analyzeChemicalQuantities(transaction) {
        const prompt = `Analyze this chemical transaction for suspicious patterns:
            Chemical Type: ${transaction.chemicalType}
            Quantity: ${transaction.quantity}
            Frequency: ${transaction.frequency}
            Previous Average: ${transaction.previousAverage}
            Location: ${transaction.location}
            Time: ${transaction.timestamp}
            
            Consider:
            1. Is the quantity unusually large?
            2. Is the frequency of transactions unusual?
            3. Are there any suspicious patterns in timing or location?
            4. Does this match known suspicious patterns?
            
            Provide a risk assessment and explanation.`;

        try {
            const response = await this.callGPT(prompt);
            return this.parseGPTResponse(response);
        } catch (error) {
            console.error('Error analyzing chemical quantities:', error);
            return {
                riskLevel: 'unknown',
                explanation: 'Unable to analyze due to error',
                confidence: 0
            };
        }
    }

    // Call GPT API for advanced analysis
    async callGPT(prompt) {
        // This is a placeholder - replace with actual API call
        return {
            riskLevel: 'medium',
            explanation: 'Quantity exceeds typical patterns',
            confidence: 0.75
        };
    }

    // Parse GPT response
    parseGPTResponse(response) {
        return {
            riskLevel: response.riskLevel,
            explanation: response.explanation,
            confidence: response.confidence
        };
    }

    // Predict potential risks based on historical data
    async predictRisks(historicalData) {
        const features = this.preprocessHistoricalData(historicalData);
        const tensor = tf.tensor2d(features);
        
        const predictions = this.model.predict(tensor);
        const riskScores = await predictions.data();
        
        return this.interpretRiskScores(riskScores);
    }

    // Preprocess historical data for risk prediction
    preprocessHistoricalData(data) {
        return data.map(record => this.extractFeatures(record));
    }

    // Interpret risk scores
    interpretRiskScores(scores) {
        return scores.map(score => ({
            riskLevel: this.getRiskLevel(score),
            probability: score,
            requiresAttention: score > this.anomalyThreshold
        }));
    }

    // Get risk level based on score
    getRiskLevel(score) {
        if (score > 0.8) return 'high';
        if (score > 0.5) return 'medium';
        return 'low';
    }

    // Calculate speed from GPS data
    calculateSpeed(gpsData) {
        if (!this.lastGPSData) {
            this.lastGPSData = gpsData;
            return 0;
        }

        const distance = this.calculateDistance(
            this.lastGPSData.lat,
            this.lastGPSData.lon,
            gpsData.lat,
            gpsData.lon
        );

        const timeDiff = (new Date(gpsData.timestamp) - new Date(this.lastGPSData.timestamp)) / 1000;
        const speed = distance / timeDiff;

        this.lastGPSData = gpsData;
        return speed;
    }

    // Calculate acceleration
    calculateAcceleration(gpsData) {
        if (!this.lastSpeed) {
            this.lastSpeed = this.calculateSpeed(gpsData);
            return 0;
        }

        const currentSpeed = this.calculateSpeed(gpsData);
        const timeDiff = (new Date(gpsData.timestamp) - new Date(this.lastGPSData.timestamp)) / 1000;
        const acceleration = (currentSpeed - this.lastSpeed) / timeDiff;

        this.lastSpeed = currentSpeed;
        return acceleration;
    }

    // Calculate direction of movement
    calculateDirection(gpsData) {
        if (!this.lastGPSData) return 0;

        const dLon = gpsData.lon - this.lastGPSData.lon;
        const y = Math.sin(dLon) * Math.cos(gpsData.lat);
        const x = Math.cos(this.lastGPSData.lat) * Math.sin(gpsData.lat) -
                 Math.sin(this.lastGPSData.lat) * Math.cos(gpsData.lat) * Math.cos(dLon);
        
        return Math.atan2(y, x);
    }

    // Calculate stop duration
    calculateStopDuration(gpsData) {
        if (!this.lastGPSData || this.calculateSpeed(gpsData) > 0.1) {
            this.stopStartTime = null;
            return 0;
        }

        if (!this.stopStartTime) {
            this.stopStartTime = new Date(gpsData.timestamp);
        }

        return (new Date(gpsData.timestamp) - this.stopStartTime) / 1000;
    }

    // Calculate deviation from planned route
    calculateRouteDeviation(gpsData) {
        // Placeholder - implement route deviation calculation
        return 0;
    }

    // Calculate distance between two points
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }

    // Train model with new data
    async trainModel(newData) {
        const features = this.preprocessHistoricalData(newData);
        const labels = newData.map(d => d.isAnomaly ? 1 : 0);

        const xs = tf.tensor2d(features);
        const ys = tf.tensor2d(labels, [labels.length, 1]);

        await this.model.fit(xs, ys, {
            epochs: 10,
            batchSize: 32,
            validationSplit: 0.2
        });

        // Save updated model
        await this.model.save('indexeddb://chemical-tracking-model');
    }
}

// Export singleton instance
export const aiSystem = new AISystem();
