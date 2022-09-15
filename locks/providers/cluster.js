var path = require("path");

var ClusterLock = require("../../temp/clusterlock/index");

/**
 * Lock Service that works for cluster, multiple processes.
 *
 * @type {*}
 */
exports = module.exports = function(lockConfig)
{
    var r = {};

    r.init = function(callback)
    {
        ClusterLock.setup();
        
        callback();
    };

    r.lock = function(key, fn)
    {
        ClusterLock.lock(key, function(releaseCallbackFn) {
            fn(null, releaseCallbackFn);
        });
    };

    return r;
};