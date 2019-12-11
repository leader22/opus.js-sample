export class RiffPcmWaveReader {
    constructor() {
        this.in_flight = false;
        // 読み込みカーソル位置(data_offsetからの相対位置)
        this.read_pos = 0;
        this.reader = new FileReader();
    }
    open(buffer_samples_per_ch, params) {
        this.buffer_samples_per_ch = buffer_samples_per_ch;
        return new Promise((resolve, reject) => {
            this.file = params.file;
            if (!(this.file instanceof File)) {
                reject("invalid params");
                return;
            }
            this.readHeader().then(resolve, reject);
        });
    }
    read() {
        this.in_flight = true;
        return new Promise((resolve, reject) => {
            this.readBytes(this.data_offset + this.read_pos, this.buffer_bytes).then((data) => {
                this.in_flight = false;
                this.read_pos += data.byteLength;
                const [samples, transferable] = this.convert(data);
                resolve({
                    timestamp: 0,
                    samples: samples,
                    transferable: transferable
                });
            }, e => {
                reject({
                    pos: this.data_offset + this.read_pos,
                    len: this.buffer_bytes,
                    reason: e.reason
                });
            });
        });
    }
    close() {
        console.log("not implemented!");
    }
    readHeader() {
        let off = 0;
        let state = 0;
        let chunk_size = 0;
        let found_fmt_chunk = false;
        let found_data_chunk = false;
        const info = {
            sampling_rate: 0,
            num_of_channels: 0
        };
        const equals = (txt, bytes) => {
            if (txt.length !== bytes.length)
                return false;
            // const txt2 = String.fromCharCode.apply(String, bytes);
            const txt2 = String.fromCharCode(...bytes);
            return txt === txt2;
        };
        return new Promise((resolve, reject) => {
            const parse = (data) => {
                const v8 = new Uint8Array(data);
                switch (state) {
                    case 0: // RIFF Header
                        if (equals("RIFF", v8.subarray(0, 4)) &&
                            equals("WAVE", v8.subarray(8, 12))) {
                            state = 1;
                            off = 12;
                            this.readBytes(off, 8).then(parse, reject);
                        }
                        else {
                            reject("invalid RIFF");
                        }
                        return;
                    case 1: // find fmt/data chunk
                        chunk_size = v8[4] | (v8[5] << 8) | (v8[6] << 16) | (v8[7] << 24);
                        if (equals("fmt ", v8.subarray(0, 4))) {
                            state = 2;
                            off += 8;
                            this.readBytes(off, chunk_size).then(parse, reject);
                            return;
                        }
                        else if (equals("data", v8.subarray(0, 4))) {
                            this.data_offset = off + 8;
                            this.data_bytes = chunk_size;
                            if (found_fmt_chunk) {
                                resolve(info);
                                return;
                            }
                            found_data_chunk = true;
                        }
                        off += chunk_size;
                        this.readBytes(off, 8).then(parse, reject);
                        return;
                    case 2: // parse fmd chunk
                        var v16 = new Uint16Array(data);
                        var v32 = new Uint32Array(data);
                        if (v16[0] != 1 && v16[0] != 3) {
                            reject("not PCM wave");
                            return;
                        }
                        info.num_of_channels = v16[1];
                        info.sampling_rate = v32[1];
                        this.bits_per_sample = v16[7];
                        this.convert = null;
                        if (v16[0] == 1) {
                            // Integer PCM
                            if (this.bits_per_sample == 8) {
                                this.convert = this.convert_from_i8;
                            }
                            else if (this.bits_per_sample == 16) {
                                this.convert = this.convert_from_i16;
                            }
                            else if (this.bits_per_sample == 24) {
                                this.convert = this.convert_from_i24;
                            }
                        }
                        else if (v16[0] == 3) {
                            // Floating-point PCM
                            if (this.bits_per_sample == 32) {
                                this.convert = this.convert_from_f32;
                            }
                        }
                        if (!this.convert) {
                            reject("not supported format");
                            return;
                        }
                        this.buffer_bytes =
                            this.buffer_samples_per_ch *
                                (this.bits_per_sample / 8) *
                                info.num_of_channels;
                        this.output = new Float32Array(this.buffer_samples_per_ch * info.num_of_channels);
                        if (found_data_chunk) {
                            resolve(info);
                        }
                        else {
                            state = 1;
                            off += chunk_size;
                            found_fmt_chunk = true;
                            this.readBytes(off, 8).then(parse, reject);
                        }
                        return;
                }
            };
            off = 0;
            this.readBytes(off, 12).then(parse, reject);
        });
    }
    readBytes(offset, bytes) {
        return new Promise((resolve, reject) => {
            this.reader.onloadend = ev => {
                const ret = this.reader.result;
                if (ret) {
                    resolve(ret);
                }
                else {
                    reject({
                        reason: this.reader.error
                    });
                }
            };
            this.reader.readAsArrayBuffer(this.file.slice(offset, offset + bytes));
        });
    }
    convert_from_i8(data) {
        const view = new Int8Array(data);
        const out = this.output;
        for (let i = 0; i < view.length; ++i) {
            out[i] = view[i] / 128.0;
        }
        if (view.length != out.length) {
            return [out.subarray(0, view.length), false];
        }
        return [out, false];
    }
    convert_from_i16(data) {
        const view = new Int16Array(data);
        const out = this.output;
        for (let i = 0; i < view.length; ++i) {
            out[i] = view[i] / 32768.0;
        }
        if (view.length != out.length) {
            return [out.subarray(0, view.length), false];
        }
        return [out, false];
    }
    convert_from_i24(data) {
        const v0 = new Int8Array(data);
        const v1 = new Uint8Array(data);
        const out = this.output;
        const out_samples = v0.length / 3;
        for (let i = 0; i < out_samples; ++i) {
            const lo = v1[i * 3];
            const md = v1[i * 3 + 1] << 8;
            const hi = v0[i * 3 + 2] << 16;
            out[i] = (hi | md | lo) / 8388608.0;
        }
        if (out_samples != out.length) {
            return [out.subarray(0, out_samples), false];
        }
        return [out, false];
    }
    convert_from_f32(data) {
        return [new Float32Array(data), true];
    }
}
