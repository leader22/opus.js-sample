importScripts("./speex_resampler.js");
class ResamplingWorker {
    constructor(worker) {
        this.resampler = null;
        this.worker = worker;
        this.worker.onmessage = (e) => {
            this.setup(e.data);
        };
    }
    setup(config) {
        try {
            // eslint-disable-next-line no-undef
            this.resampler = new SpeexResampler(config.channels, config.in_sampling_rate, config.out_sampling_rate, config.quality || 5);
            this.worker.postMessage({
                status: 0
            });
            this.worker.onmessage = (e) => {
                this.process(e.data.samples);
            };
        }
        catch (e) {
            this.worker.postMessage({
                status: -1,
                reason: e
            });
        }
    }
    process(input) {
        try {
            const ret = new Float32Array(this.resampler.process(input));
            this.worker.postMessage({
                status: 0,
                result: ret
            }, [ret.buffer]);
        }
        catch (e) {
            this.worker.postMessage({
                status: -1,
                reason: e
            });
        }
    }
}
new ResamplingWorker(this);
