const SMOOTHING_FACTOR = 0.8;
const MINIMUM_VALUE = 0.00001;

export class AudioLevelProcessor extends AudioWorkletProcessor {

	volume;
	updateIntervalInMS;
	nextUpdateFrame;

	constructor() {
		super();
		this.volume = 0;
		this.updateIntervalInMS = 25;
		this.nextUpdateFrame = this.updateIntervalInMS;
		this.port.onmessage = event => {
			if (event.data.updateIntervalInMS)
				this.updateIntervalInMS = event.data.updateIntervalInMS;
		};
	}

	get intervalInFrames() {
		return this.updateIntervalInMS / 1000 * 44100;
	}

	process(inputs, outputs, parameters) {
		const input = inputs[0];

		if (input.length > 0) {
			const samples = input[0];
			let sum = 0;
			let rms = 0;

			for (let i = 0; i < samples.length; ++i)
				sum += samples[i] * samples[i];

			rms = Math.sqrt(sum / samples.length);
			this.volume = Math.max(rms, this.volume * SMOOTHING_FACTOR);

			// Update and sync the volume property with the main thread.
			this.nextUpdateFrame -= samples.length;
			if (this.nextUpdateFrame < 0) {
				this.nextUpdateFrame += this.intervalInFrames;
				this.port.postMessage({ volume: this.volume });
			}
		}

		return true;
	}
}

registerProcessor('audio-level', AudioLevelProcessor);
