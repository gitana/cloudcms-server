var AsyncLock = require('async-lock');

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
    
    var lock = new AsyncLock();

    r.init = function(callback)
    {
        callback();
    };

    r.lock = function(key, fn)
    {
        lock.acquire(key, function(releaseCallbackFn) {
            fn(null, releaseCallbackFn);
        }, function(err, value) {
            // lock was released
            if (err) {
                console.error("Memory Lock heard error: ", err, " return value: ", value);
            }
        });
    };

    return r;
};