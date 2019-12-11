/// <reference path="api.d.ts" />
/// <reference path="riff_pcm_wave.ts" />
/// <reference path="microphone.ts" />
/// <reference path="impl.ts" />

import { WebAudioPlayer } from "./player.js";

export class Test {
  private player: IPlayer = null;
  private static period_size = 1024;
  private static delay_period_count = 4;
  private static ringbuffer_period_count = Test.delay_period_count * 4;

  play(): void {
    this.init_player();

    const [reader, open_params] = this.get_reader();
    if (!reader) return;

    reader.open(Test.period_size, open_params).then((info: IAudioInfo) => {
      this.player.onneedbuffer = () => {
        if (reader.in_flight) return;
        reader.read().then(
          (buf: IAudioBuffer) => {
            this.player
              .enqueue(buf)
              .catch(this.output_reject_log("ringbuf enqueue error?"));
          },
          e => {
            this.output_reject_log("reader.read error")(e);
          }
        );
      };
      this.player
        .init(
          info.sampling_rate,
          info.num_of_channels,
          Test.period_size,
          Test.delay_period_count,
          Test.ringbuffer_period_count
        )
        .then(() => {
          this.player.start();
          window.setInterval(() => {
            console.log(this.player.getBufferStatus());
          }, 1000);
        }, this.output_reject_log("player.init error"));
    }, this.output_reject_log("open error"));
  }

  encode_decode_play(): void {
    this.init_player();

    const [reader, open_params] = this.get_reader();
    if (!reader) return;

    let working = false;
    const packet_queue = [];
    const encoder = new AudioEncoder("opus_encoder.js");
    const decoder = new AudioDecoder("opus_decoder.js");
    reader.open(Test.period_size, open_params).then((info: IAudioInfo) => {
      const enc_cfg = {
        sampling_rate: info.sampling_rate,
        num_of_channels: info.num_of_channels,
        params: {
          application: parseInt(
            (<HTMLInputElement>document.getElementById("opus_app")).value,
            10
          ),
          sampling_rate:
            parseInt(
              (<HTMLInputElement>document.getElementById("opus_sampling_rate"))
                .value,
              10
            ) * 1000,
          frame_duration: parseFloat(
            (<HTMLInputElement>document.getElementById("opus_frame_duration"))
              .value
          )
        }
      };
      encoder.setup(enc_cfg).then((packets: Array<Packet>) => {
        decoder.setup({}, packets).then((info: IAudioInfo) => {
          this.player
            .init(
              info.sampling_rate,
              info.num_of_channels,
              Test.period_size,
              Test.delay_period_count,
              Test.ringbuffer_period_count
            )
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
      if (reader.in_flight || working) return;
      working = true;
      if (packet_queue.length > 0) {
        const packet = packet_queue.shift();
        decoder.decode(packet).then((buf: IAudioBuffer) => {
          this.player
            .enqueue(buf)
            .catch(this.output_reject_log("ringbuf enqueue error?"));
          working = false;
        }, this.output_reject_log("decoder.decode error"));
      } else {
        reader.read().then((buf: IAudioBuffer) => {
          encoder.encode(buf).then((packets: Array<Packet>) => {
            if (packets.length == 0) {
              working = false;
              return;
            }
            for (let i = 1; i < packets.length; ++i)
              packet_queue.push(packets[i]);
            decoder.decode(packets[0]).then((buf: IAudioBuffer) => {
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

  private init_player() {
    if (this.player) this.player.close();
    this.player = new WebAudioPlayer();
  }

  private get_reader(): [IAudioReader, any] {
    const radio_mic = <HTMLInputElement>document.getElementById("input_mic");
    const radio_file = <HTMLInputElement>document.getElementById("input_file");

    let reader: IAudioReader = null;
    let params: any = null;
    if (radio_mic.checked) {
      reader = new MicrophoneReader();
      params = {};
    } else if (radio_file.checked) {
      const input_file = <HTMLInputElement>(
        document.getElementById("input_filedata")
      );
      if (input_file.files.length != 1) {
        alert("not choose file");
        return;
      }
      reader = new RiffPcmWaveReader();
      params = {
        file: input_file.files[0]
      };
    } else {
      alert("not choose mic or file");
    }
    return [reader, params];
  }

  private output_reject_log(prefix: string): { (e): void } {
    return e => {
      this.player.close();
      console.log(prefix, e);
    };
  }
}
