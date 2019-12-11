export interface IAudioInfo {
  sampling_rate: number;
  num_of_channels: number;
}

export interface IAudioBuffer {
  timestamp: number;
  samples: Float32Array;
  transferable: boolean;
}

export interface IAudioReader {
  /*
   * Arguments:
   *     buffer_samples_per_ch: readで読み込むチャンネルあたりのサンプル数を指定．
   *         IAudioReaderの実装により実際にはbuffer_sizeに近い値になる場合がある
   */
  open(buffer_samples_per_ch: number, params: any): Promise<IAudioInfo>;

  read(): Promise<IAudioBuffer>;

  close();

  in_flight: boolean;
}

export interface IPlayer {
  // 再生バッファが足りない時に発生するイベント
  onneedbuffer: { (): void };

  /* 初期化
   *
   * Arguments:
   *     sampling_rate, num_of_channels: サンプリングレート / チャンネル数
   *     period_samples: onneedbufferで書き込むサイズ(チャンネルあたりのサンプル数)
   *     delay_periods: 再生開始に必要な最小ピリオド数
   *     buffer_periods: リングバッファのサイズ
   */
  init(
    sampling_rate: number,
    num_of_channels: number,
    period_samples: number,
    delay_periods: number,
    buffer_periods: number
  ): Promise<any>;

  // リングバッファにサンプルを書き込む
  enqueue(buf: IAudioBuffer): Promise<any>;

  // 再生開始
  start(): void;

  // 再生停止
  stop(): void;

  // 破棄
  close(): void;

  // 実際のサンプリングレートを取得
  getActualSamplingRate(): number;

  getBufferStatus(): IPlayerBufferStatus;
}

export interface IPlayerBufferStatus {
  delay: number;
  available: number;
  capacity: number;
}

export interface IAudioEncoderConfig extends IAudioInfo {
  params: any;
}

export interface Packet {
  data: ArrayBuffer;
}

export interface IResult {
  status: number;
  reason?: string;
}

export interface IAudioEncoder {
  setup(cfg: IAudioEncoderConfig): Promise<Array<Packet>>;
  encode(data: IAudioBuffer): Promise<Array<Packet>>;
}

export interface IAudioDecoder {
  setup(cfg: any, packets: Array<Packet>): Promise<IAudioInfo>;
  decode(packet: Packet): Promise<IAudioBuffer>;
}
