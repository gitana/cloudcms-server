var express = require('express');
var http = require('http');
var https = require('https');
var path = require('path');
var fs = require('fs');
var clone = require('clone');
var xtend = require('xtend');
var bytes = require('bytes');

var async = require('../util/async');

var perf = require("../middleware/perf/perf");
var proxy = require("../middleware/proxy/proxy");

var morgan = require("morgan");
var bodyParser = require("body-parser");
var methodOverride = require('method-override');
var errorHandler = require("errorhandler");
var multipart = require("connect-multiparty");
var session = require('express-session');
var cookieParser = require('cookie-parser');

var app = express();

// cloudcms app server support
var main = require("../index");

// set up modes
process.env.CLOUDCMS_APPSERVER_MODE = "development";

if (process.env.NODE_ENV == "production")
{
    process.env.CLOUDCMS_APPSERVER_MODE = "production";
}

// set up domain hosting
// if not otherwise specified, we assume hosting at *.cloudcms.net
if (!process.env.CLOUDCMS_DOMAIN)
{
    process.env.CLOUDCMS_DOMAIN = "cloudcms.net";
}


var requestCounter = 0;


// holds configuration settings
var SETTINGS = {
    "name": "Cloud CMS Application Server",
    "socketFunctions": [],
    "routeFunctions": [],
    "configureFunctions": {},
    "beforeFunctions": [],
    "afterFunctions": [],
    "viewEngine": "handlebars",
    "virtualHost": {
        "enabled": false // true
    },
    "wcm": {
        "enabled": false // true
    },
    "serverTags": {
        "enabled": false // true
    },
    "insight": {
        "enabled": false // true
    },
    "perf": {
        "enabled": false // true
    },
    "virtualDriver": {
        "enabled": false
    },
    "flow": {
        "enabled": false
    },
    "auth": {
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
};

// default to using long polling?
// can assist for environments using non-sticky load balancer
// SETTINGS.socketTransports = ["xhr-polling"];
//SETTINGS.socketTransports= ["xhr-polling", "jsonp-polling"];
SETTINGS.socketTransports = [];

var exports = module.exports;

/**
 * Sets a configuration key/value.
 *
 * @param key
 * @param value
 */
exports.set = function(key, value)
{
    SETTINGS[key] = value;
};

/**
 * Gets a configuration key/value.
 *
 * @param key
 * @return {*}
 */
exports.get = function(key)
{
    return SETTINGS[key];
};

/**
 * Registers an express configuration function for a specific environment.
 *
 * @param env
 * @param fn
 */
exports.configure = function(env, fn)
{
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
exports.sockets = function(fn)
{
    SETTINGS.socketFunctions.push(fn);
};

/**
 * Registers a route configuration function.
 *
 * @param fn
 */
exports.routes = function(fn)
{
    SETTINGS.routeFunctions.push(fn);
};

/**
 * Registers a function to run before the server starts.
 *
 * @param fn
 */
var before = exports.before = function(fn)
{
    SETTINGS.beforeFunctions.push(fn);
};

/**
 * Registers a function to run after the server starts.
 *
 * @param fn
 */
var after = exports.after = function(fn)
{
    SETTINGS.afterFunctions.push(fn);
};

/**
 * Starts the Cloud CMS server.
 *
 * @param overrides optional config overrides
 * @param callback optional callback function
 */
exports.start = function(overrides, callback)
{
    if (typeof(overrides) === "function")
    {
        callback = overrides;
        overrides = null;
    }

    // create our master config
    var config = clone(SETTINGS);
    if (overrides) {
        config = xtend(config, overrides);
    }

    // store config on process instance
    process.configuration = config;

    // some config overrides can come in through process.configuration
    if (process.configuration)
    {
        if (process.configuration.virtualHost && process.configuration.virtualHost.domain)
        {
            if (!process.env.CLOUDCMS_DOMAIN)
            {
                process.env.CLOUDCMS_DOMAIN = process.configuration.virtualHost.domain;
            }
        }
    }
    if (process.env.CLOUDCMS_DOMAIN)
    {
        process.env.CLOUDCMS_DOMAIN = process.env.CLOUDCMS_DOMAIN.toLowerCase();
        console.log("Configured for domain: " + process.env.CLOUDCMS_DOMAIN);
    }

    /*
    // memwatch
    if (config.memwatch)
    {
        var memwatch = require('memwatch');
        memwatch.on('leak', function(info) {
            console.log("[memwatch] ---> POTENTIAL MEMORY LEAK DETECTED <---");
            console.log(JSON.stringify(info, null, "  "));
        });
        memwatch.on('stats', function(stats) {
            console.log("[memwatch] Garbage collection ran, new base = " + stats["estimated_base"]);
        });
        app.memwatch = memwatch;
        console.log("[memwatch] Started");
    }
    */


    //console.log("");
    //console.log("Starting " + config.name);
    //console.log("Settings: " + JSON.stringify(config, null, "   "));

    app.enable('strict routing');

    ////////////////////////////////////////////////////////////////////////////
    //
    // VIRTUAL SUPPORT
    //
    // Configure NodeJS to load virtual driver and configure for virtual descriptors
    // ahead of anything else running.
    //
    ////////////////////////////////////////////////////////////////////////////

    // all environments
    var all = true;
    if (all)
    {
        // custom morgan logger
        morgan(function(tokens, req, res) {

            var status = res.statusCode;
            var len = parseInt(res.getHeader('Content-Length'), 10);
            var host = req.virtualHost;
            if (!host)
            {
                host = req.hostname;
            }
            len = isNaN(len) ? '0b' : len = bytes(len);

            var d = new Date();
            var dateString = d.toDateString();
            var timeString = d.toTimeString();

            // gray color
            var grayColor = "\x1b[90m";

            // status color
            var color = 32;
            if (status >= 500) color = 31
            else if (status >= 400) color = 33
            else if (status >= 300) color = 36;
            var statusColor = "\x1b[" + color + "m"

            // final color
            var finalColor = "\x1b[0m";

            if (process.env.CLOUDCMS_APPSERVER_MODE == "production")
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

        // add req.id  re
        app.use(function(req, res, next) {
            requestCounter++;
            req.id = requestCounter;
            next();
        });

        app.use(function(req, res, next) {
            req.originalUrl = req.url;
            next();
        });

        // add req.log function
        app.use(function(req, res, next) {

            req.log = function(text)
            {
                var host = req.virtualHost;
                if (!host)
                {
                    host = req.hostname;
                }

                var d = new Date();
                var dateString = d.toDateString();
                var timeString = d.toTimeString();

                // gray color
                var grayColor = "\x1b[90m";

                // final color
                var finalColor = "\x1b[0m";

                if (process.env.CLOUDCMS_APPSERVER_MODE == "production")
                {
                    grayColor = "";
                    finalColor = "";
                }

                var message = '';
                message += grayColor + '<' + req.id + '> ';
                message += grayColor + '[' + dateString + ' ' + timeString + '] ';
                message += grayColor + host + ' ';
                //message += grayColor + '(' + req.ip + ') ';
                message += grayColor + text + '';
                message += finalColor;

                console.log(message);
            };

            req._log = req.log;

            next();
        });

        // initial log
        app.use(function(req, res, next) {
            req.log("Start of request: " + req.url);
            next();
        });

        // set up CORS allowances
        // this lets CORS requests float through the proxy
        app.use(main.ensureCORSCrossDomain());

        // common interceptors and config
        main.common(app, config);

        // virtual configuration interceptors
        main.virtual(app, config);

        // proxy
        // anything that goes to /proxy is handled here early and nothing processes afterwards
        app.use(proxy());

        // welcome files
        main.welcome(app, config);

        // RUNTIME PERFORMANCE FRONT END
        app.use(perf(config).cacheHeaderInterceptor());

        // standard body parsing + a special cloud cms body parser that makes a last ditch effort for anything
        // that might be JSON (regardless of content type)
        app.use(function(req, res, next) {

            multipart()(req, res, function(err) {
                bodyParser.json()(req, res, function(err) {
                    bodyParser.urlencoded({
                        extended: true
                    })(req, res, function(err) {
                        main.bodyParser()(req, res, function(err) {
                            next(err);
                        });
                    });
                });
            });

        });

        // driver interceptor
        main.driver(app, config);
    }






    ////////////////////////////////////////////////////////////////////////////
    //
    // BASE CONFIGURATION
    //
    // Configures NodeJS app server using dustjs templating engine
    // Runs on port 2999 by default
    //
    ////////////////////////////////////////////////////////////////////////////

    // all environments
    if (all)
    {
        app.set('port', process.env.PORT || 2999);
        app.set('views', process.env.CLOUDCMS_APPSERVER_PUBLIC_PATH + "/../views");

        if (config.viewEngine == "dust")
        {
            app.set('view engine', 'html');
            var cons = require('consolidate');
            app.engine('html', cons.dust);
        }
        else if (config.viewEngine == "jade")
        {
            app.set('view engine', 'jade');
        }
        else if (config.viewEngine == "handlebars" || config.viewEngine == "hbs")
        {
            app.set('view engine', 'html');
            var hbs = require('hbs');
            app.engine('html', hbs.__express);
        }

        //app.use(express.favicon(process.env.CLOUDCMS_APPSERVER_PUBLIC_PATH + "/favicon.ico"));

        app.use(cookieParser("secret"));
        app.use(methodOverride());
        //app.use(express.session({ secret: 'secret', store: sessionStore }));
        app.use(session({
            secret: 'secret',
            resave: false,
            saveUninitialized: false
        }));

        // configure cloudcms app server command handing
        main.interceptors(app, true, config);

        //app.use(app.router);
        app.use(errorHandler());

        // CUSTOM ROUTES
        for (var i = 0; i < config.routeFunctions.length; i++)
        {
            config.routeFunctions[i](app, config);
        }

        // configure cloudcms app server handlers
        main.handlers(app, true, config);
    }



    ////////////////////////////////////////////////////////////////////////////
    //
    // CUSTOM EXPRESS APP CONFIGURE METHODS
    //
    ////////////////////////////////////////////////////////////////////////////
    for (var env in config.configureFunctions)
    {
        var functions = config.configureFunctions[env];
        if (functions)
        {
            for (var i = 0; i < functions.length; i++)
            {
                functions[i](app);
            }
        }
    }





    ////////////////////////////////////////////////////////////////////////////
    //
    // INITIALIZE THE SERVER
    //
    ////////////////////////////////////////////////////////////////////////////

    // CORE OBJECTS
    var server = http.createServer(app);
    server.setTimeout(30000); // 30 seconds
    server.on("connection", function(socket) {
        socket.setNoDelay(true);
    });
    var io = require("socket.io").listen(server);
    process.IO = io;

    // SET INITIAL VALUE FOR SERVER TIMESTAMP
    process.env.CLOUDCMS_APPSERVER_TIMESTAMP = new Date().getTime();

    // BEFORE SERVER START
    async.series(config.beforeFunctions, [app], function(err) {

        // START THE APPLICATION SERVER
        server.listen(app.get('port'), function(){

            // AFTER SERVER START
            async.series(config.afterFunctions, [app], function(err) {

                // show standard info
                var url = "http://localhost:" + app.get('port') + "/";

                console.log(config.name + " started");
                console.log(" -> visit: " + url);
                console.log("");

                if (callback)
                {
                    callback(app);
                }

            });
        });

    });


    // INIT SOCKET.IO
    //io.set('log level', 1);
    if (config.socketTransports && config.socketTransports.length > 0)
    {
        process.IO.set('transports', config.socketTransports);
    }
    /*
    if (config.socketLogLevel) {
        io.set('log level', config.socketLogLevel);
    }
    */
    io.sockets.on("connection", function(socket) {

        // attach _log function
        if (!socket._log)
        {
            socket._log = function(text)
            {
                var host = socket.host;

                var d = new Date();
                var dateString = d.toDateString();
                var timeString = d.toTimeString();

                // gray color
                var grayColor = "\x1b[90m";

                // final color
                var finalColor = "\x1b[0m";

                if (process.env.CLOUDCMS_APPSERVER_MODE == "production")
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
        }

        socket.on("connect", function() {
            //console.log("SOCKET.IO HEARD CONNECT");
        });

        socket.on("disconnect", function() {
            //console.log("SOCKET.IO HEARD DISCONNECT");
        });

        // CUSTOM CONFIGURE SOCKET.IO
        for (var i = 0; i < config.socketFunctions.length; i++)
        {
            config.socketFunctions[i](socket);
        }

        // INSIGHT SERVER
        if (config.insight && config.insight.enabled)
        {
            require("../insight/insight").init(socket);
        }

    });
};



////////////////////////////////////////////////////////////////////////////
//
// DEFAULT HANDLERS
//
////////////////////////////////////////////////////////////////////////////

// default before function
before(function(app, callback) {
    callback();
});

// default after function
after(function(app, callback) {
    callback();
});

