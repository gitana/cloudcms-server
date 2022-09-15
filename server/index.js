var express = require('express');
var http = require('http');
var https = require('https');
var path = require('path');
var fs = require('fs');
var clone = require('clone');
var bytes = require('bytes');
var moment = require("moment");

var async = require('../util/async');

var morgan = require("morgan");
var bodyParser = require("body-parser");
var multipart = require("connect-multiparty");
var session = require('express-session');
var cookieParser = require('cookie-parser');
var flash = require("connect-flash");

//const redis = require('redis');
const connectRedis = require('connect-redis');

// we don't bind a single passport - instead, we get the constructor here by hand
var Passport = require("passport").Passport;

var util = require("../util/util");
var redisHelper = require("../util/redis");

var launchPad = require("../launchpad/index");
var cluster = require("cluster");

var requestParam = require("request-param")();

// cloudcms app server support
var main = require("../index");

// duster service
var duster = require("../duster/index");

var coreHelpers = require("../duster/helpers/core/index");

var helmet = require("helmet");

var responseTime = require("response-time");

// safely checks for the existence of a path
var safeExists = function(_path)
{
    var exists = false;
    try
    {
        exists = fs.existsSync(_path);
    }
    catch (e)
    {
        // swallow
    }
    
    return exists;
}

var requestCounter = 0;

// holds configuration settings
var SETTINGS = {
    "setup": "single", // single, cluster, redis
    "name": "Cloud CMS Application Server",
    "socketFunctions": [],
    "routeFunctions": [],
    "errorFunctions": [],
    "configureFunctions": {},
    "beforeFunctions": [],
    "afterFunctions": [],
    "reportFunctions": [],
    "dustFunctions": [],
    "initFunctions": [],
    "filterFunctions": [],
    "driverFunctions": [],
    "viewEngine": "handlebars",
    "storeEngines": {
        "app": {
            "type": "fs",
            "config": {
                "basePath": "{appBasePath}"
            }
        },
        "tmp": {
            "type": "fs",
            "config": {
                "basePath": "{tmpdirPath}/hosts/{host}",
                "hostsPath": "{tmpdirPath}/hosts"
            }
        },
        "hosts_fs": {
            "type": "fs",
            "config": {
                "basePath": "{hostsPath}/{host}",
                "hostsPath": "{hostsPath}"
            }
        },
        "hosts_s3": {
            "type": "s3",
            "config": {
                "accessKey": "",
                "secretKey": "",
                "bucket": "",
                "basePath": "{hostsPath}/{host}",
                "hostsPath": "{hostsPath}"
            }
        },
        "hosts_s3fs": {
            "type": "s3fs",
            "config": {
                "accessKey": "",
                "secretKey": "",
                "bucket": "",
                "basePath": "{hostsPath}/{host}",
                "hostsPath": "{hostsPath}"
            }
        }
    },
    "storeConfigurations": {
        "default": {
            "root": "app",
            "config": "app",
            "web": "app",
            "content": "tmp",
            "templates": "app",
            "themes": "app",
            "modules": "app"
        },
        "virtual": {
            "root": "tmp",
            "config": "tmp",
            "web": "tmp",
            "content": "tmp",
            "templates": "tmp",
            "themes": "tmp",
            "modules": "tmp"
        },
        "oneteam": {
            "root": "hosts_fs",
            "config": "app",
            "web": "app",
            "content": "hosts_fs",
            "templates": "app",
            "themes": "hosts_fs",
            "modules": "hosts_fs"
        },
        "net-development": {
            "root": "hosts_fs",
            "config": "hosts_fs",
            "web": "hosts_fs",
            "content": "hosts_fs",
            "templates": "hosts_fs",
            "themes": "hosts_fs",
            "modules": "hosts_fs"
        },
        "net-production": {
            "root": "hosts_s3fs",
            "config": "hosts_s3fs",
            "web": "hosts_s3fs",
            "content": "hosts_s3fs",
            "templates": "hosts_s3fs",
            "themes": "hosts_s3fs",
            "modules": "hosts_s3fs"
        },
        "net-development-s3": {
            "root": "hosts_s3",
            "config": "hosts_s3",
            "web": "hosts_s3",
            "content": "hosts_s3",
            "themes": "hosts_s3",
            "templates": "hosts_s3"
        },
        "net-development-s3fs": {
            "root": "hosts_s3fs",
            "config": "hosts_s3fs",
            "web": "hosts_s3fs",
            "content": "hosts_s3fs",
            "templates": "hosts_s3fs",
            "themes": "hosts_s3fs",
            "modules": "hosts_s3fs"
        }
    },
    "duster": {
        "fragments": {
            "cache": true
        }
    },
    "virtualHost": {
        "enabled": false
    },
    "wcm": {
        "enabled": false,
        "cache": false,
        "matchCase": true,
        "cacheKey": {
            "params": {
                "includes": [],
                "excludes": [],
                "excludeAll": false
            }
        },
        "pageCacheTTL": undefined,
        "pageCacheRetryTimeout": undefined
    },
    "serverTags": {
        "enabled": false
    },
    "insight": {
        "enabled": false
    },
    "perf": {
        "enabled": true
    },
    "driverConfig": {
        "enabled": true
    },
    "virtualDriver": {
        "enabled": false
    },
    "virtualContent": {
        "enabled": true
    },
    "flow": {
        "enabled": false
    },
    "form": {
        "enabled": true
    },
    "auth": {
        "enabled": true,
        "providers": {
            "facebook": {
                "enabled": false
            },
            "twitter": {
                "enabled": false
            },
            "linkedin": {
                "enabled": false
            }
        }
    },
    "notifications": {
        "enabled": false,
        "type": null,
        "configuration": {
        }
    },
    "broadcast": {
        "enabled": true
    },
    "local": {
        "enabled": true
    },
    "welcome": {
        "enabled": true,
        "file": "index.html"
    },
    "config": {
        "enabled": true
    },
    "cache": {
        "enabled": true
    },
    "templates": {
        "enabled": true
    },
    "modules": {
        "enabled": true
    },
    "debug": {
        "enabled": false,
        "logGlobalTimings": false
    },
    "cors": {
        "enabled": true,
        "origin": null,
        "methods": "GET, POST, PUT, DELETE, OPTIONS",
        "headers": "X-Forwarded-Host, X-Requested-With, Content-Type, Authorization, Origin, X-Requested-With, X-Prototype-Version, Cache-Control, Pragma, X-CSRF-TOKEN, X-XSRF-TOKEN",
        "credentials": true
    },
    "admin": {
        "enabled": true,
        "username": "admin",
        "password": "admin"
    },
    "bodyParsers": {
        "multipart": {
        },
        "json": {
            "limit": "100kb"
        },
        "urlencoded": {
            "extended": true
        }
    },
    "renditions": {
        "enabled": true
    },
    "gitana": {
        "httpWorkQueueSize": 5
    },
    "proxy": {
        "enabled": true,
        "cache": []
    },
    "session": {
        "enabled": false//,
        //"secret": null,
        //"type": "file",
        //"ttl": -1,
        //"reapInterval": -1
    },
    "awareness": {
        "enabled": false
    },
    "graphql": {
        "enabled": true,
        "config": {
            "anonymous": true
        }
    }
};

// always push core tag helpers to the front
SETTINGS.dustFunctions.unshift(coreHelpers);

// if SETTINGS.errorFunctions is empty, plug in a default error handler
if (SETTINGS.errorFunctions.length === 0)
{
    SETTINGS.errorFunctions.push(main.defaultErrorHandler);
}
else
{
    // otherwise, if they plugged in a custom error handler, make sure we at least have a console logger ahead of it
    // so that things are sure to get logged out to console
    SETTINGS.errorFunctions.unshift(main.consoleErrorLogger);
}

// insert an error handler to handle refresh token failures
SETTINGS.errorFunctions.unshift(main.refreshTokenErrorHandler);

// CLOUDCMS_HOSTS_PATH environment variable
// assume /hosts with optional fallback to /System/Volumes/Data/hosts for MacOS support
if (!process.env.CLOUDCMS_HOSTS_PATH)
{
    process.env.CLOUDCMS_HOSTS_PATH = "/hosts";
    
    if (!safeExists(process.env.CLOUDCMS_HOSTS_PATH))
    {
        if (safeExists("/System/Volumes/Data/hosts"))
        {
            process.env.CLOUDCMS_HOSTS_PATH = "/System/Volumes/Data/hosts";
        }
        else
        {
            const homedir = require('os').homedir();
            
            if (safeExists(homedir + "/hosts"))
            {
                process.env.CLOUDCMS_HOSTS_PATH = homedir + "/hosts";
            }
        }
    }
}

















// runs on 2999 by default
process.env.PORT = process.env.PORT || 2999;

var exports = module.exports;

/**
 * Sets a configuration key/value.
 *
 * @param key
 * @param value
 */
exports.set = function (key, value) {
    SETTINGS[key] = value;
};

/**
 * Gets a configuration key/value.
 *
 * @param key
 * @return {*}
 */
exports.get = function (key) {
    return SETTINGS[key];
};

/**
 * Registers an express configuration function for a specific environment.
 *
 * @param env
 * @param fn
 */
exports.configure = function (env, fn) {
    if (!SETTINGS.configureFunctions[env]) {
        SETTINGS.configureFunctions[env] = [];
    }

    SETTINGS.configureFunctions[env].push(fn);
};

/**
 * Registers a socket configuration function.
 *
 * @param fn
 */
exports.sockets = function (fn) {
    SETTINGS.socketFunctions.push(fn);
};

/**
 * Registers a route configuration function.
 *
 * @param fn
 */
exports.routes = function (fn) {
    SETTINGS.routeFunctions.push(fn);
};

/**
 * Registers an error handler function.
 *
 * @param fn
 */
exports.error = function (fn) {
    SETTINGS.errorFunctions.push(fn);
};

/**
 * Adds an initialization function to set up dust.
 *
 * The function must have signature fn(app, dust)
 *
 * @param helperFn
 */
var dust = exports.dust = function(fn) {
    SETTINGS.dustFunctions.push(fn);
};

/**
 * Registers a function to run before the server starts.
 *
 * @param fn
 */
var before = exports.before = function (fn) {
    SETTINGS.beforeFunctions.push(fn);
};

/**
 * Registers a function to run after the server starts.
 *
 * @param fn
 */
var after = exports.after = function (fn) {
    SETTINGS.afterFunctions.push(fn);
};

/**
 * Registers a function to run after all server instances have started
 *
 * @param fn
 */
var report = exports.report = function (fn) {
    SETTINGS.reportFunctions.push(fn);
};

/**
 * Registers a function to run at init.
 *
 * @param fn
 */
var init = exports.init = function (fn) {
    SETTINGS.initFunctions.push(fn);
};

/**
 * Registers a function to run in filters phase.
 *
 * @param fn
 */
var filters = exports.filters = exports.filter = function (fn) {
    SETTINGS.filterFunctions.push(fn);
};

/**
 * Registers a function to run in the "driver" phase.
 *
 * @type {Function}
 */
var driver = exports.driver = function(fn) {
    SETTINGS.driverFunctions.push(fn);
};

/*******************************************************************************************************/
/*******************************************************************************************************/
/*******************************************************************************************************/

var runFunctions = function (functions, args, callback) {

    // skip out early if nothing to do
    if (!functions || functions.length === 0) {
        return callback();
    }

    async.series(functions, args, function (err) {

        if (err) {
            process.log(err);
            throw new Error(err);
        }

        callback(err);
    });
};


/*******************************************************************************************************/
/*******************************************************************************************************/
/*******************************************************************************************************/

/**
 * Starts the Cloud CMS server.
 *
 * @param overrides optional config overrides
 * @param callback optional callback function
 */
exports.start = function(overrides, callback) {

    setTimeout(function() {
        _start(overrides, function(err) {
            if (callback) {
                callback(err);
            }
        });
    }, 10);
};

var _start = function(overrides, callback) {

    if (typeof(overrides) === "function") {
        callback = overrides;
        overrides = null;
    }

    if (!callback) {
        callback = function() {};
    }

    // create our master config
    var config = clone(SETTINGS);
    if (overrides) {
        util.merge(overrides, config);
    }
    
    // set up modes
    process.env.CLOUDCMS_APPSERVER_MODE = "development";
    
    if (process.env.NODE_ENV === "production") {
        process.env.CLOUDCMS_APPSERVER_MODE = "production";
    }
    
    /*
    // set up domain hosting
    // if not otherwise specified, we assume hosting at *.cloudcms.net
    if (!process.env.CLOUDCMS_VIRTUAL_HOST) {

        if (!process.env.CLOUDCMS_VIRTUAL_HOST_DOMAIN) {
            process.env.CLOUDCMS_VIRTUAL_HOST_DOMAIN = "cloudcms.net";
        }
    }
    */
    
    // store config on process instance
    process.configuration = config;
    
    // some config overrides can come in through process.configuration
    if (process.configuration) {
        if (process.configuration.virtualHost && process.configuration.virtualHost.domain) {
            if (!process.env.CLOUDCMS_VIRTUAL_HOST) {
                if (!process.env.CLOUDCMS_VIRTUAL_HOST_DOMAIN) {
                    process.env.CLOUDCMS_VIRTUAL_HOST_DOMAIN = process.configuration.virtualHost.domain;
                }
            }
        }
    }
    if (process.env.CLOUDCMS_VIRTUAL_HOST_DOMAIN) {
        process.env.CLOUDCMS_VIRTUAL_HOST_DOMAIN = process.env.CLOUDCMS_VIRTUAL_HOST_DOMAIN.toLowerCase();
    }
    
    if (!process.env.CLOUDCMS_STANDALONE_HOST) {
        process.env.CLOUDCMS_STANDALONE_HOST = "local";
    }
    
    
    // auto-configuration for HTTPS
    if (!process.configuration.https) {
        process.configuration.https = {};
    }
    if (process.env.CLOUDCMS_HTTPS) {
        process.configuration.https = JSON.parse(process.env.CLOUDCMS_HTTPS);
    }
    if (process.env.CLOUDCMS_HTTPS_KEY_FILEPATH) {
        process.configuration.https.key = fs.readFileSync(process.env.CLOUDCMS_HTTPS_KEY_FILEPATH);
    }
    if (process.env.CLOUDCMS_HTTPS_CERT_FILEPATH) {
        process.configuration.https.cert = fs.readFileSync(process.env.CLOUDCMS_HTTPS_CERT_FILEPATH);
    }
    if (process.env.CLOUDCMS_HTTPS_PFX_FILEPATH) {
        process.configuration.https.pfx = fs.readFileSync(process.env.CLOUDCMS_HTTPS_PFX_FILEPATH);
    }
    if (process.env.CLOUDCMS_HTTPS_PASSPHRASE) {
        process.configuration.https.passphrase = process.env.CLOUDCMS_HTTPS_PASSPHRASE;
    }
    if (process.env.CLOUDCMS_HTTPS_REQUEST_CERT === "true") {
        process.configuration.https.requestCert = true;
    }
    if (process.env.CLOUDCMS_HTTPS_CA_FILEPATH) {
        process.configuration.https.ca = [ fs.readFileSync(process.env.CLOUDCMS_HTTPS_CA_FILEPATH) ];
    }
    
    // if https config is empty, remove it
    if (Object.keys(process.configuration.https).length === 0) {
        delete process.configuration.https;
    }
    
    
    // auto configuration of session store
    if (!process.configuration.session) {
        process.configuration.session = {};
    }
    // auto-configuration for redis?
    if (process.env.CLOUDCMS_REDIS_URL || (process.env.CLOUDCMS_REDIS_ENDPOINT && process.env.CLOUDCMS_REDIS_PORT)) {
        process.env.CLOUDCMS_SESSION_TYPE = "redis";
    }
    
    if (process.env.CLOUDCMS_SESSION_TYPE) {
        process.configuration.session.enabled = true;
        process.configuration.session.type = process.env.CLOUDCMS_SESSION_TYPE;
    }
    if (process.env.CLOUDCMS_SESSION_SECRET) {
        process.configuration.session.secret = process.env.CLOUDCMS_SESSION_SECRET;
    }
    
    
    // determine the max files
    util.maxFiles(function(err, maxFiles) {
        process.env.CLOUDCMS_MAX_FILES = maxFiles;
        
        // assume for launchpad
        if (!config.setup) {
            config.setup = "single";
        }
        
        launchPad(config.setup, config, {
            "createHttpServer": function(app, done) {
                createHttpServer(app, function(err, httpServer) {
                    done(err, httpServer);
                });
            },
            "startServer": function(config, done) {
                startServer(config, function(err, app, httpServer, httpServerPort) {
                    done(err, app, httpServer, httpServerPort);
                });
            },
            "configureServer": function(config, app, httpServer, done) {
                configureServer(config, app, httpServer, function(err) {
                    done(err);
                });
            },
            "report": function(config) {
                runFunctions(config.reportFunctions, [], function(err) {
                    // todo
                });
            },
            "complete": function(config, err) {
                callback(err);
            }
        });
    });
};

var initSession = function(initDone)
{
    if (!process.configuration.session) {
        return initDone();
    }
    if (!process.configuration.session.enabled) {
        return initDone();
    }
    
    var sessionSecret = process.configuration.session.secret;
    if (!sessionSecret) {
        sessionSecret = "secret";
    }
    
    var sessionConfig = {
        secret: sessionSecret,
        resave: false,
        saveUninitialized: false
    };
    
    if (process.configuration.session.type) {
        process.configuration.session.type = process.configuration.session.type.toLowerCase();
    }
    
    if (process.configuration.session.type === "file")
    {
        var options = {};
        if (process.configuration.session.ttl)
        {
            options.ttl = process.configuration.session.ttl;
        }
        if (process.configuration.session.reapInterval)
        {
            options.reapInterval = process.configuration.session.reapInterval;
        }
        // session file store
        var SessionFileStore = require('session-file-store')(session);
        sessionConfig.store = new SessionFileStore(options);
        return initDone(null, session(sessionConfig));
    }
    else if (process.configuration.session.type === "redis")
    {
        var IORedis = require("ioredis");
        var redisOptions = redisHelper.redisOptions();
        var redisClient = new IORedis(redisOptions.url);
    
        var RedisStore = connectRedis(session);
        sessionConfig.store = new RedisStore({ client: redisClient });
        initDone(null, session(sessionConfig));
    }
    else if (process.configuration.session.type === "memory" || !process.configuration.session.type)
    {
        var options = {};
        options.checkPeriod = 86400000; // prune expired entries every 24h
        
        // session memory store
        var MemoryStore = require('memorystore')(session);
        sessionConfig.store = new MemoryStore(options);
        return initDone(null, session(sessionConfig));
    }
};

var startServer = function(config, startServerFinishedFn)
{
    var app = express();
    app.disable('x-powered-by');
    
    initSession(function(err, initializedSession) {

        if (err) {
            throw err;
        }
        
        // global temp directory
        util.createTempDirectory(function(err, tempDirectory) {
            process.env.CLOUDCMS_TEMPDIR_PATH = tempDirectory;
    
            // global service starts
            main.init(app, function (err) {
    
                app.enable('strict routing');
    
                ////////////////////////////////////////////////////////////////////////////
                //
                // BASE CONFIGURATION
                //
                // Configures NodeJS app server using dustjs templating engine
                // Runs on port 3000 by default
                //
                ////////////////////////////////////////////////////////////////////////////
    
                // all environments
                app.set('port', process.env.PORT);
                app.set('views', process.env.CLOUDCMS_APPSERVER_BASE_PATH + "/views");
    
                if (config.viewEngine === "dust")
                {
                    var cons = require('consolidate');
    
                    app.set('view engine', 'html');
                    app.set('view engine', 'dust');
                    app.engine('html', cons.dust);
                    app.engine('dust', cons.dust);
                }
                else if (config.viewEngine === "handlebars" || config.viewEngine === "hbs")
                {
                    var hbs = require('hbs');
    
                    app.set('view engine', 'html');
                    app.set('view engine', 'hbs');
                    app.engine('html', hbs.__express);
                    app.engine('hbs', hbs.__express);
                }
    
                ////////////////////////////////////////////////////////////////////////////
                //
                // VIRTUAL SUPPORT
                //
                // Configure NodeJS to load virtual driver and configure for virtual descriptors
                // ahead of anything else running.
                //
                ////////////////////////////////////////////////////////////////////////////
    
                // custom morgan logger
                morgan(function (tokens, req, res) {
    
                    var status = res.statusCode;
                    var len = parseInt(res.getHeader('Content-Length'), 10);
                    var host = req.domainHost;
                    if (req.virtualHost) {
                        host = req.virtualHost;
                    }
    
                    len = isNaN(len) ? '0b' : len = bytes(len);
    
                    var d = new Date();
                    var dateString = d.toDateString();
                    var timeString = d.toTimeString();
    
                    // gray color
                    var grayColor = "\x1b[90m";
    
                    // status color
                    var color = 32;
                    if (status >= 500) {
                        color = 31;
                    }
                    else if (status >= 400) {
                        color = 33;
                    }
                    else if (status >= 300) {
                        color = 36;
                    }
                    var statusColor = "\x1b[" + color + "m";
    
                    // final color
                    var finalColor = "\x1b[0m";
    
                    if (process.env.CLOUDCMS_APPSERVER_MODE === "production")
                    {
                        grayColor = "";
                        statusColor = "";
                        finalColor = "";
                    }
    
                    var message = '';
                    message += grayColor + '<' + req.id + '> ';
                    message += grayColor + '[' + dateString + ' ' + timeString + '] ';
                    message += grayColor + host + ' ';
                    //message += grayColor + '(' + req.ip + ') ';
                    message += statusColor + res.statusCode + ' ';
                    message += statusColor + (new Date - req._startTime) + ' ms ';
                    message += grayColor + '"' + req.method + ' ';
                    message += grayColor + req.originalUrl + '" ';
                    message += grayColor + len + ' ';
                    message += finalColor;
    
                    return message;
                });
    
                /*
                // debug headers being set
                app.use(function(req, res, next) {
                    var setHeader = res.setHeader;
                    res.setHeader = function(a,b) {
                        console.trace("Writing header: " + a + " = " + b);
                        setHeader.call(this, a,b);
                    };
                    next();
                });
                */
    
                // increment and assign request id
                app.use(function (req, res, next) {
                    requestCounter++;
                    req.id = requestCounter;
                    next();
                });
    
                // APPLY CUSTOM INIT FUNCTIONS
                runFunctions(config.initFunctions, [app], function (err) {
    
                    // retain originalUrl and originalPath since these can get modified along the way
                    app.use(function (req, res, next) {
                        req.originalUrl = req.url;
                        req.originalPath = req.path;
                        next();
                    });
    
                    // req.param method
                    app.use(requestParam);
    
                    // add req.log function
                    app.use(function (req, res, next) {
    
                        req._log = req.log = function (text/*, warn*/) {
    
                            var host = req.domainHost;
                            if (req.virtualHost)
                            {
                                host = req.virtualHost;
                            }
    
                            var timestamp = moment(new Date()).format("MM/DD/YYYY HH:mm:ss Z");
                            var grayColor = "\x1b[90m";
                            var finalColor = "\x1b[0m";
    
                            // in production, don't use colors
                            if (process.env.CLOUDCMS_APPSERVER_MODE === "production")
                            {
                                grayColor = "";
                                finalColor = "";
                            }
    
                            var message = '';
                            message += grayColor + '<' + req.id + '> ';
                            if (cluster.worker && cluster.worker.id)
                            {
                                message += grayColor + '(' + cluster.worker.id + ') ';
                            }
                            message += grayColor + '[' + timestamp + '] ';
                            message += grayColor + host + ' ';
                            message += grayColor + text + '';
                            message += finalColor;
    
                            /*
                            if (warn)
                            {
                                message = "\r\n**** SLOW RESPONSE ****\r\n" + message + "\r\n";
                            }
                            */
    
                            console.log(message);
                        };
    
                        next();
                    });
    
                    // common interceptors and config
                    main.common1(app);
    
                    // general logging of requests
                    // gather statistics on response time
                    app.use(responseTime(function (req, res, time) {
    
                        var warn = false;
                        if (time > 1000)
                        {
                            warn = true;
                        }
    
                        var requestPath = req.originalPath;
                        if (requestPath)
                        {
                            var filter = false;
                            if (requestPath.indexOf("/login") > -1)
                            {
                                filter = true;
                            }
                            if (requestPath.indexOf("/token") > -1)
                            {
                                filter = true;
                            }
                            if (filter)
                            {
                                requestPath = util.stripQueryStringFromUrl(requestPath);
                            }
                        }
    
                        req.log(req.method + " " + requestPath + " [" + res.statusCode + "] (" + time.toFixed(2) + " ms)", warn);
                    }));
    
                    // set up CORS allowances
                    // this lets CORS requests float through the proxy
                    app.use(main.ensureCORS());
    
                    // set up default security headers
                    app.use(main.ensureHeaders());
    
                    // common interceptors and config
                    main.common2(app);
    
                    // APPLY CUSTOM DRIVER FUNCTIONS
                    runFunctions(config.driverFunctions, [app], function(err) {
    
                        // binds gitana driver into place
                        main.common3(app);
    
                        // parse cookies
                        app.use(cookieParser());
    
                        // cloudcms things need to run here
                        main.common4(app, true);
    
                        // APPLY CUSTOM FILTER FUNCTIONS
                        runFunctions(config.filterFunctions, [app], function (err) {
    
                            // PATH BASED PERFORMANCE CACHING
                            main.perf1(app);
    
                            // proxy - anything that goes to /proxy is handled here early and nothing processes afterwards
                            main.proxy(app);
    
                            // MIMETYPE BASED PERFORMANCE CACHING
                            main.perf2(app);
    
                            // DEVELOPMENT BASED PERFORMANCE CACHING
                            main.perf3(app);
    
                            // standard body parsing + a special cloud cms body parser that makes a last ditch effort for anything
                            // that might be JSON (regardless of content type)
                            app.use(function (req, res, next) {
    
                                multipart(process.configuration.bodyParsers.multipart || {})(req, res, function (err) {
                                    bodyParser.json(process.configuration.bodyParsers.json || {})(req, res, function (err) {
                                        bodyParser.urlencoded(process.configuration.bodyParsers.urlencoded || {})(req, res, function (err) {
                                            main.bodyParser()(req, res, function (err) {
                                                next(err);
                                            });
                                        });
                                    });
                                });
    
                            });
    
                            if (initializedSession)
                            {
                                app.use(initializedSession);
                                app.use(flash());
                            }
    
                            // this is the same as calling
                            // app.use(passport.initialize());
                            // except we create a new passport each time and store on request to support multitenancy
                            app.use(function(req, res, next) {
    
                                var passport = new Passport();
                                passport._key = "passport-" + req.virtualHost;
    
                                req._passport = {};
                                req._passport.instance = passport;
    
                                if (req.session && req.session[passport._key])
                                {
                                    // load data from existing session
                                    req._passport.session = req.session[passport._key];
                                }
    
                                // add this in
                                req.passport = req._passport.instance;
    
                                // passport - serialize and deserialize
                                req.passport.serializeUser(function(user, done) {
                                    done(null, user);
                                });
                                req.passport.deserializeUser(function(user, done) {
                                    done(null, user);
                                });
    
                                next();
                            });
    
                            // passport session
                            if (initializedSession)
                            {
                                app.use(function(req, res, next) {
                                    req.passport.session()(req, res, next);
                                });
                            }
    
                            // welcome files
                            main.welcome(app);
    
                            // configure cloudcms app server command handing
                            main.interceptors(app, true);
    
                            //app.use(app.router);
    
                            // healthcheck middleware
                            main.healthcheck(app);
    
                            // APPLY CUSTOM ROUTES
                            runFunctions(config.routeFunctions, [app], function (err) {
    
                                // configure cloudcms app server handlers
                                main.handlers(app, true);
    
                                // register error functions
                                runFunctions(config.errorFunctions, [app], function (err) {
    
                                    // APPLY CUSTOM CONFIGURE FUNCTIONS
                                    var allConfigureFunctions = [];
                                    for (var env in config.configureFunctions)
                                    {
                                        var functions = config.configureFunctions[env];
                                        if (functions)
                                        {
                                            for (var i = 0; i < functions.length; i++)
                                            {
                                                allConfigureFunctions.push(functions[i]);
                                            }
                                        }
                                    }
                                    runFunctions(allConfigureFunctions, [app], function (err) {
    
                                        // create the server (either HTTP or HTTPS)
                                        createHttpServer(app, function(err, httpServer) {
                                            
                                            if (err) {
                                                return startServerFinishedFn(err);
                                            }
                                            
                                            startServerFinishedFn(null, app, httpServer);
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
};

var createHttpServer = function(app, done)
{
    // create the server (either HTTP or HTTPS)
    var httpServer = null;
    
    if (process.configuration.https)
    {
        if (app)
        {
            // configure helmet to support auto-upgrade of http->https
            app.use(helmet());
        }
            
        // create https server
        httpServer = https.createServer(process.configuration.https, app);
    }
    else
    {
        // legacy
        httpServer = http.Server(app);
    }
    
    // request timeout
    var requestTimeout = 30000; // 30 seconds
    if (process.configuration && process.configuration.timeout)
    {
        requestTimeout = process.configuration.timeout;
    }
    httpServer.setTimeout(requestTimeout);
    
    // socket
    httpServer.on("connection", function (socket) {
        socket.setNoDelay(true);
    });
    
    done(null, httpServer);
}

var configureServer = function(config, app, httpServer, configureServerFinishedFn)
{
    var io = httpServer.io;
    if (io)
    {
        //io.set('transports', config.socketTransports);
        io.use(function (socket, next) {
            
            // console.log("New socket being initialized");
            
            // attach _log function
            socket._log = function (text) {
                
                var host = socket.handshake.headers.host;
                if (socket.handshake.headers["x-forwarded-host"])
                {
                    host = socket.handshake.headers["x-forwarded-host"];
                }
                
                var d = new Date();
                var dateString = d.toDateString();
                var timeString = d.toTimeString();
                
                // gray color
                var grayColor = "\x1b[90m";
                
                // final color
                var finalColor = "\x1b[0m";
                
                if (process.env.CLOUDCMS_APPSERVER_MODE === "production")
                {
                    grayColor = "";
                    finalColor = "";
                }
                
                var message = '';
                message += grayColor + '<socket> ';
                message += grayColor + '[' + dateString + ' ' + timeString + '] ';
                message += grayColor + host + ' ';
                message += grayColor + text + '';
                message += finalColor;
                
                console.log(message);
            };
            /*
            socket.on("connect", function () {
                console.log("Socket connect()");
            });
            */
            /*
            socket.on("disconnect", function () {
                var message = "Socket disconnected";
                if (socket && socket.host)
                {
                    message += ", host=" + socket.host;
                }
                if (socket && socket.gitana && socket.gitana.application && socket.gitana.application())
                {
                    message += ", application=" + socket.gitana.application().title;
                }
                console.log(message);
            });
            */
            
            // APPLY CUSTOM SOCKET.IO CONFIG
            runFunctions(config.socketFunctions, [socket], function (err) {
                
                require("../middleware/awareness/awareness").initSocketIO(io, function() {
                    next();
                });
                
                // INSIGHT SERVER
                // if (config.insight && config.insight.enabled)
                // {
                //     console.log("Init Insight to Socket");
                
                //     require("../insight/insight").init(socket, function () {
                //         next();
                //     });
                // }
                // else
                // {
                //     next();
                // }
            });
            
        });
    }
    
    // SET INITIAL VALUE FOR SERVER TIMESTAMP
    process.env.CLOUDCMS_APPSERVER_TIMESTAMP = new Date().getTime();
    
    // DUST
    runFunctions(config.dustFunctions, [app, duster.getDust()], function (err) {
        
        // APPLY SERVER BEFORE START FUNCTIONS
        runFunctions(config.beforeFunctions, [app], function (err) {
            
            // AFTER SERVER START
            runFunctions(config.afterFunctions, [app], function (err) {
                
                function cleanup() {
                    
                    if (cluster.isMaster)
                    {
                        console.log("");
                        console.log("");
                        
                        console.log("Cloud CMS Module shutting down");
                        
                        // close server connections as cleanly as we can
                        console.log(" -> Closing server connections");
                    }
                    
                    try
                    {
                        httpServer.close();
                    }
                    catch (e)
                    {
                        console.log("Server.close produced error: " + JSON.stringify(e));
                    }
                    
                    if (cluster.isMaster)
                    {
                        console.log("");
                    }
                    
                    // tell the process to exit
                    process.exit();
                }
                
                // listen for kill or interrupt so that we can shut down cleanly
                process.on('SIGINT', cleanup);
                process.on('SIGTERM', cleanup);
                
                configureServerFinishedFn();
            });
        });
    });
};



////////////////////////////////////////////////////////////////////////////
//
// DEFAULT HANDLERS
//
////////////////////////////////////////////////////////////////////////////

// default before function
before(function (app, callback) {
    callback();
});

// default after function
after(function (app, callback) {
    callback();
});
