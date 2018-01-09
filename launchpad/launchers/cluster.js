var cluster = require("cluster");
var async = require("async");

var memored = require("../../temp/memored");
var clusterlock = require("../../temp/clusterlock");

var workers = [];

module.exports = function(options)
{
    // always take up the max # of CPU's
    var cpuCount = require("os").cpus().length;

    var factoryCallback = options.factory;
    var reportCallback = options.report;
    if (!reportCallback) {
        reportCallback = function() { };
    }
    var completionCallback = options.complete;
    if (!completionCallback) {
        completionCallback = function() { };
    }

    if (cluster.isMaster)
    {
        // master

        var fns = [];
        for (var i = 0; i < cpuCount; i++)
        {
            var fn = function (i, workers) {
                return function (done) {

                    var spawn = function (i, afterSpawnFn) {

                        if (!afterSpawnFn) {
                            afterSpawnFn = function () { };
                        }

                        workers[i] = cluster.fork();

                        workers[i].on('exit', function (worker, workers, i) {
                            return function() {
                                console.error("launchpad: worker " + i + " exited");
                                worker.exited = true;

                                // are all workers exited?
                                var all = true;
                                for (var z = 0; z < workers.length; z++)
                                {
                                    if (!workers[z].exited) {
                                        all = false;
                                    }
                                }

                                if (all)
                                {
                                    console.log("launchpad: all workers exited, terminating process");
                                    return process.exit(-1);
                                }

                                // set a timeout to otherwise restart worker in 5 seconds
                                setTimeout(function() {
                                    console.log("launchpad: restarting worker: " + i);
                                    spawn(i);
                                    worker.exited = false;
                                }, 5000);
                            }
                        }(workers[i], workers, i));

                        workers[i].on('message', function (msg, c) {

                            if (msg === "server-startup")
                            {
                                afterSpawnFn();
                            }
                        });
                    };
                    spawn(i, function () {
                        done();
                    });
                };
            }(i, workers);
            fns.push(fn);
        }

        async.parallel(fns, function (err) {

            // start up shared memory
            memored.setup({purgeInterval: 500});

            // start up cluster locks
            clusterlock.setup();

            // tell the first worker to report
            if (workers.length > 0)
            {
                workers[0].send("server-report");
            }

            setTimeout(function() {
                completionCallback();
            }, 250);
        });
    }
    else
    {
        // slave

        factoryCallback(function(server) {

            server.listen(server._listenPort);

            // listen for the "server-report" message and fire the callback
            process.on('message', function (msg, msgData) {

                if (msg === "server-report")
                {
                    reportCallback();
                }

            });
        });
    }
};