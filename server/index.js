var express = require('express');
var http = require('http');
var https = require('https');
var path = require('path');
var fs = require('fs');
var httpProxy = require('http-proxy');
var clone = require('clone');
var xtend = require('xtend');
var bytes = require('bytes');

var oauth2 = require("../util/oauth2")();

var async = require('../util/async');

var perf = require("../middleware/perf/perf");

var app = express();

// cloudcms app server support
var main = require("../index");

// set up modes
process.env.CLOUDCMS_APPSERVER_MODE = "development";

if (process.env.NODE_ENV == "production")
{
    process.env.CLOUDCMS_APPSERVER_MODE = "production";
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
    "virtualHost": {
        "enabled": true
    },
    "wcm": {
        "enabled": true
    },
    "serverTags": {
        "enabled": true
    },
    "insight": {
        "enabled": true
    },
    "perf": {
        "enabled": true
    },
    "virtualDriver": {
        "enabled": false
    }
};

// default to using long polling?
// can assist for environments using non-sticky load balancer
// SETTINGS.socketTransports = ["xhr-polling"];
SETTINGS.socketTransports= ["xhr-polling", "jsonp-polling"];

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


    ////////////////////////////////////////////////////////////////////////////
    //
    // VIRTUAL SUPPORT
    //
    // Configure NodeJS to load virtual driver and configure for virtual descriptors
    // ahead of anything else running.
    //
    ////////////////////////////////////////////////////////////////////////////
    app.configure(function() {

        //express.logger.format('cloudcms', '[:date] :referrer (:remote-addr) :status :response-time ms ":method :url" :res[content-length]');
        express.logger.format('cloudcms', function(tokens, req, res) {

            var status = res.statusCode;
            var len = parseInt(res.getHeader('Content-Length'), 10);
            var host = req.virtualHost;
            if (!host)
            {
                host = req.host;
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
        app.use(express.logger("cloudcms"));
        //app.use(express.logger("dev"));

        // add req.id  re
        app.use(function(req, res, next) {
            requestCounter++;
            req.id = requestCounter;
            next();
        });

        // add req.log function
        app.use(function(req, res, next) {

            req.log = function(text)
            {
                var host = req.virtualHost;
                if (!host)
                {
                    host = req.host;
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
            req.log("Start of request");
            next();
        });

        app.use(function(req, res, next) {
            req.originalUrl = req.url;
            next();
        });

        // RUNTIME PERFORMANCE FRONT END
        app.use(perf(config).cacheHeaderInterceptor());

        // standard body parsing + a special cloud cms body parser that makes a last ditch effort for anything
        // that might be JSON (regardless of content type)
        app.use(function(req, res, next) {

            if (req.url.indexOf("/proxy") === 0)
            {
                // don't do any payload processing when accessing the proxy
                next();
            }
            else
            {
                express.multipart()(req, res, function(err) {
                    express.json()(req, res, function(err) {
                        express.urlencoded()(req, res, function(err) {
                            main.bodyParser()(req, res, function(err) {
                                next(err);
                            });
                        });
                    });
                });
            }

        });

        // common interceptors and config
        main.common(app, config);

        // virtual configuration interceptors
        main.virtual(app, config);

        // driver interceptor
        main.driver(app, config);
    });

    app.use(main.ensureCORSCrossDomain());


    ////////////////////////////////////////////////////////////////////////////
    //
    // HTTP/HTTPS Proxy Server to Cloud CMS
    // Facilitates Cross-Domain communication between Browser and Cloud Server
    // This must appear at the top of the app.js file (ahead of config) for things to work
    //
    ////////////////////////////////////////////////////////////////////////////
    // START PROXY SERVER
    /*
    var Agent = require('agentkeepalive');
    var agent = new Agent({
        maxSockets: 10,
        maxFreeSockets: 10,
        keepAlive: true,
        keepAliveMsecs: 30000 // keepalive for 30 seconds
    });
    */
    var proxyScheme = process.env.GITANA_PROXY_SCHEME;
    var proxyHost = process.env.GITANA_PROXY_HOST;
    var proxyPort = parseInt(process.env.GITANA_PROXY_PORT, 10);

    var target = proxyScheme + "://" + proxyHost + ":" + proxyPort;
    var proxyConfig = {
        "target": target,
        "agent": false,
        "xfwd": true
    };
    if (proxyScheme.toLowerCase() == "https")
    {
        /*
//        proxyConfig.secure = true;
        */
        //https.globalAgent.options.secureProtocol = 'SSLv3_method';
        //proxyConfig.agent = https.globalAgent;

        // TODO: why does https://api.cloudcms.com throw "Hostname/IP doesn't match certificate's altname"
        // temporary workaround
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

        // keep-alive agent
        proxyConfig.agent = new https.Agent({
            maxSockets: 100,
            maxFreeSockets: 100,
            keepAlive: true,
            keepAliveMsecs: 30000
        });

    }
    if (proxyScheme.toLowerCase() == "http")
    {
        // keep-alive agent
        proxyConfig.agent = new http.Agent({
            maxSockets: 100,
            maxFreeSockets: 100,
            keepAlive: true,
            keepAliveMsecs: 30000
        });
        //proxyConfig.agent = http.globalAgent;
    }
    // ten minute timeout
    // proxyConfig.timeout = 10 * 60 * 1000;
    var proxyServer = new httpProxy.createProxyServer(proxyConfig);
    proxyServer.on("error", function(err, req, res) {
        console.log(err);
        res.writeHead(500, {
            'Content-Type': 'text/plain'
        });

        res.end('Something went wrong while proxying the request.');
    });
    proxyServer.on('proxyRes', function (res) {
        //console.log('RAW Response from the target', JSON.stringify(res.headers, true, 2));
    });
    app.use("/proxy", http.createServer(function(req, res) {

        // make sure request socket is optimized for speed
        req.socket.setNoDelay(true);
        req.socket.setTimeout(0);
        req.socket.setKeepAlive(true, 0);

        // used to auto-assign the client header for /oauth/token requests
        oauth2.autoProxy(req);

        var updateSetCookieHost = function(value)
        {
            var newDomain = req.host;
            if (req.virtualHost) {
                newDomain = req.virtualHost;
            }
            // TODO: why was this needed?  CNAME wip
            /*
            if (req.headers["x-forwarded-host"]) {
                newDomain = req.headers["x-forwarded-host"];
            }
            */

            /*

             / NOTE
             // req.host = cloudcms-oneteam-env-58pc8mdwgg.elasticbeanstalk.com
             // req.virtualHost = tre624b7.cloudcms.net
             // req.headers["x-forwarded-host"] = terramaradmin.solocal.mobi, tre624b7.cloud$
             // req.headers["referer"] = http://terramaradmin.solocal.mobi/

            */

            //
            // if the incoming request is coming off of a CNAME entry that is maintained elsewhere (and they're just
            // forwarding the CNAME request to our machine), then we try to detect this...
            //
            // our algorithm here is pretty weak but suffices for the moment.
            // if the req.headers["x-forwarded-host"] first entry is in the req.headers["referer"] then we consider
            // things to have been CNAME forwarded
            // and so we write cookies back to the req.headers["x-forwarded-host"] first entry domain
            //

            var xForwardedHost = req.headers["x-forwarded-host"];
            if (xForwardedHost)
            {
                xForwardedHost = xForwardedHost.split(",");
                if (xForwardedHost.length > 0)
                {
                    var cnameCandidate = xForwardedHost[0];

                    var referer = req.headers["referer"];
                    if (referer && referer.indexOf("://" + cnameCandidate) > -1)
                    {
                        req.log("Detected CNAME: " + cnameCandidate);

                        newDomain = cnameCandidate;
                    }
                }
            }



            // now proceed


            var i = value.indexOf("Domain=");
            if (i > -1)
            {
                var j = value.indexOf(";", i);
                if (j > -1)
                {
                    value = value.substring(0, i+7) + newDomain + value.substring(j);
                }
                else
                {
                    value = value.substring(0, i+7) + newDomain;
                }
            }

            return value;
        };

        var _setHeader = res.setHeader;
        res.setHeader = function(key, value)
        {
            if (key.toLowerCase() == "set-cookie")
            {
                for (var x in value)
                {
                    value[x] = updateSetCookieHost(value[x]);
                }
            }

            _setHeader.call(this, key, value);
        };

        proxyServer.web(req, res, proxyConfig);
    }));
    // END PROXY SERVER



    ////////////////////////////////////////////////////////////////////////////
    //
    // BASE CONFIGURATION
    //
    // Configures NodeJS app server using dustjs templating engine
    // Runs on port 2999 by default
    //
    ////////////////////////////////////////////////////////////////////////////
    app.configure(function(){

        app.set('port', process.env.PORT || 2999);
        app.set('views', process.env.CLOUDCMS_APPSERVER_PUBLIC_PATH + "/../views");
        app.set('view engine', 'html'); // html file extension

        //var dust = require('dustjs-linkedin');
        var cons = require('consolidate');
        app.engine('html', cons.dust);

        //app.use(express.favicon(process.env.CLOUDCMS_APPSERVER_PUBLIC_PATH + "/favicon.ico"));

        //app.use(express.cookieParser());
        //app.use(express.cookieParser("secret"));

        app.use(express.methodOverride());
        //app.use(express.session({ secret: 'secret', store: sessionStore }));

        // configure cloudcms app server command handing
        main.interceptors(app, true, config);

        app.use(app.router);
        app.use(express.errorHandler());

        // configure cloudcms app server handlers
        main.handlers(app, true, config);

    });



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
                app.configure(env, functions[i]);
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

    // CUSTOM ROUTES
    for (var i = 0; i < config.routeFunctions.length; i++)
    {
        config.routeFunctions[i](app);
    }

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
    io.set('log level', 1);
    if (config.socketTransports && config.socketTransports.length > 0)
    {
        process.IO.set('transports', config.socketTransports);
    }
    if (config.socketLogLevel) {
        io.set('log level', config.socketLogLevel);
    }
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

