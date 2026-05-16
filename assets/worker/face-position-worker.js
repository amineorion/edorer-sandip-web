/**
 * Web worker for face position detection
 * Based on Human.js demo patterns for optimal performance
 * Handles face mesh landmarks and distance calculations
 */

// Load Human library using IIFE script for better compatibility
self.importScripts('https://cdn.jsdelivr.net/npm/@vladmandic/human@3.1.2/dist/human.js');

let human = null;
let busy = false;
let config = null;
let minimumDestination = 0;

// Performance monitoring
let frameCount = 0;
let lastFrameTime = 0;
const fpsHistory = [];

// Initialize Human with optimized configuration
async function initializeHuman(userConfig) {
    try {
        // Set TensorFlow backend for optimal performance
        if (typeof self.tf !== 'undefined') {
            await self.tf.setBackend('webgl');
            await self.tf.ready();
        }

        // Create Human instance with optimized config
        human = new self.Human.Human(userConfig);
        await human.load();
        
        console.log('Face position worker initialized with Human version:', human.version);
        return true;
    } catch (error) {
        console.error('Failed to initialize Human in worker:', error);
        return false;
    }
}

// Calculate distance based on IPD (Interpupillary Distance)
function calculateDistance(realIPD, realDistance, calculatedIPD) {
    // Using the formula: realDistance = (realIPD * calculatedDistance) / calculatedIPD
    // Where calculatedDistance is the distance we want to find
    return (realIPD * realDistance) / calculatedIPD;
}

// Optimized face position detection function
async function detectFacePosition(imageData) {
    if (!human || busy) return false;
    
    busy = true;
    const startTime = performance.now();
    
    try {
        // Create ImageData from transferred buffer
        const image = new ImageData(
            imageData.data, 
            imageData.width, 
            imageData.height
        );
        
        // Perform detection with optimized settings
        const result = await human.detect(image, config);
        
        // Calculate performance metrics
        const processingTime = performance.now() - startTime;
        frameCount++;
        
        if (fpsHistory.length >= 10) fpsHistory.shift();
        fpsHistory.push(1000 / processingTime);
        
        // Process face detection results
        const faceDetected = result.face && result.face.length > 0;
        let positionValid = false;
        let distance = 0;
        let confidence = 0;
        let landmarks = null;
        
        if (faceDetected && result.face.length === 1) {
            const face = result.face[0];
            confidence = face.score || 0;
            
            // Check if we have mesh landmarks
            if (face.mesh && face.mesh.length > 0) {
                landmarks = face.mesh;
                
                // Find eye landmarks (assuming they're at specific indices)
                // This is a simplified approach - you may need to adjust based on your specific landmark model
                const leftEye = landmarks[36]; // Left eye outer corner
                const rightEye = landmarks[45]; // Right eye outer corner
                
                if (leftEye && rightEye) {
                    // Calculate IPD (Interpupillary Distance)
                    const calculatedIPD = Math.abs(leftEye[0] - rightEye[0]);
                    
                    // Convert to real-world distance
                    // Assuming 1920px width and 400mm reference distance
                    const normalizedIPD = calculatedIPD / imageData.width * 1920;
                    distance = calculateDistance(22, 400, normalizedIPD);
                    
                    // Check if position meets minimum distance requirement
                    positionValid = distance <= minimumDestination && confidence > 0.7;
                }
            } else {
                // Fallback: use bounding box if mesh not available
                if (face.box) {
                    const boxWidth = face.box.width;
                    const calculatedIPD = boxWidth / imageData.width * 1920;
                    distance = calculateDistance(22, 400, calculatedIPD);
                    positionValid = distance <= minimumDestination && confidence > 0.7;
                }
            }
        }
        
        // Clean up tensors to prevent memory leaks
        if (result.tensors) {
            human.tf.engine().startScope();
            human.tf.engine().endScope();
        }
        
        busy = false;
        
        return {
            result: {
                positionValid,
                distance,
                confidence,
                faceDetected,
                landmarks
            },
            performance: {
                processingTime,
                avgFPS: fpsHistory.length > 0 ? 
                    fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length : 0,
                frameCount,
                backend: human.tf.getBackend(),
                memory: human.tf.engine().state.numBytes
            }
        };
        
    } catch (error) {
        console.error('Face position detection error in worker:', error);
        busy = false;
        return {
            result: {
                positionValid: false,
                distance: 0,
                confidence: 0,
                faceDetected: false,
                landmarks: null
            },
            error: error.message
        };
    }
}

// Handle messages from main thread
self.onmessage = async (event) => {
    const { type, config: userConfig, image, width, height, minimumDestination: minDest } = event.data;
    
    switch (type) {
        case 'init':
            // Initialize Human with provided configuration
            config = userConfig;
            minimumDestination = minDest || 0;
            const success = await initializeHuman(userConfig);
            self.postMessage({ 
                type: 'init', 
                success,
                workerReady: success 
            });
            break;
            
        case 'detect':
            // Perform face position detection
            if (!human) {
                self.postMessage({ 
                    type: 'detect', 
                    result: {
                        positionValid: false,
                        distance: 0,
                        confidence: 0,
                        faceDetected: false,
                        landmarks: null
                    },
                    error: 'Human not initialized' 
                });
                return;
            }
            
            // Create image data object for detection
            const imageData = {
                data: new Uint8ClampedArray(image),
                width: width,
                height: height
            };
            
            const detectionResult = await detectFacePosition(imageData);
            self.postMessage({ 
                type: 'detect', 
                ...detectionResult 
            });
            break;
            
        case 'status':
            // Return worker status
            self.postMessage({
                type: 'status',
                busy,
                frameCount,
                avgFPS: fpsHistory.length > 0 ? 
                    fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length : 0,
                backend: human ? human.tf.getBackend() : 'none',
                memory: human ? human.tf.engine().state.numBytes : 0
            });
            break;
            
        default:
            console.warn('Unknown message type:', type);
    }
};

// Handle worker errors
self.onerror = (error) => {
    console.error('Face position worker error:', error);
    self.postMessage({ 
        type: 'error', 
        error: error.message || 'Unknown worker error' 
    });
};

// Cleanup on worker termination
self.onclose = () => {
    if (human) {
        try {
            human.destroy();
        } catch (error) {
            console.error('Error destroying Human instance:', error);
        }
    }
    console.log('Face position worker terminated');
}; 