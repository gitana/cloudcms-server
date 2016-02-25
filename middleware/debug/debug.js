var path = require('path');
var fs = require('fs');
var http = require('http');
var util = require("../../util/util");

// REMOVE HEAPDUMP UNTIL BETTER SUPPORTED
//     //"heapdump": "^0.3.7",
//var heapdump = require('heapdump');

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

    var logFn = function() {
        setTimeout(function() {

            if (shuttingDown)
            {
                return;
            }

            util.countOpenHandles(function(err, openHandleCount) {

                if (!err || !openHandleCount)
                {
                    openHandleCount = "unknown";
                }

                var memUsage = process.memoryUsage();

                var newRss = (memUsage.rss / MB).toFixed(2);
                var newHeap = (memUsage.heapUsed / MB).toFixed(2);
                var newHeapTotal = (memUsage.heapTotal / MB).toFixed(2);
                var deltaHeapTotal = (newHeapTotal - oldHeapTotal).toFixed(2);

                console.log('Open Files: ' + openHandleCount + ', RSS: ' + newRss + ' MB, Heap Used: ' + newHeap + ' MB, Heap Total: ' + newHeapTotal + ' MB, Heap Total Change: ' + deltaHeapTotal + ' MB');

                oldHeapTotal = newHeapTotal;

                logFn();
            });

        }, 15000);
    };
    logFn();

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

                // REMOVE HEAPDUMP UNTIL BETTER SUPPORTED
                /*
                // captures and downloads a snapshot file
                if (req.url.indexOf("/_debug/heap/snapshot") === 0)
                {
                    // writes a snapshot
                    var filename = Date.now() + ".heapsnapshot";
                    var filepath = "/tmp/" + filename;
                    heapdump.writeSnapshot(filepath);

                    res.setHeader("Content-disposition", "attachment; filename=" + filename);
                    res.setHeader("Content-Type", "text/heapsnapshot");

                    var filestream = fs.createReadStream(filepath);
                    filestream.pipe(res);

                    handled = true;
                }
                */

            }

            // REMOVE HEAPDUMP UNTIL BETTER SUPPORTED
            /*
            if (req.method.toLowerCase() === "post") {

                // captures a heap snapshot file
                // or do this: kill -USR2 <pid>
                if (req.url.indexOf("/_debug/heap/snapshot") === 0)
                {
                    // writes a snapshot
                    var filename = Date.now() + ".heapsnapshot";
                    var filepath = "/tmp/" + filename;
                    heapdump.writeSnapshot(filepath);

                    res.status(200).json({
                        "ok": true,
                        "snapshot": filepath
                    });

                    handled = true;
                }
            }
            */

            if (!handled)
            {
                next();
            }
        });
    };

    return r;
}();

