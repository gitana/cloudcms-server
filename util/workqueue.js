module.exports = function(maxSize)
{
    if (!maxSize) {
        maxSize = 3;
    }

    var blockExecution = false;

    var pendingWorkQueue = [];
    var activeCount = 0;

    var processWork = function () {

        // if another "thread" is running the processor, don't bother
        if (blockExecution)
        {
            return;
        }

        blockExecution = true;

        // add as many pending work items as we can, loop until full or no more pending
        var process = true;
        do
        {
            // if nothing to work on, bail
            if (pendingWorkQueue.length === 0)
            {
                process = false;
            }

            // if we're full, bail
            if (activeCount >= maxSize)
            {
                process = false;
            }

            if (process)
            {
                // increment active count
                activeCount++;

                // console.log("Active work items: " + activeCount);

                // define execution function and splice/bind to 0th element from pending list
                var executionFn = function(work) {
                    return function() {
                        var workFn = work.workFn;
                        var callbackFn = work.callbackFn;

                        // console.log("[WORKQUEUE - queue: " + pendingWorkQueue.length + ", actives: " + activeCount + "] start work");

                        workFn(function(err, obj1, obj2) {

                            // decrement active count
                            activeCount--;

                            // console.log("[WORKQUEUE - queue: " + pendingWorkQueue.length + ", actives: " + activeCount + "] finish work");

                            // fire optional callback
                            if (callbackFn) {
                                // console.log("[WORKQUEUE - queue: " + pendingWorkQueue.length + ", actives: " + activeCount + "] fire work callback");
                                window.setTimeout(function() {
                                    callbackFn(err, obj1, obj2);
                                });
                            }

                            // process more work on timeout
                            window.setTimeout(processWork);
                        });

                    };
                }(pendingWorkQueue.splice(0, 1)[0]);

                // execute on timeout
                window.setTimeout(executionFn);
            }

        } while (process);

        blockExecution = false;
    };

    return function(workFn, callbackFn) {

        var pendingWork = {
            "workFn": workFn
        };

        if (callbackFn) {
            pendingWork.callbackFn = callbackFn;
        }

        pendingWorkQueue.push(pendingWork);

        // execute on timeout
        window.setTimeout(processWork);
    };

};