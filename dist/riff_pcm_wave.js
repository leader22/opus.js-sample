/// <reference path="api.d.ts" />
var RiffPcmWaveReader = /** @class */ (function () {
    function RiffPcmWaveReader() {
        this.in_flight = false;
        // 読み込みカーソル位置(data_offsetからの相対位置)
        this.read_pos = 0;
        this.reader = new FileReader();
    }
    RiffPcmWaveReader.prototype.open = function (buffer_samples_per_ch, params) {
        var _this = this;
        this.buffer_samples_per_ch = buffer_samples_per_ch;
        return new Promise(function (resolve, reject) {
            _this.file = params.file;
            if (!(_this.file instanceof File)) {
                reject("invalid params");
                return;
            }
            _this.readHeader().then(resolve, reject);
        });
    };
    RiffPcmWaveReader.prototype.read = function () {
        var _this = this;
        this.in_flight = true;
        return new Promise(function (resolve, reject) {
            _this.readBytes(_this.data_offset + _this.read_pos, _this.buffer_bytes).then(function (data) {
                _this.in_flight = false;
                _this.read_pos += data.byteLength;
                var _a = _this.convert(data), samples = _a[0], transferable = _a[1];
                resolve({
                    timestamp: 0,
                    samples: samples,
                    transferable: transferable
                });
            }, function (e) {
                reject({
                    pos: _this.data_offset + _this.read_pos,
                    len: _this.buffer_bytes,
                    reason: e.reason
                });
            });
        });
    };
    RiffPcmWaveReader.prototype.close = function () { };
    RiffPcmWaveReader.prototype.readHeader = function () {
        var _this = this;
        var off = 0;
        var state = 0;
        var chunk_size = 0;
        var found_fmt_chunk = false;
        var found_data_chunk = false;
        var info = {
            sampling_rate: 0,
            num_of_channels: 0
        };
        var equals = function (txt, bytes) {
            if (txt.length !== bytes.length)
                return false;
            var txt2 = String.fromCharCode.apply(String, bytes);
            return txt === txt2;
        };
        return new Promise(function (resolve, reject) {
            var parse = function (data) {
                var v8 = new Uint8Array(data);
                switch (state) {
                    case 0: // RIFF Header
                        if (equals("RIFF", v8.subarray(0, 4)) &&
                            equals("WAVE", v8.subarray(8, 12))) {
                            state = 1;
                            off = 12;
                            _this.readBytes(off, 8).then(parse, reject);
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
                            _this.readBytes(off, chunk_size).then(parse, reject);
                            return;
                        }
                        else if (equals("data", v8.subarray(0, 4))) {
                            _this.data_offset = off + 8;
                            _this.data_bytes = chunk_size;
                            if (found_fmt_chunk) {
                                resolve(info);
                                return;
                            }
                            found_data_chunk = true;
                        }
                        off += chunk_size;
                        _this.readBytes(off, 8).then(parse, reject);
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
                        _this.bits_per_sample = v16[7];
                        _this.convert = null;
                        if (v16[0] == 1) {
                            // Integer PCM
                            if (_this.bits_per_sample == 8) {
                                _this.convert = _this.convert_from_i8;
                            }
                            else if (_this.bits_per_sample == 16) {
                                _this.convert = _this.convert_from_i16;
                            }
                            else if (_this.bits_per_sample == 24) {
                                _this.convert = _this.convert_from_i24;
                            }
                        }
                        else if (v16[0] == 3) {
                            // Floating-point PCM
                            if (_this.bits_per_sample == 32) {
                                _this.convert = _this.convert_from_f32;
                            }
                        }
                        if (!_this.convert) {
                            reject("not supported format");
                            return;
                        }
                        _this.buffer_bytes =
                            _this.buffer_samples_per_ch *
                                (_this.bits_per_sample / 8) *
                                info.num_of_channels;
                        _this.output = new Float32Array(_this.buffer_samples_per_ch * info.num_of_channels);
                        if (found_data_chunk) {
                            resolve(info);
                        }
                        else {
                            state = 1;
                            off += chunk_size;
                            found_fmt_chunk = true;
                            _this.readBytes(off, 8).then(parse, reject);
                        }
                        return;
                }
            };
            off = 0;
            _this.readBytes(off, 12).then(parse, reject);
        });
    };
    RiffPcmWaveReader.prototype.readBytes = function (offset, bytes) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.reader.onloadend = function (ev) {
                var ret = _this.reader.result;
                if (ret) {
                    resolve(ret);
                }
                else {
                    reject({
                        reason: _this.reader.error
                    });
                }
            };
            _this.reader.readAsArrayBuffer(_this.file.slice(offset, offset + bytes));
        });
    };
    RiffPcmWaveReader.prototype.convert_from_i8 = function (data) {
        var view = new Int8Array(data);
        var out = this.output;
        for (var i = 0; i < view.length; ++i) {
            out[i] = view[i] / 128.0;
        }
        if (view.length != out.length) {
            return [out.subarray(0, view.length), false];
        }
        return [out, false];
    };
    RiffPcmWaveReader.prototype.convert_from_i16 = function (data) {
        var view = new Int16Array(data);
        var out = this.output;
        for (var i = 0; i < view.length; ++i) {
            out[i] = view[i] / 32768.0;
        }
        if (view.length != out.length) {
            return [out.subarray(0, view.length), false];
        }
        return [out, false];
    };
    RiffPcmWaveReader.prototype.convert_from_i24 = function (data) {
        var v0 = new Int8Array(data);
        var v1 = new Uint8Array(data);
        var out = this.output;
        var out_samples = v0.length / 3;
        for (var i = 0; i < out_samples; ++i) {
            var lo = v1[i * 3];
            var md = v1[i * 3 + 1] << 8;
            var hi = v0[i * 3 + 2] << 16;
            out[i] = (hi | md | lo) / 8388608.0;
        }
        if (out_samples != out.length) {
            return [out.subarray(0, out_samples), false];
        }
        return [out, false];
    };
    RiffPcmWaveReader.prototype.convert_from_f32 = function (data) {
        return [new Float32Array(data), true];
    };
    return RiffPcmWaveReader;
}());
