// Mobile / object detector worker.
//
// Reported by an MMU tester: "mobile violation not working in android".
// importScripts() against jsdelivr was failing silently inside Capacitor's
// WebView. capacitor.config.ts now allows cdn.jsdelivr.net, and we now report
// init errors back to the main thread so the ObjectDetector can surface them.
self.onmessage = async event => {
    try {
        if (!self.cocoSsdModel) {
            try {
                importScripts(
                    "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@2.7.0/dist/tf.min.js",
                    "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-cpu@2.7.0/dist/tf-backend-cpu.min.js",
                    "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-webgl@2.7.0/dist/tf-backend-webgl.min.js",
                    "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd"
                );
            } catch (importErr) {
                postMessage({ __error: 'importScripts', message: (importErr && importErr.message) || String(importErr) });
                return;
            }
            try {
                self.cocoSsdModel = await cocoSsd.load();
            } catch (loadErr) {
                postMessage({ __error: 'cocoSsd.load', message: (loadErr && loadErr.message) || String(loadErr) });
                return;
            }
        }
        const predictions = await self.cocoSsdModel.detect(event.data.videoElement);
        postMessage(predictions);
    } catch (e) {
        postMessage({ __error: 'detect', message: (e && e.message) || String(e) });
    }
};
