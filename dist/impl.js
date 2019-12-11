/// <reference path="api.d.ts" />
var AudioEncoder = /** @class */ (function () {
    function AudioEncoder(path) {
        this.worker = new Worker(path);
    }
    AudioEncoder.prototype.setup = function (cfg) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.worker.onmessage = function (ev) {
                if (ev.data.status != 0) {
                    reject(ev.data);
                    return;
                }
                resolve(ev.data.packets);
            };
            _this.worker.postMessage(cfg);
        });
    };
    AudioEncoder.prototype.encode = function (data) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.worker.onmessage = function (ev) {
                if (ev.data.status != 0) {
                    reject(ev.data);
                    return;
                }
                resolve(ev.data.packets);
            };
            _this.worker.postMessage(data);
        });
    };
    return AudioEncoder;
}());
var AudioDecoder = /** @class */ (function () {
    function AudioDecoder(path) {
        this.worker = new Worker(path);
    }
    AudioDecoder.prototype.setup = function (cfg, packets) {
        var _this = this;
        var transfer_list = [];
        for (var i = 0; i < packets.length; ++i)
            transfer_list.push(packets[i].data);
        return new Promise(function (resolve, reject) {
            _this.worker.onmessage = function (ev) {
                if (ev.data.status != 0) {
                    reject(ev.data);
                    return;
                }
                resolve(ev.data);
            };
            _this.worker.postMessage({
                config: cfg,
                packets: packets
            }, transfer_list);
        });
    };
    AudioDecoder.prototype.decode = function (packet) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.worker.onmessage = function (ev) {
                if (ev.data.status != 0) {
                    reject(ev.data);
                    return;
                }
                resolve(ev.data);
            };
            _this.worker.postMessage(packet, [packet.data]);
        });
    };
    return AudioDecoder;
}());
