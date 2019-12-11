///<reference path="typings/emscripten.d.ts" />
/// <reference path="speex_resampler.ts" />
var ResamplingWorker = /** @class */ (function () {
    function ResamplingWorker(worker) {
        var _this = this;
        this.resampler = null;
        this.worker = worker;
        this.worker.onmessage = function (e) {
            _this.setup(e.data);
        };
    }
    ResamplingWorker.prototype.setup = function (config) {
        var _this = this;
        try {
            this.resampler = new SpeexResampler(config.channels, config.in_sampling_rate, config.out_sampling_rate, config.quality || 5);
            this.worker.postMessage({
                status: 0
            });
            this.worker.onmessage = function (e) {
                _this.process(e.data.samples);
            };
        }
        catch (e) {
            this.worker.postMessage({
                status: -1,
                reason: e
            });
        }
    };
    ResamplingWorker.prototype.process = function (input) {
        try {
            var ret = new Float32Array(this.resampler.process(input));
            this.worker.postMessage({
                status: 0,
                result: ret
            }, [ret.buffer]);
        }
        catch (e) {
            this.worker.postMessage({
                status: -1,
                reason: e
            });
        }
    };
    return ResamplingWorker;
}());
new ResamplingWorker(this);
