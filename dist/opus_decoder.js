class OpusDecoder {
    constructor(worker) {
        this.worker = worker;
        this.worker.onmessage = ev => {
            this.setup(ev.data.config, ev.data.packets);
        };
    }
    setup(config, packets) {
        if (packets.length != 1 || packets[0].data.byteLength != 19) {
            this.worker.postMessage({
                status: -1,
                reason: "invalid opus header packet"
            });
            return;
        }
        // https://wiki.xiph.org/OggOpus
        let invalid = false;
        const view8 = new Uint8Array(packets[0].data);
        const view32 = new Uint32Array(packets[0].data, 12, 1);
        const magic = "OpusHead";
        for (let i = 0; i < magic.length; ++i) {
            if (view8[i] != magic.charCodeAt(i))
                invalid = true;
        }
        invalid = invalid || view8[8] != 1;
        this.channels = view8[9];
        invalid = invalid || this.channels == 0 || this.channels > 2;
        const sampling_rate = view32[0];
        invalid = invalid || view8[18] != 0;
        if (invalid) {
            this.worker.postMessage({
                status: -1,
                reason: "invalid opus header packet"
            });
            return;
        }
        const err = Module._malloc(4);
        this.handle = _opus_decoder_create(sampling_rate, this.channels, err);
        const err_num = Module.getValue(err, "i32");
        Module._free(err);
        if (err_num != 0) {
            this.worker.postMessage({
                status: err_num
            });
            return;
        }
        this.frame_size = (sampling_rate * 60) /* max frame duration[ms] */ / 1000;
        const buf_size = 1275 * 3 + 7;
        const pcm_samples = this.frame_size * this.channels;
        this.buf_ptr = Module._malloc(buf_size);
        this.pcm_ptr = Module._malloc(4 * pcm_samples);
        this.buf = Module.HEAPU8.subarray(this.buf_ptr, this.buf_ptr + buf_size);
        this.pcm = Module.HEAPF32.subarray(this.pcm_ptr / 4, this.pcm_ptr / 4 + pcm_samples);
        this.worker.onmessage = ev => {
            this.decode(ev.data);
        };
        this.worker.postMessage({
            status: 0,
            sampling_rate: sampling_rate,
            num_of_channels: this.channels
        });
    }
    decode(packet) {
        this.buf.set(new Uint8Array(packet.data));
        const ret = _opus_decode_float(this.handle, this.buf_ptr, packet.data.byteLength, this.pcm_ptr, this.frame_size, 0);
        if (ret < 0) {
            this.worker.postMessage({
                status: ret
            });
            return;
        }
        const buf = {
            status: 0,
            timestamp: 0,
            samples: new Float32Array(this.pcm.subarray(0, ret * this.channels)),
            transferable: true
        };
        this.worker.postMessage(buf, [buf.samples.buffer]);
    }
}
new OpusDecoder(this);
