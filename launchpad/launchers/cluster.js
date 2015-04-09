// all credits to
// https://github.com/wzrdtales/socket-io-sticky-session

var net = require("net");
var cluster = require("cluster");
var crypto = require("crypto");
var async = require("async");

var workers = [];
var seed = crypto.randomBytes(4).readUInt32BE(0, true) % 0x80000000;

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

/**
 * Access 'private' object _handle of file descriptor to republish the read
 * packet.
 *
 * Supports Node versions from 0.9.6 and up.
 */
var node96RepublishPacket = function(fd, data) {
    fd._handle.onread(new Buffer(data), 0, data.length);
};

/**
 * Access 'private' object _handle of file descriptor to republish the read
 * packet.
 *
 * Supports Node version from 0.12 and up.
 */
var node012RepublishPacket = function(fd, data) {
    fd._handle.onread(1, new Buffer(data));
};

/**
 * Hash balanced layer 3 connection listener.
 */
var layer3HashBalancedConnectionListener = function(c) {

    // Get int31 hash of ip
    var ipHash = hash((c.remoteAddress || '').split(/\./g), seed);

    // find worker
    var worker = workers[ipHash % workers.length];
    if (worker)
    {
        // pass connection to worker
        worker.send('launchpad:connection', c);
    }
};

/**
 * Hash balanced layer 4 connection listener.
 *
 * The node is chosen randomly initial and gets hash balanced later in
 * patchConnection.
 */
var layer4HashBalancedConnectionListener = function(c)
{
    // Get int31 hash of ip
    var random = crypto.randomBytes(4).readUInt32BE(0, true);
    var worker = workers[random % workers.length];
    if (worker)
    {
        // pass connection to worker
        worker.send('launchpad:sync', c);
    }
};

/**
 * Hash balance on the real ip and send data + file descriptor to final node.
 */
var patchConnection = function(c, fd)
{
    console.log("Patch Connection identifier: " + c.identifier);

    var identifierHash = hash((c.identifier || '').split(/\./g), seed);
    var worker = workers[identifierHash % workers.length];
    if (worker)
    {
        // pass connection to worker
        worker.send({
            cmd: 'launchpad:connection',
            data: c.data
        }, fd);
    }
};

module.exports = function(options)
{
    //var connectionListener = layer3HashBalancedConnectionListener;
    var connectionListener = layer4HashBalancedConnectionListener;

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

    var republishPacket = node96RepublishPacket;

    var version = process.version.substr(1);
    var index = version.indexOf('.');
    if (Number(version.substr(0, index)) >= 1 || Number(version.substr(index + 1)) >= 12) {
        republishPacket = node012RepublishPacket;
    }

    if (cluster.isMaster) {
        setupMaster(connectionListener, completionCallback);
    }
    else {
        setupSlave(factoryCallback, reportCallback, republishPacket);
    }
};

var setupMaster = function(connectionListener, completionCallback) {

    // we spread over the maximum number of CPUs
    var num = require("os").cpus().length;

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

                        if (typeof(msg) === "object")
                        {
                            if (msg.cmd === "launchpad:sync-ack") {
                                patchConnection(msg, c);
                            }
                        }
                        else if (msg === "server-startup")
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

        var server = net.createServer(function(c) {
            connectionListener(c);
        });

        var port = process.env.PORT || 2999;
        server.listen(port);

        // tell the first worker to report
        if (workers.length > 0)
        {
            workers[0].send("server-report");
        }

        completionCallback(server);

    });
};

var setupSlave = function(factoryCallback, reportCallback, republishPacket) {

    factoryCallback(function(server) {

        // Worker process
        process.on("error", function() {
            console.log("ERRRRR");
        });

        process.on('message', function(msg, socket) {

            if (msg === "launchpad:sync")
            {
                /**
                 * Reading data once from file descriptor and extract ip from the
                 * header.
                 */
                socket.once('data', function(data) {

                    var identifier = "unknown";

                    var strData = data.toString().toLowerCase();

                    // does the this string data include anything we can use?
                    var searchPos = strData.indexOf("x-forwarded-for");
                    if (!searchPos)
                    {
                        searchPos = strData.indexOf("x-forwarded-host");
                    }
                    if (!searchPos)
                    {
                        searchPos = strData.indexOf("host");
                    }

                    // if we found something...
                    if (searchPos)
                    {
                        // strip out port if it is there
                        searchPos = strData.indexOf(':', searchPos) + 1;
                        strData = strData.substr(searchPos);

                        var endPos = strData.search(/\r\n|\r|\n/, searchPos);
                        identifier = strData.substr(0, endPos).trim();

                        // only keep the first IP address or host if we have a chain "i.e. a, b, c"
                        var idx = identifier.indexOf(",");
                        if (idx > -1)
                        {
                            identifier = identifier.substring(0, idx);
                        }
                    }
                    else
                    {
                        // just keep the "unknown" default
                    }

                    //Send acknowledge + data and identifier back to master
                    process.send({
                        cmd: 'launchpad:sync-ack',
                        identifier: identifier,
                        data: data
                    }, socket);
                });
            }
            else if (typeof msg === 'object')
            {
                if (msg.cmd === 'launchpad:connection')
                {
                    server.emit('connection', socket);

                    /**
                     * We're going to push the packet back to the net controller,
                     * to let this node complete the original request.
                     */
                    republishPacket(socket, msg.data);
                }
            }
            else if (msg === "server-report")
            {
                reportCallback();
            }
            else if (msg === "launchpad:connection")
            {
                server.emit('connection', socket);
            }
        });
    });

};