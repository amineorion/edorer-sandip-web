/**
 * Web worker for face existence detection
 * Based on Human.js demo patterns for optimal performance
 */

// Load Human library using IIFE script for better compatibility
self.importScripts('https://cdn.jsdelivr.net/npm/@vladmandic/human@3.1.2/dist/human.js');

let human = null;
let busy = false;
let config = null;

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
        
        console.log('Face existence worker initialized with Human version:', human.version);
        return true;
    } catch (error) {
        console.error('Failed to initialize Human in worker:', error);
        return false;
    }
}

// Optimized face detection function
async function detectFace(imageData) {
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
        
        // Check if face was detected with sufficient confidence
        const faceDetected = result.face && 
                           result.face.length > 0 && 
                           result.face[0].score > 0.5;
        
        // Clean up tensors to prevent memory leaks
        if (result.tensors) {
            human.tf.engine().startScope();
            human.tf.engine().endScope();
        }
        
        busy = false;
        
        return {
            result: faceDetected,
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
        console.error('Face detection error in worker:', error);
        busy = false;
        return {
            result: false,
            error: error.message
        };
    }
}

// Handle messages from main thread
self.onmessage = async (event) => {
    const { type, config: userConfig, image, width, height } = event.data;
    
    switch (type) {
        case 'init':
            // Initialize Human with provided configuration
            config = userConfig;
            const success = await initializeHuman(userConfig);
            self.postMessage({ 
                type: 'init', 
                success,
                workerReady: success 
            });
            break;
            
        case 'detect':
            // Perform face detection
            if (!human) {
                self.postMessage({ 
                    type: 'detect', 
                    result: false, 
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
            
            const detectionResult = await detectFace(imageData);
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
    console.error('Face existence worker error:', error);
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
    console.log('Face existence worker terminated');
}; 