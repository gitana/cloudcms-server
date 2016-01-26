var path = require('path');
var fs = require('fs');
var http = require('http');

var util = require("../../util/util");

/**
 * Final middleware.
 *
 * If nothing else trips in the handler chain, we pass back a 404.
 *
 * @type {Function}
 */
exports = module.exports = function()
{
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    /**
     * Hands back a 404.

     * @return {Function}
     */
    r.finalHandler = function()
    {
        return util.createHandler("final", function(req, res, next, stores, cache, configuration) {
            util.status(res, 404).end();
        });
    };

    return r;
}();





