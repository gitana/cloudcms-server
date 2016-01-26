var path = require('path');
var fs = require('fs');
var http = require('http');
var util = require("../../util/util");

/**
 * Debug middleware.
 *
 * @type {Function}
 */
exports = module.exports = function()
{
    var logGlobalTimings = false;

    var logGlobalTimingsFn = function() {
        setTimeout(function() {

            if (logGlobalTimings)
            {
                var timings = util.getGlobalTimings();

                if (timings && Object.keys(timings).length > 0)
                {
                    console.log("Global Timings");
                    for (var k in timings)
                    {
                        console.log(" -> " + k + ", average: " + timings[k].avg);
                    }
                }
            }

            logGlobalTimingsFn();
        }, 5000)
    };
    logGlobalTimingsFn();


    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    /**
     * Handles debug mode.
     *
     * @return {Function}
     */
    r.handler = function()
    {
        if (process.configuration)
        {
            if (process.configuration.debug)
            {
                logGlobalTimings = process.configuration.debug.logGlobalTimings;
            }
        }

        return util.createHandler("debug", function(req, res, next, stores, cache, configuration) {

            var handled = false;

            console.log("a1: " + req.method);
            if (req.method.toLowerCase() === "get") {

                console.log("a2: " + req.url);
                if (req.url.indexOf("/_debug/timings") === 0)
                {
                    console.log("a3");
                    var timings = util.getGlobalTimings();
                    console.log("a4: " + timings);

                    res.status(200).json({
                        "ok": true,
                        "timings": timings
                    });

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

