var path = require("path");

/**
 * Descriptors cache (by host).
 *
 * @type {*}
 */
exports = module.exports = function()
{
    var map = {};

    var r = {};

    var read = r.read = function(host)
    {
        return map[host];
    };

    var clear = r.clear = function()
    {
        map = {};
    };

    var write = r.write = function(host, descriptor)
    {
        map[host] = descriptor;
    };

    var invalidate = r.invalidate = function(host)
    {
        delete map[host];
    };

    return r;
}();