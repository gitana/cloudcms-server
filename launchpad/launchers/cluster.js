var net = require("net");
var cluster = require("cluster");
var http = require("http");
var Random = require("random-js");
var async = require("async");

var hash = function (ip, seed)
{
    var hash = ip.reduce(function (r, num) {
        r += parseInt(num, 10);
        r %= 2147483648;
        r += (r << 10);
        r %= 2147483648;
        r ^= r >> 6;
        return r;
    }, seed);

    hash += hash << 3;
    hash %= 2147483648;
    hash ^= hash >> 11;
    hash += hash << 15;
    hash %= 2147483648;

    return hash >>> 0;
};

var internals = {};
internals.workers = [];
internals.random = new Random(Random.engines.mt19937().autoSeed());
internals.seed = internals.random.integer(0x0, 0x80000000);

/**
 * Hash balanced layer 3 connection listener.
 */
var layer3HashBalancedConnectionListener = function(c) {

    /*
     client connected: _connecting,_handle,_readableState,readable,domain,_events,_maxListeners,_writableState,writable,allowHalfOpen,onend,destroyed,bytesRead,_bytesDispatched,_pendingData,_pendingEncoding,server,read,listen,setTimeout,_onTimeout,setNoDelay,setKeepAlive,address,_read,end,destroySoon,_destroy,destroy,_getpeername,remoteAddress,remotePort,_getsockname,localAddress,localPort,write,_write,bytesWritten,connect,ref,unref,push,unshift,setEncoding,pipe,unpipe,on,addListener,resume,pause,wrap,setMaxListeners,emit,once,removeListener,removeAllListeners,listeners
     */

    //console.log ("client connected: " + c.remoteAddress + ":" + c.remotePort);

    // Get int31 hash of ip
    var ipHash = hash((c.remoteAddress || '').split(/\./g), internals.seed);
    var index = ipHash % internals.workers.length;

    // Pass connection to worker
    //var index = internals.random.integer(0, internals.workers.length - 1);

    var worker = internals.workers[index];
    if (worker)
    {
        worker.send('launchpad:connection', c);
    }
};

module.exports = function(options)
{
    var connectionListener = layer3HashBalancedConnectionListener;
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
        internals.workers = [];
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
            }(i, internals.workers);
            fns.push(fn);
        }

        async.parallel(fns, function (err) {

            var server = net.createServer(connectionListener);

            var port = process.env.PORT || 2999;
            server.listen(port);

            // tell the first worker to report
            if (internals.workers.length > 0)
            {
                internals.workers[0].send("server-report");
            }

            setTimeout(function() {
                completionCallback(server);
            }, 250);

        });
    }
    else
    {
        factoryCallback(function(server) {

            // Worker process
            process.on("error", function() {
                console.log("ERRRRR");
            });

            process.on('message', function (msg, msgData) {

                if (typeof msg === 'object')
                {
                    if (msg.cmd === 'launchpad:connection') {

                        server.emit('connection', msgData);

                    }
                }
                else if (msg === "server-report")
                {
                    reportCallback();
                }
                else if (msg === "launchpad:connection")
                {
                    server.emit('connection', msgData);
                }
            });
        });
    }
};
