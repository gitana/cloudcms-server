const cluster = require("cluster");

// Handle uncaught exceptions...
process.on('uncaughtException', function(err, source) {
    // if (err === "read ECONNRESET")
    // {
    //     // skip
    // }
    // else
    // {
        console.log(`Launchpad - process received event 'uncaughtException': ${err}, source: ${source}`);
        console.log(err.stack);
        console.log("ERR: ", err);
        console.log("SOURCE: ", source);
    // }
});

module.exports = function(type, config, options)
{
    if (!type) {
        type = process.env.CLOUDCMS_LAUNCHPAD_SETUP;
    }
    if (!type) {
        type = "single";
    }
    
    process.env.CLOUDCMS_LAUNCHPAD_SETUP = type
    
    var launcherFactory = require("./launchers/" + type);
    if (!launcherFactory)
    {
        throw new Error("Cannot find launcher factory: " + type);
    }
    
    var launcher = launcherFactory(config);
    
    var reportFn = options.report;
    if (!reportFn) {
        options.report = reportFn = function () {};
    }
    
    var completionFn = options.complete;
    if (!completionFn) {
        options.complete = completionFn = function(err) {
            throw new Error(err);
        };
    }
    
    var fork = true;
    if (type === "single") {
        fork = false;
    }
    
    var bindToListeningPort = function(app, httpServer)
    {
        var httpServerPort = -1;
        if (app) {
            httpServerPort = app.get("port");
        }
        if (httpServerPort === -1) {
            httpServerPort = process.env.PORT;
        }
        if (httpServerPort === -1) {
            httpServerPort = 3000;
        }
    
        httpServer.listen(httpServerPort);
    }
    
    var bindSignalHandler = function()
    {
        var signal = false;
        process.on('SIGINT', function() {
            if (!signal) {
                signal = true;
                console.log("-------");
                console.log("Heard SIGINT - shutting down in 10 seconds...");
                console.log("-------");
                setTimeout(function() { process.exit(0); }, 10000);
            }
        });
        process.on('SIGTERM', function() {
            if (!signal) {
                signal = true;
                console.log("-------");
                console.log("Heard SIGTERM - shutting down in 10 seconds...");
                console.log("-------");
                setTimeout(function() { process.exit(0); }, 10000);
            }
        });
    };
    
    if (!fork)
    {
        bindSignalHandler();
        
        return launchWorker(launcher, config, options, function(err, app, httpServer) {
            
            if (err) {
                return completionFn(config, err);
            }
    
            // bind to listening port
            bindToListeningPort(app, httpServer);
    
            reportFn(config);
            completionFn(config);
        });
    }
    else
    {
        // in cluster mode, we have a single master listening to the port which distributes work to the workers
        
        if (cluster.isMaster)
        {
            bindSignalHandler();
            
            return launchMaster(launcher, config, options, function(err, workers, httpServer) {
    
                if (err) {
                    return completionFn(config, err);
                }
                
                //reportFn(config);
                completionFn(config);
            });
        }
        else
        {
            return launchWorker(launcher, config, options, function(err, app, httpServer) {
    
                // bind to listening port
                bindToListeningPort(app, httpServer);
    
                completionFn(config, err);
            });
        }
    }
};

var launchMaster = function(launcher, config, options, done)
{
    var createHttpServer = options.createHttpServer;
    
    createHttpServer(null, function(err, httpServer) {
        
        if (err) {
            return done(err);
        }
    
        launcher.startCluster(httpServer, function(err) {
    
            if (err) {
                return done(err);
            }
            
            launcher.afterStartCluster(httpServer, function(err, workers) {
                console.log("LaunchPad started Master: " + process.pid);
                done(err, workers, httpServer);
            });
        });
    });
};

var launchWorker = function(launcher, config, options, done)
{
    var startServer = options.startServer;
    
    var configureServer = options.configureServer;
    if (!configureServer) {
        options.configureServer = configureServer = function(config, app, httpServer, done) {
            done();
        }
    }
    
    startServer(config, function(err, app, httpServer) {
        
        if (err) {
            return done(err);
        }
        
        launcher.afterStartServer(app, httpServer, function(err) {
            
            if (err) {
                return done(err);
            }
    
            configureServer(config, app, httpServer, function(err) {
                
                if (err) {
                    return done(err);
                }
    
                // if we are on a worker process, then inform the master that we completed
                if (process.send) {
                    process.send("worker-startup");
                }
    
                if (process.env["CLUSTER_REPORT"])
                {
                    var reportFn = options.report;
                    reportFn(config);
                }

                console.log("LaunchPad started Worker: " + process.pid);
                
                done(null, app, httpServer);
            });
        });
    });
};