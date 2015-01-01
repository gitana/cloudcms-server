var path = require('path');
var fs = require('fs');
var http = require('http');

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
        return function(req, res, next)
        {
            // hand back a 404
            res.status(404).end();
        };
    };

    return r;
}();





