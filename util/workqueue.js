var util = require("./util");

module.exports = function(name, maxSize, debug)
{
    if (!maxSize) {
        maxSize = 3;
    }

    var pendingWorkQueue = [];
    var activeCount = 0;

    var debugLog = function(text)
    {
        if (debug)
        {
            console.log("[WORKQUEUE: " + name + "] " + text);
        }
    }

    var dispatcherFn = function () {

        // add as many pending work items as we can, loop until full or no more pending
        var process = true;
        do
        {
            // if nothing to work on, bail
            if (pendingWorkQueue.length === 0)
            {
                process = false;
            }
            else
            {
                // var ids = [];
                // for (var z = 0; z < pendingWorkQueue.length; z++)
                // {
                //     ids.push(pendingWorkQueue[z].id);
                // }
                //
                // debugLog("Dispatcher top, queue: " + ids.join(","));

                //debugLog("dispatcher, pending: " + pendingWorkQueue.length + ", actives: " + activeCount + "]");

                // if we're full, bail
                if (activeCount >= maxSize)
                {
                    process = false;
                }

                if (process)
                {
                    // increment active count
                    activeCount++;

                    // define execution function and splice/bind to 0th element from pending list
                    var executionFn = function(work) {
                        return function() {
                            var workFn = work.workFn;
                            var callbackFn = work.callbackFn;

                            debugLog("Start: " + work.id + ", queue: " + pendingWorkQueue.length + ", actives: " + activeCount);

                            workFn(function(err, obj1, obj2) {

                                // fire optional callback
                                if (callbackFn) {
                                    window.setTimeout(function() {
                                        callbackFn(err, obj1, obj2);
                                    });
                                }

                                // decrement active count
                                activeCount--;

                                debugLog("Complete: " + work.id + ", queue: " + pendingWorkQueue.length + ", actives: " + activeCount);
                            });

                        };
                    }(pendingWorkQueue.splice(0, 1)[0]);

                    // execute on timeout
                    window.setTimeout(executionFn);
                }
            }

        } while (process);

        // run again on a brief timeout
        window.setTimeout(dispatcherFn, 50);
    };

    // launch dispatcher
    window.setTimeout(dispatcherFn);

    // hand back a function to register work onto the queue
    return function(workFn, callbackFn) {

        var work = {
            "id": util.guid(),
            "workFn": workFn
        };

        if (callbackFn) {
            work.callbackFn = callbackFn;
        }

        pendingWorkQueue.push(work);

        //debugLog("Added to pending queue, id: " + work.id + ", pending: " + pendingWorkQueue.length);
    };

};