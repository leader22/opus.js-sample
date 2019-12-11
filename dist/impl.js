export class AudioEncoder {
    constructor(path) {
        this.worker = new Worker(path);
    }
    setup(cfg) {
        return new Promise((resolve, reject) => {
            this.worker.onmessage = ev => {
                if (ev.data.status != 0) {
                    reject(ev.data);
                    return;
                }
                resolve(ev.data.packets);
            };
            this.worker.postMessage(cfg);
        });
    }
    encode(data) {
        return new Promise((resolve, reject) => {
            this.worker.onmessage = ev => {
                if (ev.data.status != 0) {
                    reject(ev.data);
                    return;
                }
                resolve(ev.data.packets);
            };
            this.worker.postMessage(data);
        });
    }
}
export class AudioDecoder {
    constructor(path) {
        this.worker = new Worker(path);
    }
    setup(cfg, packets) {
        const transfer_list = [];
        for (let i = 0; i < packets.length; ++i)
            transfer_list.push(packets[i].data);
        return new Promise((resolve, reject) => {
            this.worker.onmessage = ev => {
                if (ev.data.status != 0) {
                    reject(ev.data);
                    return;
                }
                resolve(ev.data);
            };
            this.worker.postMessage({
                config: cfg,
                packets: packets
            }, transfer_list);
        });
    }
    decode(packet) {
        return new Promise((resolve, reject) => {
            this.worker.onmessage = ev => {
                if (ev.data.status != 0) {
                    reject(ev.data);
                    return;
                }
                resolve(ev.data);
            };
            this.worker.postMessage(packet, [packet.data]);
        });
    }
}
