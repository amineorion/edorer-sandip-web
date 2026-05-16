self.onmessage = async event => {
    if (!self.cocoSsdModel) {
        // importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs', 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd');
        importScripts(
            "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.12.0/dist/tf.min.js",
            "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-webgl@3.12.0/dist/tf-backend-webgl.min.js",
            "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd"
        )

        tf.setBackend('webgl')
        self.cocoSsdModel = await cocoSsd.load();
    }
    self.cocoSsdModel.detect(event.data.videoElement).then(predictions => {
        postMessage(predictions);
        tf.dispose();
    });
};
