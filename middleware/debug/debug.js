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

    var logMemory = true;

    var MB = 1024*1024;
    var oldHeapTotal = 0;
    var shuttingDown = false;

    var logMemoryFn = function() {
        setTimeout(function() {

            if (shuttingDown)
            {
                return;
            }

            var memUsage = process.memoryUsage();

            var newRss = (memUsage.rss / MB).toFixed(2);
            var newHeap = (memUsage.heapUsed / MB).toFixed(2);
            var newHeapTotal = (memUsage.heapTotal / MB).toFixed(2);
            var deltaHeapTotal = (newHeapTotal - oldHeapTotal).toFixed(2);

            console.log('RSS: ' + newRss + ' MB, Heap Used: ' + newHeap + ' MB, Heap Total: ' + newHeapTotal + ' MB, Heap Total Change: ' + deltaHeapTotal + ' MB');

            oldHeapTotal = newHeapTotal;

            logMemoryFn();
        }, 15000);
    };
    logMemoryFn();

    // listen for kill or interrupt so that we can shut down cleanly
    process.on('SIGINT', function() {
        shuttingDown = true;
    });




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
                if (typeof(process.configuration.debug.logGlobalTimings) !== "undefined")
                {
                    logGlobalTimings = process.configuration.debug.logGlobalTimings;
                }

                if (typeof(process.configuration.debug.logMemory) !== "undefined")
                {
                    logMemory = process.configuration.debug.logMemory;
                }
            }
        }

        return util.createHandler("debug", function(req, res, next, stores, cache, configuration) {

            var handled = false;

            if (req.method.toLowerCase() === "get") {

                if (req.url.indexOf("/_debug/timings") === 0)
                {
                    var timings = util.getGlobalTimings();

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

