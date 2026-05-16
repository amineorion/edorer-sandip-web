importScripts('https://cdn.jsdelivr.net/npm/@vladmandic/human/dist/human.js');

let human;
let offscreenCanvas = null;

const humanConfig = {
    debug: true,
    useWorker: false, // Don't use nested workers
    maxDetected: 10,
    modelBasePath: 'https://vladmandic.github.io/human-models/models/',
    filter: { enabled: true, equalization: false, flip: false },
    face: {
        enabled: true,
        maxDetected: 10,
        detector: {
            enabled: true,
            rotation: false,
            maxDetected: 5,
        },
        mesh: { enabled: true },
        attention: { enabled: false },
        iris: { enabled: true },
        description: { enabled: true },
        emotion: { enabled: true },
        antispoof: { enabled: true },
        liveness: { enabled: true }
    },
    body: { enabled: true, maxDetected: 10 },
    hand: { enabled: false },
    object: { enabled: true, maxDetected: 10 },
    segmentation: { enabled: false },
    gesture: { enabled: true, maxDetected: 10 },
};

async function initHuman() {
    human = new Human.Human(humanConfig);
    await human.load();
    self.postMessage({ type: 'INIT_COMPLETE' });
}

self.onmessage = async function(e) {

    const result = await human.detect(e.data.videoElement);
            postMessage({
                type: 'DETECTION_RESULT',
                data: {
                    object: result.object,
                    face: result.face,
                    gesture: result.gesture
                },
                timestamp: Date.now()
            });
};

initHuman(); 