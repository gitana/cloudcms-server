var path = require("path");
var async = require("async");

/**
 * Lock Service.
 *
 * Provides a method for providing mutex locks so that multiple "threads" in a server (or across cluster, depending on how
 * this is configured) can coordinate.
 *
 * The primary use case is the better orchestration of caching of assets.  If one request is attempting to read a node
 * asset cached to disk and another thread invalidates it, the first thread can get back a 503 or other odd response since
 * the asset was deleted from disk mid-request.
 *
 * The lock service makes it possible for both requests to "sync" around the file path on disk.  If request #2 gets the
 * lock first, the second request will wait until the lock is released before it proceeds to read.  The lock would be
 * released AFTER the asset was completely cleaned up from disk.
 *
 * One might argue (and quite well) that returning a 503 or other error code is perfectly fine and that it is really
 * the front end application's problem to interpret the error and respond (such as by re-requesting the asset).  This
 * may be true but at our goal here is to make things a little cleaner for our customers so that they're either going to
 * get a 200 or 404.  Other HTTP codes may arise but should not be the result of inconsistent state that arises from
 * lack of coordination among requests.
 *
 * @type {*}
 */
exports = module.exports = function()
{
    var provider = null;

    var r = {};

    var init = r.init = function(callback)
    {
        var self = this;

        // set up defaults
        if (!process.env.CLOUDCMS_LOCKS_TYPE)
        {
            process.env.CLOUDCMS_LOCKS_TYPE = "memory";

            if (process.configuration.setup !== "single") {
                process.env.CLOUDCMS_LOCKS_TYPE = "redis";
            }
        }

        if (!process.configuration.locks) {
            process.configuration.locks = {};
        }

        if (!process.configuration.locks.type) {
            process.configuration.locks.type = process.env.CLOUDCMS_LOCKS_TYPE;
        }

        if (!process.configuration.locks.config) {
            process.configuration.locks.config = {};
        }

        process.env.CLOUDCMS_LOCKS_TYPE = process.configuration.locks.type;

        var locksConfig = process.configuration.locks.config;

        provider = require("./providers/" + process.configuration.locks.type)(locksConfig);
        provider.init(function(err) {
            callback(err);
        });
    };

    /**
     * Acquires a lock for a given key.
     *
     * @type {Function}
     */
    var lock = r.lock = function(key, fn)
    {
        provider.lock(key, function(err, releaseFn) {
            fn(err, function(afterReleaseCallback) {

                releaseFn();

                if (afterReleaseCallback)
                {
                    afterReleaseCallback();
                }

            });
        });
    };

    return r;
}();