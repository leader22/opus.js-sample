import { WebAudioPlayer } from "./player.js";
import { AudioEncoder, AudioDecoder } from "./impl.js";
import { MicrophoneReader } from "./microphone.js";
import { RiffPcmWaveReader } from "./riff_pcm_wave.js";
export class Test {
    constructor() {
        this.player = null;
    }
    // そのままInputをOutputに流す
    play() {
        this.init_player();
        const [reader, open_params] = this.get_reader();
        if (!reader)
            return;
        reader.open(Test.period_size, open_params).then((info) => {
            this.player.onneedbuffer = () => {
                if (reader.in_flight)
                    return;
                reader.read().then((buf) => {
                    this.player
                        .enqueue(buf)
                        .catch(this.output_reject_log("ringbuf enqueue error?"));
                }, e => {
                    this.output_reject_log("reader.read error")(e);
                });
            };
            this.player
                .init(info.sampling_rate, info.num_of_channels, Test.period_size, Test.delay_period_count, Test.ringbuffer_period_count)
                .then(() => {
                this.player.start();
                window.setInterval(() => {
                    console.log(this.player.getBufferStatus());
                }, 1000);
            }, this.output_reject_log("player.init error"));
        }, this.output_reject_log("open error"));
    }
    encode_decode_play() {
        this.init_player();
        const [reader, open_params] = this.get_reader();
        if (!reader)
            return;
        let working = false;
        const packet_queue = [];
        const encoder = new AudioEncoder("opus_encoder.js");
        const decoder = new AudioDecoder("opus_decoder.js");
        reader.open(Test.period_size, open_params).then((info) => {
            const enc_cfg = {
                sampling_rate: info.sampling_rate,
                num_of_channels: info.num_of_channels,
                params: {
                    application: parseInt(document.getElementById("opus_app").value, 10),
                    sampling_rate: parseInt(document.getElementById("opus_sampling_rate").value, 10) * 1000,
                    frame_duration: parseFloat(document.getElementById("opus_frame_duration")
                        .value)
                }
            };
            encoder.setup(enc_cfg).then((packets) => {
                decoder.setup({}, packets).then((info) => {
                    this.player
                        .init(info.sampling_rate, info.num_of_channels, Test.period_size, Test.delay_period_count, Test.ringbuffer_period_count)
                        .then(() => {
                        this.player.start();
                        window.setInterval(() => {
                            console.log(this.player.getBufferStatus());
                        }, 1000);
                    }, this.output_reject_log("player.init error"));
                }, this.output_reject_log("decoder.setup error"));
            }, this.output_reject_log("encoder.setup error"));
        }, this.output_reject_log("open error"));
        this.player.onneedbuffer = () => {
            if (reader.in_flight || working)
                return;
            working = true;
            if (packet_queue.length > 0) {
                const packet = packet_queue.shift();
                decoder.decode(packet).then((buf) => {
                    this.player
                        .enqueue(buf)
                        .catch(this.output_reject_log("ringbuf enqueue error?"));
                    working = false;
                }, this.output_reject_log("decoder.decode error"));
            }
            else {
                reader.read().then((buf) => {
                    encoder.encode(buf).then((packets) => {
                        if (packets.length == 0) {
                            working = false;
                            return;
                        }
                        for (let i = 1; i < packets.length; ++i)
                            packet_queue.push(packets[i]);
                        decoder.decode(packets[0]).then((buf) => {
                            this.player
                                .enqueue(buf)
                                .catch(this.output_reject_log("ringbuf enqueue error?"));
                            working = false;
                        }, this.output_reject_log("decoder.decode error"));
                    }, this.output_reject_log("encoder.encode error"));
                }, this.output_reject_log("reader.read error"));
            }
        };
    }
    init_player() {
        if (this.player)
            this.player.close();
        this.player = new WebAudioPlayer();
    }
    // マイクかファイルかをInputとでき、どちらでも抽象化したAudioReaderを返す
    get_reader() {
        const radio_mic = document.getElementById("input_mic");
        const radio_file = document.getElementById("input_file");
        let reader = null;
        let params = null;
        if (radio_mic.checked) {
            reader = new MicrophoneReader();
            params = {};
        }
        else if (radio_file.checked) {
            const input_file = document.getElementById("input_filedata");
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
    }
    output_reject_log(prefix) {
        return e => {
            this.player.close();
            console.log(prefix, e);
        };
    }
}
Test.period_size = 1024;
Test.delay_period_count = 4;
Test.ringbuffer_period_count = Test.delay_period_count * 4;
