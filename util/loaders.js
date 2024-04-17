var exports = module.exports;

var AsyncLock = require("async-lock");

var SENTINEL_NOT_FOUND_VALUE = "null";

/**
 * Applies caching to a loader.
 *
 * A loader function is invoked like:
 *
 *    loader(function(err, value) {
 *
 *    });
 *
 * Its job is to load something from a remote place and then fire the callback.
 *
 * This method wraps caching around the loader for the given key.  It returns a new loader
 * that checks a given cache (key) for a value ahead of invoking the actual underlying loader.
 *
 * @param loader
 * @param cache
 * @param key
 */
var cached = exports.cached = function(loader, cache, key)
{
    return function(callback)
    {
        cache.read(key, function(err, value) {

            if (value === SENTINEL_NOT_FOUND_VALUE) {
                return callback();
            }

            if (value) {
                return callback(null, value);
            }

            loader(function(err, value) {

                if (err) {
                    return callback(err);
                }

                if (!value) {
                    return cache.write(key, SENTINEL_NOT_FOUND_VALUE, function () {
                        callback();
                    });
                }

                // write to cache
                return cache.write(key, value, function () {
                    callback.call(this, null, value);
                });
            });
        });
    };
};

var lock = new AsyncLock();

/**
 * Applies caching to a loader.
 *
 * A loader function is invoked like:
 *
 *    loader(function(err, value) {
 *
 *    });
 *
 * Its job is to load something from a remote place and then fire the callback.
 *
 * This method wraps an exclusive mutex lock around the given loader.  This makes it so that only one
 * invocation of this loader may run per key within the event loop.
 *
 * @param loader
 * @param key
 */
var exclusive = exports.exclusive = function(loader, key, timeout)
{
    return function(callback)
    {
        var opts = {};
        // up to 50000 tasks in the queue
        opts.maxPending = 50000;
        if (timeout) {
            opts.timeout = timeout;
        }

        lock.acquire(key, function(releaseFn) {
            loader(function(err, value) {
                setTimeout(function() {
                    releaseFn();
                }, 0);
                callback.call(this, err, value);
            });
        }, opts);
    };
};

var cachedExclusive = exports.cachedExclusive = function(loader, cache, key, timeout)
{
    var cachedLoader1 = cached(loader, cache, key);
    var exclusiveLoader = exclusive(cachedLoader1, key, timeout);
    var cachedLoader2 = cached(exclusiveLoader, cache, key);

    return cachedLoader2;
};
