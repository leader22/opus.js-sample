libopus.js
==========

非可逆音声符号形式である[Opus](http://opus-codec.org/)のJavaScript実装と，
Webブラウザを用いてOpusのエンコード・デコードを行うサンプルです．

TypeScriptで記述しています．

Demo: https://kazuki.github.io/opus.js-sample/index.html


詳細
----

OpusのJavaScript実装は，Xiph.org Foundationによる
[Opusの実装](http://git.xiph.org/?p=opus.git)を
[Emscripten](http://emscripten.org/)を使ってコンパイルしたものです．

Webブラウザを用いてOpusのエンコード・デコードを行うサンプルでは，
ローカルに保存してあるRIFF PCM Waveファイルを再生したり，
そのファイルを利用して，エンコード速度・デコード速度を測定するほか，
エンコード結果をデコードし，その結果を再生することが出来ます．

このエンコード・デコード機能のサンプルでは，
WebWorkerを利用し別スレッドでエンコード・デコード処理を行うため，
ブラウザの他の処理に影響を与えません．
また，Opusのデコード負荷がそれほど高くないことと，
Emscriptenが出力するasm.jsは高速に動作するため，スマートフォン上でもOpusのリアルタイムデコードが可能です．

Opusは限られたサンプリングレートにしか対応しておらず，
また，WebAudioのAudioContextは環境に依存したサンプリングレートでしか動作しないため，
このサンプルではSpeexのリサンプラーを利用してサンプリングレートを合わせています．


各種バージョン
--------------

* opus: master (3a1dc9dc, Tue Aug 4 15:24:21 2015 -0400)
* speexdsp: 1.2rc3 (887ac103, Mon Dec 15 01:27:40 2014 -0500)
* emscripten: v1.34.8

ビルド方法
-------------------------

Makefileを用意してありますので，以下のコマンドを実行してください．
事前にemscriptenの各種実行ファイルにパスを通す必要があります．
また，opus/speexdspがgcc等を使って普通にビルドできる環境である必要が有ります．

    $ git clone --recursive https://github.com/kazuki/opus.js-sample.git
    $ cd opus.js-sample
    $ make

ライセンス
----------

修正BSDライセンス

TODO
----

- Worker(this)
- Module deps for Emscripten
- Actural Emscripten modules

Reading
-------

## main.ts
- HTMLにあるボタンを`app.ts`に結ぶだけ
- bypassかopusかどちらか選べる

## app.ts
- マイクかファイルかInput音源を取得
- そこからPCMを読み出して、`player.ts`につなぐ
- `player.ts`を初期化して`start()`する
- `main.ts`からbypassが選ばれれば、そのままInputをOutputに流す（リサンプルのみ）
- `main.ts`からopusが選ばれれば、InputをEncodeしてDecodeしてOutputに流す（リサンプルもする）

## microphone.ts
- マイクを`gUM()`する
- 専用の`ringbuf`を持つ
- ストリームは`ScriptProcessorNode`に対してつないで、PCMを`ringbuf`に貯めておく
- `read()`で外から読み出される

## riff_pcm_wave.ts
- それのファイル音源ver

## player.ts
- 専用の`ringbuf`を持つ
- `ScriptProcessorNode`でそれを読み出して再生する
- `ringbuf`は外から`enqueue()`されたときに貯まる
- `onneedbuffer`イベントを定期的に発火する
- これを受けた外側が`enqueue()`してくれる

## ring_buffer.ts
- リングバッファの自前実装

## resampler.ts
- `speex_resampler.ts`を使ったリサンプラー
- 中身は丸投げ

## speex_resampler.ts
- https://github.com/xiph/speexdsp
- EmscriptenでWorker内に展開される

## impl.ts
- `opus_decoder.ts` or `opus_encoder.ts`のWorkerを抱える
- 中身はほぼ丸投げ

## opus_encoder.ts
- https://github.com/xiph/opus
- EmscriptenでWorker内に展開される

## opus_decoder.ts
- https://github.com/xiph/opus
- EmscriptenでWorker内に展開される
