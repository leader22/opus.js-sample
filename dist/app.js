/// <reference path="api.d.ts" />
/// <reference path="riff_pcm_wave.ts" />
/// <reference path="microphone.ts" />
/// <reference path="player.ts" />
/// <reference path="impl.ts" />
var Test = /** @class */ (function () {
    function Test() {
        this.player = null;
    }
    Test.prototype.play = function () {
        var _this = this;
        this.init_player();
        var _a = this.get_reader(), reader = _a[0], open_params = _a[1];
        if (!reader)
            return;
        reader.open(Test.period_size, open_params).then(function (info) {
            _this.player.onneedbuffer = function () {
                if (reader.in_flight)
                    return;
                reader.read().then(function (buf) {
                    _this.player
                        .enqueue(buf)["catch"](_this.output_reject_log("ringbuf enqueue error?"));
                }, function (e) {
                    _this.output_reject_log("reader.read error")(e);
                });
            };
            _this.player
                .init(info.sampling_rate, info.num_of_channels, Test.period_size, Test.delay_period_count, Test.ringbuffer_period_count)
                .then(function () {
                _this.player.start();
                window.setInterval(function () {
                    console.log(_this.player.getBufferStatus());
                }, 1000);
            }, _this.output_reject_log("player.init error"));
        }, this.output_reject_log("open error"));
    };
    Test.prototype.encode_decode_play = function () {
        var _this = this;
        this.init_player();
        var _a = this.get_reader(), reader = _a[0], open_params = _a[1];
        if (!reader)
            return;
        var working = false;
        var packet_queue = [];
        var encoder = new AudioEncoder("opus_encoder.js");
        var decoder = new AudioDecoder("opus_decoder.js");
        reader.open(Test.period_size, open_params).then(function (info) {
            var enc_cfg = {
                sampling_rate: info.sampling_rate,
                num_of_channels: info.num_of_channels,
                params: {
                    application: parseInt(document.getElementById("opus_app").value, 10),
                    sampling_rate: parseInt(document.getElementById("opus_sampling_rate")
                        .value, 10) * 1000,
                    frame_duration: parseFloat(document.getElementById("opus_frame_duration")
                        .value)
                }
            };
            encoder.setup(enc_cfg).then(function (packets) {
                decoder.setup({}, packets).then(function (info) {
                    _this.player
                        .init(info.sampling_rate, info.num_of_channels, Test.period_size, Test.delay_period_count, Test.ringbuffer_period_count)
                        .then(function () {
                        _this.player.start();
                        window.setInterval(function () {
                            console.log(_this.player.getBufferStatus());
                        }, 1000);
                    }, _this.output_reject_log("player.init error"));
                }, _this.output_reject_log("decoder.setup error"));
            }, _this.output_reject_log("encoder.setup error"));
        }, this.output_reject_log("open error"));
        this.player.onneedbuffer = function () {
            if (reader.in_flight || working)
                return;
            working = true;
            if (packet_queue.length > 0) {
                var packet = packet_queue.shift();
                decoder.decode(packet).then(function (buf) {
                    _this.player
                        .enqueue(buf)["catch"](_this.output_reject_log("ringbuf enqueue error?"));
                    working = false;
                }, _this.output_reject_log("decoder.decode error"));
            }
            else {
                reader.read().then(function (buf) {
                    encoder.encode(buf).then(function (packets) {
                        if (packets.length == 0) {
                            working = false;
                            return;
                        }
                        for (var i = 1; i < packets.length; ++i)
                            packet_queue.push(packets[i]);
                        decoder.decode(packets[0]).then(function (buf) {
                            _this.player
                                .enqueue(buf)["catch"](_this.output_reject_log("ringbuf enqueue error?"));
                            working = false;
                        }, _this.output_reject_log("decoder.decode error"));
                    }, _this.output_reject_log("encoder.encode error"));
                }, _this.output_reject_log("reader.read error"));
            }
        };
    };
    Test.prototype.init_player = function () {
        if (this.player)
            this.player.close();
        this.player = new WebAudioPlayer();
    };
    Test.prototype.get_reader = function () {
        var radio_mic = document.getElementById("input_mic");
        var radio_file = document.getElementById("input_file");
        var reader = null;
        var params = null;
        if (radio_mic.checked) {
            reader = new MicrophoneReader();
            params = {};
        }
        else if (radio_file.checked) {
            var input_file = (document.getElementById("input_filedata"));
            if (input_file.files.length != 1) {
                alert("not choose file");
                return;
            }
            reader = new RiffPcmWaveReader();
            params = {
                file: input_file.files[0]
            };
        }
        else {
            alert("not choose mic or file");
        }
        return [reader, params];
    };
    Test.prototype.output_reject_log = function (prefix) {
        var _this = this;
        return function (e) {
            _this.player.close();
            console.log(prefix, e);
        };
    };
    Test.period_size = 1024;
    Test.delay_period_count = 4;
    Test.ringbuffer_period_count = Test.delay_period_count * 4;
    return Test;
}());
export default Test;
