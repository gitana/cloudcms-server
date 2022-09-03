//var path = require("path");
var memored = require("memored");

//var cluster = require("cluster");

/**
 * Shared cluster memory using memored
 *
 * @type {*}
 */
exports = module.exports = function(cacheConfig)
{
    var r = {};

    r.init = function(callback)
    {
        callback();
    };

    r.write = function(key, value, seconds, callback)
    {
        memored.store(key, value, seconds * 1000, function(err) {
            callback();
        });
    };

    r.read = function(key, callback)
    {
        memored.read(key, function(err, value) {
            callback(err, value);
        });
    };

    r.remove = function(key, callback)
    {
        memored.remove(key, function(err) {
            callback(err);
        });
    };

    r.keys = function(prefix, callback)
    {
        memored.keys(function(err, keys) {

            if (err) {
                callback(err);
                return;
            }

            var keepers = [];

            for (var i = 0; i < keys.length; i++)
            {
                if (keys[i].indexOf(prefix) > -1)
                {
                    keepers.push(keys[i]);
                }
            }

            callback(null, keepers);
        });
    };

    return r;
};