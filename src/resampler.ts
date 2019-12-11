importScripts("./speex_resampler.js");

interface ISpeexResampler {
  process(input: Float32Array): Float32Array;
}

class ResamplingWorker {
  worker: Worker;
  resampler: ISpeexResampler = null;

  constructor(worker: Worker) {
    this.worker = worker;
    this.worker.onmessage = (e: MessageEvent) => {
      this.setup(e.data);
    };
  }

  setup(config: any) {
    try {
      // eslint-disable-next-line no-undef
      this.resampler = new SpeexResampler(
        config.channels,
        config.in_sampling_rate,
        config.out_sampling_rate,
        config.quality || 5
      );
      this.worker.postMessage({
        status: 0
      });
      this.worker.onmessage = (e: MessageEvent) => {
        this.process(e.data.samples as Float32Array);
      };
    } catch (e) {
      this.worker.postMessage({
        status: -1,
        reason: e
      });
    }
  }

  process(input: Float32Array) {
    try {
      const ret = new Float32Array(this.resampler.process(input));
      this.worker.postMessage(
        {
          status: 0,
          result: ret
        },
        [ret.buffer]
      );
    } catch (e) {
      this.worker.postMessage({
        status: -1,
        reason: e
      });
    }
  }
}

new ResamplingWorker(this);
