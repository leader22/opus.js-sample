import { RingBuffer } from "./ring_buffer.js";
export class MicrophoneReader {
    // 1024
    open(buffer_samples_per_ch, params) {
        this.context = new AudioContext();
        return new Promise((resolve, reject) => {
            const callback = strm => {
                this.src_node = this.context.createMediaStreamSource(strm);
                this.ringbuf = new RingBuffer(new Float32Array(
                // 1024 * 2 * 8 = 16384
                buffer_samples_per_ch * this.src_node.channelCount * 8));
                this.proc_node = this.context.createScriptProcessor(0, 1, this.src_node.channelCount);
                this.proc_node.onaudioprocess = (ev) => {
                    this._onaudioprocess(ev);
                };
                this.src_node.connect(this.proc_node);
                this.proc_node.connect(this.context.destination);
                // 1024 * 2 = 2048
                this.read_unit = buffer_samples_per_ch * this.src_node.channelCount;
                // 24000, 2
                resolve({
                    sampling_rate: this.context.sampleRate / 2,
                    num_of_channels: this.src_node.channelCount
                });
            };
            navigator.mediaDevices
                .getUserMedia({ audio: true, video: false })
                .then(callback, reject);
        });
    }
    _onaudioprocess(ev) {
        const num_of_ch = ev.inputBuffer.numberOfChannels;
        const samples_per_ch = ev.inputBuffer.getChannelData(0).length;
        const data = new Float32Array(num_of_ch * samples_per_ch);
        for (let i = 0; i < num_of_ch; ++i) {
            const ch = ev.inputBuffer.getChannelData(i);
            for (let j = 0; j < samples_per_ch; ++j)
                data[j * num_of_ch + i] = ch[j];
        }
        this.ringbuf.append(data);
    }
    read() {
        this.in_flight = true;
        return new Promise((resolve, reject) => {
            const buf = new Float32Array(this.read_unit);
            const func = () => {
                const size = this.ringbuf.read_some(buf);
                if (size == 0) {
                    window.setTimeout(() => {
                        func();
                    }, 10);
                    return;
                }
                this.in_flight = false;
                resolve({
                    timestamp: 0,
                    samples: buf.subarray(0, size),
                    transferable: true
                });
            };
            func();
        });
    }
    close() {
        console.log("not implemented");
    }
}
