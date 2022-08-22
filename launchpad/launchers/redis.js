const { Server } = require("socket.io");
const { setupWorker } = require("@socket.io/sticky");
const { createAdapter } = require("@socket.io/redis-adapter");
const redisHelper = require("../../util/redis");

const clusterLauncherFactory = require("./cluster");

module.exports = function(config) {
    
    var clusterLauncher = clusterLauncherFactory(config);
    
    var r = {};
    
    r.startCluster = function(httpServer, callback)
    {
        clusterLauncher.startCluster(httpServer, callback);
    };
    
    r.afterStartCluster = function(httpServer, callback)
    {
        clusterLauncher.afterStartCluster(httpServer, callback);
    };
    
    r.afterStartServer = function(app, httpServer, callback)
    {
        (async function(app, httpServer, callback) {
            var redisOptions = redisHelper.redisOptions({}, "CLOUDCMS_CLUSTER");
            await redisHelper.createAndConnect(redisOptions, function(err, _client) {
    
                const pubClient = _client;
                const subClient = pubClient.duplicate();
    
                pubClient.on("error", function(err) {
                    // something went wrong
                    console.log("Pub Client caught error: ", err);
                });
    
                subClient.on("error", function(err) {
                    // something went wrong
                    console.log("Sub Client caught error: ", err);
                });
    
                const io = new Server(httpServer);
                httpServer.io = io;
    
                io.engine.on("connection_error", function(err) {
                    // console.log("CONNECTION ERROR");
                    // console.log("REQUEST: " + err.req);      // the request object
                    // console.log("CODE: " + err.code);     // the error code, for example 1
                    // console.log("MESSAGE: " + err.message);  // the error message, for example "Session ID unknown"
                    // console.log("CONTEXT: " + err.context);  // some additional error context
                });
    
                // use the redis adapter
                io.adapter(createAdapter(pubClient, subClient, {
                    //publishOnSpecificResponseChannel: true
                }));
    
                // setup connection with the primary process
                setupWorker(io);
                
                // on connect
                io.on("connection", (socket) => {
                    //console.log("Redis Launcher on('connection') - socket id:" + socket.id);
                    // socket.on('message', function(m) {
                    //     console.log("Socket Connection message: " + m);
                    // });
                    //
                    // // always catch err
                    // socket.on("error", function(err) {
                    //     console.log("Caught socket error");
                    //     console.log(err.stack);
                    // });
                    
                    // TODO
                });
                
                return callback();
            });
        })(app, httpServer, callback);
    };
    
    return r;
}