var path = require("path");

var ReadWriteLock = require("rwlock");

/**
 * Simple in-memory lock service.
 *
 * This one does not work across processes.
 *
 * @type {*}
 */
exports = module.exports = function(lockConfig)
{
    var r = {};

    var locker = new ReadWriteLock();

    r.init = function(callback)
    {
        callback();
    };

    r.lock = function(key, fn)
    {
        locker.writeLock(key, function(releaseCallbackFn) {
            fn(releaseCallbackFn);
        });
    };

    return r;
};