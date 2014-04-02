var path = require("path");

/**
 * Drivers cache ("default", "virtual" or by host).
 *
 * @type {*}
 */
exports = module.exports = function()
{
    var map = {};

    var r = {};

    var read = r.read = function(key)
    {
        return map[key];
    };

    var clear = r.clear = function()
    {
        map = {};
    };

    var write = r.write = function(key, config)
    {
        map[key] = config;
    };

    var invalidate = r.invalidate = function(key)
    {
        delete map[key];
    };

    return r;
}();