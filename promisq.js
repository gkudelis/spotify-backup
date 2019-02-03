module.exports = PromisQ;

function PromisQ (maxLength) {
    this.queue = [];
    this.maxLength = maxLength;

    // used to keep track of resolvers for promises given out when there are
    // too many / too few items in the queue
    this.popResolve = null;
    this.pushResolve = null;

    var pq = this;

    this.pop = function () {
        return new Promise(function (resolve, reject) {
            if (pq.popResolve === null) {
                if (pq.queue.length > 0) {
                    if (pq.pushResolve !== null) {
                        pq.pushResolve();
                        pq.pushResolve = null;
                    }
                    resolve(pq.queue.shift());
                } else {
                    pq.popResolve = resolve;
                }
            } else {
                reject();
            }
        });
    }

    this.push = function (item) {
        return new Promise(function (resolve, reject) {
            if (pq.pushResolve === null) {
                if (pq.queue.length < maxLength) {
                    if (pq.popResolve !== null) {
                        pq.popResolve(item);
                        pq.popResolve = null;
                    } else {
                        pq.queue.push(item);
                    }
                    resolve();
                } else {
                    pq.pushResolve = resolve;
                }
            } else {
                reject();
            }
        });
    }
}
