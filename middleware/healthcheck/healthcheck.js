var path = require('path');
var fs = require('fs');
var http = require('http');
var util = require("../../util/util");
var Gitana = require("gitana");
var duster = require("../../duster/index");

/**
 * Healthcheck middleware.
 *
 * @type {Function}
 */
exports = module.exports = function()
{
    var handle = function(res)
    {
        res.status(200).json({
            "ok": true
        });
    };

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    /**
     * Handles healthcheck calls.
     *
     * @return {Function}
     */
    r.handler = function()
    {
        return util.createHandler("healthcheck", function(req, res, next, stores, cache, configuration) {

            var handled = false;

            if (req.method.toLowerCase() === "get") {

                if (    req.url.indexOf("/healthcheck") === 0 ||
                        req.url.indexOf("/_healthcheck") === 0 ||
                        req.url.indexOf("/_hc") === 0 ||
                        req.url.indexOf("/_health") === 0)
                {
                    handle(res);

                    handled = true;
                }
            }

            if (!handled)
            {
                next();
            }
        });
    };

    return r;
}();

