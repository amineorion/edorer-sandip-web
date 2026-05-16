import { CONSTANT } from '../../app/shared/utils/constants';

const DOMAIN = 'http://localhost:5050';

let faceapi;

self.onmessage = async event => {
    console.warn(self);
    if (!self.faceapi) {
        importScripts(CONSTANT.DOMAIN + '/assets/js/face-api.min.js')
        self.faceapi = true;

        await faceapi.loadFaceLandmarkModel(CONSTANT.DOMAIN + '/assets/json/');
        await faceapi.loadFaceRecognitionModel(CONSTANT.DOMAIN + '/assets/json/');
        await faceapi.nets.tinyFaceDetector.load(CONSTANT.DOMAIN + '/assets/json/');
    }

    let options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.2 });
    const task = await faceapi.detectAllFaces(event.data.videoElement, options).withFaceLandmarks();

    postMessage(task);
};
