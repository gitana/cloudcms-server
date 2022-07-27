var clusterlock = require("../../temp/clusterlock");

const cluster = require("cluster");
const { Server } = require("socket.io");
const numCPUs = require("os").cpus().length;
const { setupMaster, setupWorker } = require("@socket.io/sticky");
const { createAdapter, setupPrimary } = require("@socket.io/cluster-adapter");

module.exports = function(config) {
    
    var r = {};
    
    r.startCluster = function(httpServer, callback)
    {
        // setup sticky sessions
        setupMaster(httpServer, {
            loadBalancingMethod: "least-connection",
        });

        // setup connections between the workers
        setupPrimary();

        // needed for packets containing buffers
        cluster.setupPrimary({
            serialization: "advanced"
        });

        return callback();
    };
    
    r.afterStartCluster = function(httpServer, callback)
    {
        // start up cluster locks
        clusterlock.setup();
        
        var startupCount = 0;
        
        var workers = [];
        for (let i = 0; i < numCPUs; i++)
        {
            var workerEnv = {};
            if (i === 0) {
                workerEnv["CLUSTER_REPORT"] = true;
            }
            
            var worker = cluster.fork(workerEnv);
            
            worker.on('message', function (msg, c) {
                if (msg === "worker-startup") {
                    startupCount++;
                }
            });
            
            workers.push(worker);
        }
        
        cluster.on("exit", (worker) => {
            console.log(`Worker ${worker.process.pid} died`);
            cluster.fork();
        });
        
        // wait for workers to start
        var waitFn = function() {
            setTimeout(function() {
                if (startupCount >= numCPUs) {
                    return callback(null, workers);
                }
                else
                {
                    waitFn();
                }
            }, 25);
        };
        waitFn();
    };
    
    r.afterStartServer = function(app, httpServer, callback)
    {
        // worker
    
        const io = new Server(httpServer);
    
        // use the cluster adapter
        io.adapter(createAdapter());
    
        // setup connection with the primary process
        setupWorker(io);
    
        io.on("connection", (socket) => {
            // TODO
        });

        httpServer.io = io;

        return callback();
    };
    
    return r;
}
