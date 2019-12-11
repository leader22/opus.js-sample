import { RingBuffer } from "./ring_buffer.js";
export class WebAudioPlayer {
    constructor() {
        this.in_writing = false;
        this.buffering = true;
        this.onneedbuffer = null;
        this.in_requesting_check_buffer = false;
    }
    // 24000, 2, 1024, 4, 16
    init(sampling_rate, num_of_channels, period_samples, delay_periods, buffer_periods) {
        return new Promise((resolve, reject) => {
            this.context = new AudioContext();
            this.node = this.context.createScriptProcessor(period_samples, 0, num_of_channels);
            this.node.onaudioprocess = ev => {
                this._onaudioprocess(ev);
            };
            if (sampling_rate != this.getActualSamplingRate()) {
                console.log("enable resampling: " +
                    sampling_rate +
                    " -> " +
                    this.getActualSamplingRate());
                this.period_samples =
                    Math.ceil((period_samples * this.getActualSamplingRate()) / sampling_rate) * num_of_channels;
                this.resampler = new Worker("resampler.js");
            }
            else {
                this.period_samples = period_samples * num_of_channels;
            }
            this.ringbuf = new RingBuffer(new Float32Array(this.period_samples * buffer_periods));
            this.delay_samples = this.period_samples * delay_periods;
            if (this.resampler) {
                this.resampler.onmessage = ev => {
                    if (ev.data.status == 0) {
                        resolve();
                    }
                    else {
                        reject(ev.data);
                    }
                };
                this.resampler.postMessage({
                    channels: num_of_channels,
                    in_sampling_rate: sampling_rate,
                    out_sampling_rate: this.getActualSamplingRate()
                });
            }
            else {
                resolve();
            }
        });
    }
    enqueue(buf) {
        return new Promise((resolve, reject) => {
            if (this.in_writing) {
                reject();
                return;
            }
            this.in_writing = true;
            const func = (data) => {
                this.ringbuf.append(data).then(() => {
                    this.in_writing = false;
                    this.check_buffer();
                }, e => {
                    this.in_writing = false;
                    reject(e);
                });
            };
            if (this.resampler) {
                const transfer_list = buf.transferable ? [buf.samples.buffer] : [];
                this.resampler.onmessage = ev => {
                    if (ev.data.status != 0) {
                        this.in_writing = false;
                        reject(ev.data);
                        return;
                    }
                    func(ev.data.result);
                };
                this.resampler.postMessage({
                    samples: buf.samples
                }, transfer_list);
            }
            else {
                func(buf.samples);
            }
        });
    }
    _onaudioprocess(ev) {
        if (this.buffering) {
            this.check_buffer();
            return;
        }
        const N = ev.outputBuffer.numberOfChannels;
        const buf = new Float32Array(ev.outputBuffer.getChannelData(0).length * N);
        const size = this.ringbuf.read_some(buf) / N;
        for (let i = 0; i < N; ++i) {
            const ch = ev.outputBuffer.getChannelData(i);
            for (let j = 0; j < size; ++j)
                ch[j] = buf[j * N + i];
        }
        this.check_buffer(true);
    }
    check_buffer(useTimeOut = false) {
        if (this.in_requesting_check_buffer || !this.onneedbuffer)
            return;
        const needbuf = this.check_buffer_internal();
        if (!needbuf)
            return;
        if (useTimeOut) {
            this.in_requesting_check_buffer = true;
            window.setTimeout(() => {
                this.in_requesting_check_buffer = false;
                if (this.check_buffer_internal())
                    this.onneedbuffer();
            }, 0);
        }
        else {
            this.onneedbuffer();
        }
    }
    check_buffer_internal() {
        if (this.in_writing)
            return false;
        const avail = this.ringbuf.available();
        const size = this.ringbuf.size();
        if (size >= this.delay_samples)
            this.buffering = false;
        if (this.period_samples <= avail)
            return true;
        return false;
    }
    start() {
        if (this.node) {
            this.node.connect(this.context.destination);
        }
    }
    stop() {
        if (this.node) {
            this.ringbuf.clear();
            this.buffering = true;
            this.node.disconnect();
        }
    }
    close() {
        this.stop();
        this.context = null;
        this.node = null;
    }
    getActualSamplingRate() {
        return this.context.sampleRate;
    }
    getBufferStatus() {
        return {
            delay: this.ringbuf.size(),
            available: this.ringbuf.available(),
            capacity: this.ringbuf.capacity()
        };
    }
}
