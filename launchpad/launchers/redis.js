const { Server } = require("socket.io");
const { setupWorker } = require("@socket.io/sticky");
const { createAdapter } = require("@socket.io/cluster-adapter");
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
        const io = new Server(httpServer);
    
        (async function() {
            var redisOptions = redisHelper.redisOptions({}, "CLOUDCMS_CLUSTER");
            await redisHelper.createAndConnect(redisOptions, function(err, _client) {
            
                const pubClient = _client;
                const subClient = pubClient.duplicate();
            
                io.adapter(createAdapter(pubClient, subClient));
                //io.listen(httpServerPort);
            
                io.on("connection", (socket) => {
                    // TODO
                });
            
                // setup connection with the primary process
                setupWorker(io);
            
                httpServer.io = io;
            
                return callback();
            });
        })();
    };
    
    return r;
}