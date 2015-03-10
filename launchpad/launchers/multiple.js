var cluster = require("cluster");
var async = require("async");

var workers = [];

module.exports = function(options)
{
    var num = options.num;
    if (!num) {
        num = require("os").cpus().length;
    }

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
        var fns = [];
        for (var i = 0; i < num; i++)
        {
            var fn = function (i, workers) {
                return function (done) {

                    var spawn = function (i, afterSpawnFn) {

                        if (!afterSpawnFn) {
                            afterSpawnFn = function () { };
                        }

                        workers[i] = cluster.fork();

                        // Restart worker on exit
                        workers[i].on('exit', function () {
                            console.error('launchpad: worker died');
                            spawn(i);
                        });

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