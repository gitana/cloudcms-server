delete process.env.NODE_DEBUG;

var moment = require("moment");
var cluster = require("cluster");
var http = require("http");
var os = require("os");
var numCPUs = os.cpus().length;

// default agents
process.defaultHttpTimeoutMs = 60000;
var HttpKeepAliveAgent = require('agentkeepalive');
http.globalAgent = new HttpKeepAliveAgent({
    keepAlive: true,
    keepAliveMsecs: 5000,
    maxSockets: 16000,
    maxFreeSockets: 256,
    timeout: process.defaultHttpTimeoutMs,
    freeSocketTimeout: 4000
});

require("ssl-root-cas").inject();

var REDIS_URL = "redis://redis.default.svc.cluster.local:6379";

// track temporary files
var temp = require('temp');
const https = require("https");
const {setupMaster} = require("@socket.io/sticky");
temp.track();

var initWorker = function(allDone)
{
    var initSession = function (initDone) {
        var sessionSecret = "secret";
        var sessionConfig = {
            secret: sessionSecret,
            resave: false,
            saveUninitialized: false
        };
        
        const connectRedis = require('connect-redis');
        var session = require('express-session');
        var RedisStore = connectRedis(session);
        var IORedis = require("ioredis");
        var redisClient = new IORedis(REDIS_URL);
        sessionConfig.store = new RedisStore({client: redisClient});
        initDone(null, session(sessionConfig));
        //
        // var options = {};
        // options.checkPeriod = 86400000; // prune expired entries every 24h
        //
        // // session memory store
        // var MemoryStore = require('memorystore')(session);
        // sessionConfig.store = new MemoryStore(options);
        // initDone(null, session(sessionConfig));
    };
    
    var setHeaderOnce = exports.setHeaderOnce = function (response, name, value) {
        var existing = response.getHeader(name);
        if (typeof (existing) === "undefined") {
            setHeader(response, name, value);
        }
    };
    
    var setHeader = exports.setHeader = function (response, name, value) {
        try {
            response.setHeader(name, value);
        } catch (e) {
        }
    };
    
    var createProxyHandler = function (protocol, hostname, port, pathPrefix) {
        const proxy = require("http2-proxy");
        const finalhandler = require('finalhandler')
        
        const defaultWebHandler = function (err, req, res) {
            if (err) {
                console.log("A web proxy error was caught, path: " + req.path + ", err: ", err);
                try {
                    res.status(500);
                } catch (e) {
                }
                try {
                    res.end('Something went wrong while proxying the request.');
                } catch (e) {
                }
            }
            
            finalhandler(req, res)(err);
        };
        
        // web
        var webConfig = {};
        webConfig.hostname = hostname;
        webConfig.port = port;
        webConfig.protocol = protocol;
        //webConfig.path = null;
        webConfig.timeout = 120000;
        webConfig.proxyTimeout = 120000;
        webConfig.proxyName = "Cloud CMS UI Proxy";
        webConfig.onReq = function (req, options) {
            
            if (!options.headers) {
                options.headers = {};
            }
            var headers = options.headers;
            
            console.log("path: " + options.path);
            
            if (options.path && options.path.startsWith("/proxy")) {
                options.path = options.path.substring(6);
            }
            
            if (pathPrefix) {
                options.path = path.join(pathPrefix, options.path);
            }
            
            // used to auto-assign the client header for /oauth/token requests
            //oauth2.autoProxy(req);
            
            // copy domain host into "x-cloudcms-domainhost"
            if (req.domainHost) {
                headers["x-cloudcms-domainhost"] = req.domainHost; // this could be "localhost"
            }
            
            // copy virtual host into "x-cloudcms-virtualhost"
            if (req.virtualHost) {
                headers["x-cloudcms-virtualhost"] = req.virtualHost; // this could be "root.cloudcms.net" or "abc.cloudcms.net"
            }
            
            // copy deployment descriptor info
            if (req.descriptor) {
                if (req.descriptor.tenant) {
                    if (req.descriptor.tenant.id) {
                        headers["x-cloudcms-tenant-id"] = req.descriptor.tenant.id;
                    }
                    
                    if (req.descriptor.tenant.title) {
                        headers["x-cloudcms-tenant-title"] = req.descriptor.tenant.title;
                    }
                }
                
                if (req.descriptor.application) {
                    if (req.descriptor.application.id) {
                        headers["x-cloudcms-application-id"] = req.descriptor.application.id;
                    }
                    
                    if (req.descriptor.application.title) {
                        headers["x-cloudcms-application-title"] = req.descriptor.application.title;
                    }
                }
            }
            
            // set optional "x-cloudcms-origin" header
            var cloudcmsOrigin = null;
            if (req.virtualHost) {
                cloudcmsOrigin = req.virtualHost;
            }
            if (cloudcmsOrigin) {
                headers["x-cloudcms-origin"] = cloudcmsOrigin;
            }
            
            // set x-cloudcms-server-version header
            //headers["x-cloudcms-server-version"] = process.env.CLOUDCMS_APPSERVER_PACKAGE_VERSION;
            
            // keep alive
            //req.headers["connection"] = "keep-alive";
            
            // if the incoming request didn't have an "Authorization" header
            // and we have a logged in Gitana User via Auth, then set authorization header to Bearer Access Token
            if (!req.headers["authorization"]) {
                if (req.gitana_user) {
                    headers["authorization"] = "Bearer " + req.gitana_user.getDriver().http.accessToken();
                } else if (req.gitana_proxy_access_token) {
                    headers["authorization"] = "Bearer " + req.gitana_proxy_access_token;
                }
            }
        };
        webConfig.onRes = function (req, res, proxyRes) {
            
            var chunks = [];
            
            // triggers on data receive
            proxyRes.on('data', function (chunk) {
                // add received chunk to chunks array
                chunks.push(chunk);
            });
            
            proxyRes.on("end", function () {
                
                if (proxyRes.statusCode === 401) {
                    var text = "" + Buffer.concat(chunks);
                    if (text && (text.indexOf("invalid_token") > -1) || (text.indexOf("invalid_grant") > -1)) {
                        console.log("ah1");
                    }
                }
            });
            
            //res.setHeader('x-powered-by', 'cloudcms');
            res.writeHead(proxyRes.statusCode, proxyRes.headers)
            proxyRes.pipe(res)
        };
        
        var proxyRequestHandler = function (req, res) {
            proxy.web(req, res, webConfig, function (err, req, res) {
                defaultWebHandler(err, req, res);
            });
        };
        
        return proxyRequestHandler;
    };
    
    var express = require('express');
    
    var app = express();
    app.disable('x-powered-by');
    
    var bodyParser = require("body-parser");
    var multipart = require("connect-multiparty");
    var flash = require("connect-flash");
    
    var bodyParserFn = function () {
        return function (req, res, next) {
            if (req._body) {
                return next();
            }
            
            var contentType = req.get("Content-Type");
            //if (contentType == "application/json" && req.method.toLowerCase() == "post") {
            if (req.method.toLowerCase() == "post") {
                
                req._body = true;
                
                var responseString = "";
                
                req.on('data', function (data) {
                    responseString += data;
                });
                
                req.on('end', function () {
                    
                    if (responseString.length > 0) {
                        
                        try {
                            var b = JSON.parse(responseString);
                            if (b) {
                                req.body = b;
                            }
                        } catch (e) {
                        }
                    }
                    
                    next();
                });
            } else {
                next();
            }
        };
    };
    
    initSession(function () {
        
        // middleware
        app.enable('strict routing');
        app.set('port', 3000);
        // custom morgan logger
        var morgan = require("morgan");
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
            } else if (status >= 400) {
                color = 33;
            } else if (status >= 300) {
                color = 36;
            }
            var statusColor = "\x1b[" + color + "m";
            
            // final color
            var finalColor = "\x1b[0m";
            
            if (process.env.CLOUDCMS_APPSERVER_MODE === "production") {
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
        // add req.id
        var requestCounter = 0;
        app.use(function (req, res, next) {
            requestCounter++;
            req.id = requestCounter;
            next();
        });
        // retain originalUrl and originalPath since these can get modified along the way
        app.use(function (req, res, next) {
            req.originalUrl = req.url;
            req.originalPath = req.path;
            next();
        });
        // req.param method
        var requestParam = require("request-param")();
        app.use(requestParam);
        // add req.log function
        app.use(function (req, res, next) {
            
            req._log = req.log = function (text/*, warn*/) {
                
                var host = req.domainHost;
                if (req.virtualHost) {
                    host = req.virtualHost;
                }
                
                var timestamp = moment(new Date()).format("MM/DD/YYYY HH:mm:ss Z");
                var grayColor = "\x1b[90m";
                var finalColor = "\x1b[0m";
                
                // in production, don't use colors
                if (process.env.CLOUDCMS_APPSERVER_MODE === "production") {
                    grayColor = "";
                    finalColor = "";
                }
                
                var message = '';
                message += grayColor + '<' + req.id + '> ';
                if (cluster.worker && cluster.worker.id) {
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
        
        // TODO: SKIP THIS FOR NOW
        // common interceptors and config
        //main.common1(app);
        
        // general logging of requests
        // gather statistics on response time
        var responseTime = require("response-time");
        app.use(responseTime(function (req, res, time) {
            
            var warn = false;
            if (time > 1000) {
                warn = true;
            }
            
            var requestPath = req.originalPath;
            if (requestPath) {
                var filter = false;
                if (requestPath.indexOf("/login") > -1) {
                    filter = true;
                }
                if (requestPath.indexOf("/token") > -1) {
                    filter = true;
                }
                // if (filter)
                // {
                //     requestPath = util.stripQueryStringFromUrl(requestPath);
                // }
            }
            
            req.log(req.method + " " + requestPath + " [" + res.statusCode + "] (" + time.toFixed(2) + " ms)", warn);
        }));
        
        // TODO
        // // set up CORS allowances
        // // this lets CORS requests float through the proxy
        app.use(function (req, res, next) {
            
            var origin = null;
            if (!origin) {
                origin = req.headers["origin"];
            }
            if (!origin) {
                origin = req.headers["x-cloudcms-origin"];
            }
            if (!origin) {
                origin = "*";
            }
            
            // var methods = null
            // var headers = null;
            // var credentials = null;
            
            setHeaderOnce(res, "Access-Control-Allow-Origin", origin);
            
            // if (methods)
            // {
            //     setHeaderOnce(res, "Access-Control-Allow-Methods", methods);
            // }
            //
            // if (headers)
            // {
            //     setHeaderOnce(res, "Access-Control-Allow-Headers", headers);
            // }
            //
            // if (credentials)
            // {
            //     setHeaderOnce(res, "Access-Control-Allow-Credentials", "" + credentials);
            // }
            
            // res.set('Access-Control-Allow-Max-Age', 3600);
            
            if ('OPTIONS' === req.method) {
                return res.sendStatus(200);
            }
            
            next();
        });
        
        //
        // set up default security headers
        app.use(function (req, res, next) {
            
            // defaults
            var xFrameOptions = "SAMEORIGIN";
            var xXssProtection = "1; mode=block";
            
            // TODO: allow overrides here?
            
            if (xFrameOptions) {
                setHeaderOnce(res, "X-Frame-Options", xFrameOptions);
            }
            
            if (xXssProtection) {
                setHeaderOnce(res, "X-XSS-Protection", xXssProtection)
            }
            
            setHeaderOnce(res, "X-Powered-By", "Cloud CMS");
            
            next();
        });
        
        // TODO: SKIP THIS FOR NOW
        // // common interceptors and config
        // main.common2(app);
        
        // TODO: SKIP THIS FOR NOW
        // binds gitana driver into place
        // main.common3(app);
        
        // parse cookies
        var cookieParser = require('cookie-parser');
        app.use(cookieParser());
        
        // TODO: SKIP THIS FOR NOW
        // // cloudcms things need to run here
        // main.common4(app, true);
        
        // TODO
        // PATH BASED PERFORMANCE CACHING
        //main.perf1(app);
        
        var proxyRequestHandler = createProxyHandler("http", "api.default.svc.cluster.local", 80);
        app.use(function (req, res) {
            req.virtualHost = "mt85.us1.cloudcms.net";
            proxyRequestHandler(req, res);
        });
        
        // standard body parsing + a special cloud cms body parser that makes a last ditch effort for anything
        // that might be JSON (regardless of content type)
        app.use(function (req, res, next) {
            
            multipart({})(req, res, function (err) {
                bodyParser.json({})(req, res, function (err) {
                    bodyParser.urlencoded({})(req, res, function (err) {
                        bodyParserFn()(req, res, function (err) {
                            next(err);
                        });
                    });
                });
            });
            
        });
        
        app.use(flash());
    
        // var server = app.listen(3000, function() {
        //     console.log('Process ' + process.pid + ' is listening to all incoming requests');
        // });
        //const server = http.createServer()
        var server = http.Server(app);
    
        // request timeout
        var requestTimeout = 30000; // 30 seconds
        server.setTimeout(requestTimeout);
    
        // socket
        server.on("connection", function (socket) {
            console.log("server connection");
            socket.setNoDelay(true);
        });
        
        // configure socket IO
        const { setupWorker } = require("@socket.io/sticky");
        const { Server } = require("socket.io");
        const { createAdapter } = require("@socket.io/redis-adapter");
        const IORedis = require("ioredis");
    
        var pubClient = new IORedis(REDIS_URL);
        var subClient = pubClient.duplicate();
    
        const io = new Server(server);
        server.io = io;
    
        io.engine.on("connection_error", function(err) {
            // console.log("CONNECTION ERROR");
            // console.log("REQUEST: ", err.req);      // the request object
            // console.log("CODE: " + err.code);     // the error code, for example 1
            // console.log("MESSAGE: ", err.message);  // the error message, for example "Session ID unknown"
            // console.log("CONTEXT: ", err.context);  // some additional error context
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
            socket.on('message', function(m) {
                console.log("Socket Connection message: " + m);
            });
        
            // always catch err
            socket.on("error", function(err) {
                console.log("Caught socket error");
                console.log(err.stack);
            });
        
            // TODO
        });

        allDone(null, server);
    });
}

if (cluster.isMaster)
{
    console.log(`Primary ${process.pid} is starting`);
    
    var server = http.createServer();
    //server.listen(3000);
    
    const { setupMaster } = require("@socket.io/sticky");
    const { setupPrimary } = require("@socket.io/cluster-adapter");
    
    // setup connections between the workers
    setupPrimary();
    
    // needed for packets containing buffers
    cluster.setupMaster({
        serialization: "advanced"
    });
    
    // setup sticky sessions
    setupMaster(server, {
        //loadBalancingMethod: "least-connection"
        loadBalancingMethod: "round-robin"
    });
    
    // Fork workers.
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }
    
    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died`);
    });
    
    console.log(`Primary ${process.pid} is running`);
}
else
{
    initWorker(function(err, server) {
        server.listen(3000);
        console.log(`Worker ${process.pid} started`);
    });
}
