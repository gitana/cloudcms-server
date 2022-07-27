const { Server } = require("socket.io");

module.exports = function(config) {
    
    var r = {};
    
    r.startCluster = function(httpServer, callback)
    {
        callback();
    };
    
    r.afterStartCluster = function(httpServer, callback)
    {
        callback();
    };
    
    r.afterStartServer = function(app, httpServer, callback)
    {
        var io = new Server(httpServer);
    
        io.on("connection", (socket) => {
            // TODO
        });
        
        httpServer.io = io;
        
        callback();
    };
    
    return r;
}