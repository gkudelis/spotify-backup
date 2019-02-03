const PromisQ = require('../promisq.js');

describe('PromisQ', function() {
    var q;

    beforeEach(function() {
        q = new PromisQ(5);
    });

    it('accepts and gives out a single item', function() {
        q.push('item');
        q.pop().then(function(item) {
            expect(item).toBe('item');
        });
    });

    it('accepts and gives out multiple items', function() {
        q.push(1).then(function() {
            return q.push(4);
        }).then(function() {
            return q.pop();
        }).then(function(v1) {
            expect(v1).toBe(1);
            return q.pop();
        }).then(function(v2) {
            expect(v2).toBe(2);
            return q.pop();
        }).then(function(v3) {
            expect(v3).toBe(3);
            return q.pop();
        }).then(function(v4) {
            expect(v4).toBe(4);
        });
        // will happen before the first .then handler
        q.push(2);
        q.push(3);
    });

    it('correctly deals with more values than it can hold', function() {
        var values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        // queue pushes
        values.reduce(function(promise, value) {
            return promise.then(function() {
                return q.push(value);
            });
        }, Promise.resolve());
        // queue pops and value checks
        values.reduce(function(promise, value) {
            return promise.then(function(poppedValue) {
                expect(poppedValue).toBe(value);
                return q.pop();
            });
        }, q.pop());
    });

    it('makes poppers wait for values', function() {
        q.pop().then(function(v) {
            expect(v).toBe(1);
            return q.pop();
        }).then(function(v) {
            expect(v).toBe(2);
        });
        q.push(1);
        q.push(2);
    });
});
