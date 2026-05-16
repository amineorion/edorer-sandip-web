self.onmessage = async event => {
	if (!self.faceModel) {
		importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs', 'https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface');
		self.faceModel = await blazeface.load();
	}

	const prediction = await self.faceModel.estimateFaces(event.data.videoElement, false);
	postMessage(prediction);
};
