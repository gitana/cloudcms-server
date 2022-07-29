const cluster = require("cluster");

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
    
    if (!fork)
    {
        return launchWorker(launcher, config, options, function(err, app, httpServer) {
            
            if (err) {
                return completionFn(config, err);
            }
    
            var httpServerPort = -1;
            // if (app) {
            //     httpServerPort = app.get("port");
            // }
            if (httpServerPort === -1) {
                httpServerPort = process.env.PORT;
            }
            if (httpServerPort === -1) {
                httpServerPort = 3000;
            }
    
            httpServer.listen(httpServerPort);
    
            reportFn(config);
            completionFn(config);
        });
    }
    else
    {
        if (cluster.isMaster)
        {
            return launchMaster(launcher, config, options, function(err, workers) {
    
                if (err) {
                    return completionFn(config, err);
                }
    
                //reportFn(config);
                completionFn(config);
            });
        }
        else
        {
            return launchWorker(launcher, config, options, function(err) {
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
    
            var httpServerPort = -1;
            // if (app) {
            //     httpServerPort = app.get("port");
            // }
            if (httpServerPort === -1) {
                httpServerPort = process.env.PORT;
            }
            if (httpServerPort === -1) {
                httpServerPort = 3000;
            }
    
            httpServer.listen(httpServerPort);
    
            launcher.afterStartCluster(httpServer, function(err, workers) {
                done(err, workers);
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

                done(null, app, httpServer);
            });
        });
    });
};