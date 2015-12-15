var cluster = require("cluster");
//var express = require("express");
var net = require("net");
var async = require("async");

var memored = require('../../temp/memored');
var clusterlock = require("../../temp/clusterlock");

var workers = [];

var num_processes = require('os').cpus().length;

var setupMaster = function(connectionListener, completionCallback)
{
    var fns = [];

    for (var i = 0; i < num_processes; i++)
    {
        var fn = function (i, workers) {
            return function (done) {

                var spawn = function (i, afterSpawnFn) {

                    if (!afterSpawnFn) {
                        afterSpawnFn = function () { };
                    }

                    workers[i] = cluster.fork();

                    // Restart worker on exit
                    workers[i].on('exit', function (e) {
                        console.error('launchpad: worker died: ' + JSON.stringify(e));
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

    async.parallel(fns, function(err) {

        // start up shared memory
        memored.setup({purgeInterval: 500});

        // start up cluster locks
        clusterlock.setup();

        var port = process.env.PORT || 2999;

        // Create the outside facing server listening on our port.
        var server = net.createServer({
            pauseOnConnect: true
        }, connectionListener).listen(port);

        // tell the first worker to report
        if (workers.length > 0)
        {
            workers[0].send("server-report");
        }

        completionCallback(server);

    });
};

var setupSlave = function(factoryCallback, reportCallback) {

    factoryCallback(function(server) {

        // listen to internal address only
        // server.listen(0, "localhost");

        // Listen to messages sent from the master. Ignore everything else.
        process.on('message', function(message, connection) {

            if (message === "server-report")
            {
                return reportCallback();
            }
            else if (message === 'sticky-session:connection')
            {

                // Emulate a connection event on the server by emitting the
                // event with the connection the master sent us.
                server.emit('connection', connection);

                connection.resume();
            }
        });

    });

};

module.exports = function(options)
{
    var connectionListener = function(connection) {

        // Helper function for getting a worker index based on IP address.
        // This is a hot path so it should be really fast. The way it works
        // is by converting the IP address to a number by removing the dots,
        // then compressing it to the number of slots we have.
        //
        // Compared against "real" hashing (from the sticky-session code) and
        // "real" IP number conversion, this function is on par in terms of
        // worker index distribution only much faster.
        var worker_index = function(ip, len) {
            var s = '';
            for (var i = 0, _len = ip.length; i < _len; i++) {
                if (ip[i] !== '.' && ip[i] !== ':') {
                    s += ip[i];
                }
            }

            return Number(s) % len;
        };

        // We received a connection and need to pass it to the appropriate
        // worker. Get the worker for this connection's source IP and pass
        // it the connection.
        var workerIndex = worker_index(connection.remoteAddress, num_processes);
        var worker = workers[workerIndex];

        worker.send('sticky-session:connection', connection);
    };

    // callbacks
    var factoryCallback = options.factory;
    var reportCallback = options.report;
    if (!reportCallback) {
        reportCallback = function () { };
    }
    var completionCallback = options.complete;
    if (!completionCallback) {
        completionCallback = function () { };
    }

    if (cluster.isMaster) {
        setupMaster(connectionListener, completionCallback);
    }
    else {
        setupSlave(factoryCallback, reportCallback);
    }
};