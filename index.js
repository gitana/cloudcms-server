var path = require('path');
var fs = require('fs');
var temp = require('temp');
var url = require('url');

var async = require("async");

var util = require("./util/util");

var http = require('http');
var https = require('https');

// ensure proper global agent properties
/*
http.globalAgent = new http.Agent({
    maxSockets: Infinity,
    maxFreeSockets: 256,
    keepAlive: true,
    keepAliveMsecs: 5000,
    rejectUnauthorized: false
});
https.globalAgent = new https.Agent({
    maxSockets: Infinity,
    maxFreeSockets: 256,
    keepAlive: true,
    keepAliveMsecs: 5000,
    rejectUnauthorized: false
});
*/

var KeepAliveAgent = require('agentkeepalive');
http.globalAgent = new KeepAliveAgent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    keepAliveTimeout: 30000,
    timeout: 60000,
    maxSockets: 200,
    maxFreeSockets: 40
});
https.globalAgent = new KeepAliveAgent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    keepAliveTimeout: 30000,
    timeout: 60000,
    maxSockets: 200,
    maxFreeSockets: 40
});

// report http/https socket state every minute
var socketReportFn = function()
{
    setTimeout(function() {

        var http = require("http");
        var https = require("https");

        console.log("--- START SOCKET REPORT ---");
        console.log("[http]: " + JSON.stringify(http.globalAgent.getCurrentStatus(), null, "  "));
        console.log("[https]:" + JSON.stringify(https.globalAgent.getCurrentStatus(), null, "  "));
        console.log("--- END SOCKET REPORT ---");

        socketReportFn();

    }, 60 * 1000);
};
socketReportFn();


// root ssl ca's
require("ssl-root-cas").inject();

/**
 * Supports the following directory structure:
 *
 *
 *   /hosts
 *
 *      /<host>
 *
 *         /public
              index.html
 *
 *         /content
 *            /local
 *               /en_us
 *                  image.jpg
 *
 *            /cloudcms
 *               /<branchId>
 *                  /en_us
 *                     image.jpg
 *
 * @type {exports}
 */
exports = module.exports = function()
{
    // track temporary files
    temp.track();

    // TODO: this is to disable really annoying Express 3.0 deprecated's for multipart() which should hopefully
    // TODO: be resolved soon
    console.warn = function() {};

    // init
    if (!process.env.GITANA_PROXY_HOST) {
        process.env.GITANA_PROXY_HOST = "api.cloudcms.com";
    }
    if (!process.env.GITANA_PROXY_PORT) {
        process.env.GITANA_PROXY_PORT = 443;
    }
    if (!process.env.GITANA_PROXY_SCHEME) {
        process.env.GITANA_PROXY_SCHEME = "https";
    }

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    // all web modules are included by default
    if (!process.includeWebModule) {
        process.includeWebModule = function(host, moduleId) {
            return true;
        };
    }

    // middleware
    var admin = require("./middleware/admin/admin");
    var authentication = require("./middleware/authentication/authentication");
    var authorization = require("./middleware/authorization/authorization");
    var cache = require("./middleware/cache/cache");
    var cloudcms = require("./middleware/cloudcms/cloudcms");
    var config = require("./middleware/config/config");
    var debug = require("./middleware/debug/debug");
    var deployment = require("./middleware/deployment/deployment");
    var driver = require("./middleware/driver/driver");
    var driverConfig = require("./middleware/driver-config/driver-config");
    var final = require("./middleware/final/final");
    var flow = require("./middleware/flow/flow");
    var form = require("./middleware/form/form");
    var healthcheck = require("./middleware/healthcheck/healthcheck");
    var host = require("./middleware/host/host");
    var libraries = require("./middleware/libraries/libraries");
    var local = require("./middleware/local/local");
    var locale = require("./middleware/locale/locale");
    var modules = require("./middleware/modules/modules");
    var perf = require("./middleware/perf/perf");
    var proxy = require("./middleware/proxy/proxy");
    var registration = require("./middleware/registration/registration");
    var runtime = require("./middleware/runtime/runtime");
    var serverTags = require("./middleware/server-tags/server-tags");
    var storeService = require("./middleware/stores/stores");
    var templates = require("./middleware/templates/templates");
    var virtualConfig = require("./middleware/virtual-config/virtual-config");
    var virtualFiles = require("./middleware/virtual-files/virtual-files");
    var wcm = require("./middleware/wcm/wcm");
    var welcome = require("./middleware/welcome/welcome");
    var userAgent = require('express-useragent');

    // services
    var notifications = require("./notifications/notifications");
    var broadcast = require("./broadcast/broadcast");
    var locks = require("./locks/locks");

    // assume app-server base path if none provided
    if (!process.env.CLOUDCMS_APPSERVER_BASE_PATH) {
        process.env.CLOUDCMS_APPSERVER_BASE_PATH = process.cwd();
    }

    // cache
    //process.cache = cache;

    // read the package.json file and determine the build timestamp
    var packageJsonPath = path.resolve(__dirname, "package.json");
    if (fs.existsSync(packageJsonPath))
    {
        var packageJson = JSON.parse(fs.readFileSync(packageJsonPath).toString());

        process.env.CLOUDCMS_APPSERVER_PACKAGE_NAME = packageJson.name;
        process.env.CLOUDCMS_APPSERVER_PACKAGE_VERSION = packageJson.version;
    }

    // object that we hand back
    var r = {};

    r.init = function(callback)
    {
        process.cache = cache;
        process.broadcast = broadcast;
        process.locks = locks;

        var fns = [
            locks.init,
            broadcast.start,
            storeService.init,
            notifications.start,
            cache.init
        ];
        async.series(fns, function(err) {
            callback(err);
        });
    };

    r.common1 = function(app)
    {
        // app config interceptor
        applyApplicationConfiguration(app);

        // bind cache
        app.cache = process.cache;

        // sets locale onto the request
        app.use(locale.localeInterceptor());

        // sets host onto the request
        app.use(host.hostInterceptor());
    };

    r.common2 = function(app)
    {
        // bind stores into the request
        app.use(storeService.storesInterceptor());

        // if virtual hosting is enabled, loads "gitana.json" from cloud cms and places it into rootStore
        // for convenience, also populates req.gitanaConfig
        app.use(virtualConfig.interceptor());

        // general method for finding "gitana.json" in root store and populating req.gitanaConfig
        app.use(driverConfig.interceptor());

        // binds "req.gitana" into the request for the loaded "req.gitanaConfig"
        app.use(driver.driverInterceptor());// THIS TAKES A LONG TIME

        // puts req.descriptor into the request and req.virtualFiles = true
        app.use(virtualFiles.interceptor());

        // puts req.runtime into the request
        app.use(runtime.interceptor());
    };

    r.perf1 = function(app)
    {
        app.use(perf.pathPerformanceInterceptor());
    };

    r.proxy = function(app)
    {
        app.use(proxy.proxy());
    };

    r.perf2 = function(app)
    {
        app.use(perf.mimeTypePerformanceInterceptor());
    };

    var applyApplicationConfiguration = r.applyApplicationConfiguration = function(app)
    {
        // binds req.config describing the proper app config to use for the request's current application
        app.use(function(req, res, next) {

            var finish = function(configuration)
            {
                req.configuration = function(name, callback)
                {
                    if (typeof(name) === "function")
                    {
                        return callback(null, configuration);
                    }

                    if (!name)
                    {
                        return callback();
                    }

                    callback(null, configuration[name]);
                };

                req.isEnabled = function(name)
                {
                    return (configuration && configuration[name] && configuration[name].enabled);
                };

                next();
            };

            var configuration = JSON.parse(JSON.stringify(process.configuration));

            if (req.application)
            {
                req.application(function(err, application) {

                    if (application)
                    {
                        var applicationConfiguration = application.runtime;
                        if (applicationConfiguration)
                        {
                            // merge configs
                            util.merge(applicationConfiguration, configuration);
                        }

                        finish(configuration);
                    }
                    else
                    {
                        finish(configuration);
                    }

                });
            }
            else
            {
                finish(configuration);
            }
        });
    };

    r.welcome = function(app)
    {
        // support for "welcome" files (i.e. index.html)
        app.use(welcome.welcomeInterceptor());
    };

    r.healthcheck = function(app)
    {
        // support for healthcheck urls
        app.use(healthcheck.handler());
    };

    r.interceptors = function(app, includeCloudCMS)
    {
        var configuration = app.configuration;

        if (includeCloudCMS)
        {
            // bind a cache helper
            app.use(cache.cacheInterceptor());

            // auto-select the application
            app.use(cloudcms.applicationInterceptor());

            // auto-select which gitana repository to use
            app.use(cloudcms.repositoryInterceptor());

            // auto-select which gitana branch to use
            // allows for branch specification via request parameter
            app.use(cloudcms.branchInterceptor());

            // auto-select which gitana domain to use
            app.use(cloudcms.domainInterceptor());

            // enables ICE menu
            // app.use(cloudcms.iceInterceptor());

            // enables cms logging
            app.use(cloudcms.cmsLogInterceptor());
        }

        // authentication interceptor
        app.use(authentication.authenticationInterceptor(app));

        // authorization interceptor
        app.use(authorization.authorizationInterceptor());

        // supports lookup of remote UI Config by user id + project
        app.use(config.userRemoteConfigInterceptor());

        // supports user-configured dynamic configuration
        app.use(config.remoteConfigInterceptor());

        // tag processing, injection of scripts, etc, kind of a catch all at the moment
        app.use(serverTags.interceptor(configuration));

        if (includeCloudCMS)
        {
            // handles retrieval of content from wcm
            app.use(wcm.wcmInterceptor());
        }
    };

    r.handlers = function(app, includeCloudCMS)
    {
        if (includeCloudCMS)
        {
            // handles /login and /logout for cloudcms principals
            app.use(cloudcms.authenticationHandler(app));
        }

        // handles admin commands
        app.use(admin.handler());

        // handles debug commands
        app.use(debug.handler());

        // handles deploy/undeploy commands
        app.use(deployment.handler());

        // serve back static configuration
        app.use(config.staticConfigHandler());

        // serve back dynamic configuration
        app.use(config.remoteConfigHandler());

        // handles calls to the templates service
        app.use(templates.handler());

        // handles calls to the modules service
        app.use(modules.handler());

        // handles thirdparty browser libraries that are included with cloudcms-server
        app.use(libraries.handler());

        // authentication
        app.use(authentication.handler(app));

        if (includeCloudCMS)
        {
            // handles virtualized content retrieval from cloud cms
            app.use(cloudcms.virtualNodeHandler());

            // handles virtualized principal retrieval from cloud cms
            app.use(cloudcms.virtualPrincipalHandler());
        }

        // registration
        app.use(registration.handler());

        // handles calls to web flow controllers
        app.use(flow.handlers());

        // handles calls to form controllers
        app.use(form.formHandler());

        // handles runtime status calls
        app.use(runtime.handler());

        // handles virtualized local content retrieval from disk
        app.use(local.webStoreHandler());

        // handles default content retrieval from disk
        app.use(local.defaultHandler());

        // add User-Agent device info to req
        app.use(userAgent.express());

        if (includeCloudCMS)
        {
            // handles retrieval of content from wcm
            app.use(wcm.wcmHandler());
        }

        // handles 404
        app.use(final.finalHandler());
    };

    r.bodyParser = function()
    {
        return function(req, res, next)
        {
            if (req._body)
            {
                return next();
            }

            var contentType = req.get("Content-Type");
            //if (contentType == "application/json" && req.method.toLowerCase() == "post") {
            if (req.method.toLowerCase() == "post") {

                req._body = true;

                var responseString = "";

                req.on('data', function(data) {
                    responseString += data;
                });

                req.on('end', function() {

                    if (responseString.length > 0) {

                        try {
                            var b = JSON.parse(responseString);
                            if (b)
                            {
                                req.body = b;
                            }
                        } catch (e) { }
                    }

                    next();
                });
            }
            else
            {
                next();
            }
        };
    };

    /**
     * Ensures that headers are set to enable CORS cross-domain functionality.
     *
     * @returns {Function}
     */
    r.ensureCORS = function()
    {
        return function(req, res, next) {

            var origin = req.get("Origin");
            if (!origin)
            {
                origin = req.get("origin");
            }

            if (!origin) {
                return next();
            }

            res.set('Access-Control-Allow-Origin', origin);
            res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.set('Access-Control-Allow-Headers', 'X-Forwarded-Host, X-Requested-With, Content-Type, Authorization, Origin, X-Requested-With, X-Prototype-Version, Cache-Control, Pragma, X-CSRF-TOKEN, X-XSRF-TOKEN');
            res.set('Access-Control-Allow-Credentials', 'true');
            // res.set('Access-Control-Allow-Max-Age', 3600);

            if ('OPTIONS' === req.method) {
                return res.sendStatus(200);
            }

            next();
        };
    };

    r.ensureHeaders = function()
    {
        return function(req, res, next) {

            // defaults
            var xFrameOptions = "SAMEORIGIN";
            var xXssProtection = "1; mode=block";

            // if the request comes from *.cloudcms.net then assume more lenient settings
            var referer = req.headers["referer"];
            if (referer)
            {
                if (referer.indexOf(".cloudcms.net") > -1)
                {
                    xFrameOptions = null;
                }
            }

            if (xFrameOptions)
            {
                util.setHeaderOnce(res, "X-Frame-Options", xFrameOptions);
            }

            if (xXssProtection)
            {
                util.setHeaderOnce(res, "X-XSS-Protection", xXssProtection)
            }

            util.setHeaderOnce(res, "X-Powered-By", "Cloud CMS");

            next();
        };
    };

    var stringifyError = function(err)
    {
        var stack = err.stack;

        if (stack) {
            return String(stack)
        }

        return JSON.stringify(err, null, "  ");
    };


    r.consoleErrorLogger = function(app, callback)
    {
        // generic logger to console
        app.use(function(err, req, res, next) {

            console.error(stringifyError(err));

            next(err);
        });

        callback();
    };

    var errorHandler = require("errorhandler");

    r.refreshTokenErrorHandler = function(app, callback)
    {
        app.use(function(err, req, res, next) {

            if (err)
            {
                if (req.method.toLowerCase() === "get")
                {
                    if (err.status === 401)
                    {
                        if (err.message)
                        {
                            if (err.message.toLowerCase().indexOf("expired") > -1)
                            {
                                if (err.message.toLowerCase().indexOf("refresh") > -1)
                                {
                                    var url = req.path;

                                    console.log("Refresh Token Expired, re-requesting resource: " + url);

                                    var html = "";
                                    html += "<html>";
                                    html += "<head>";
                                    html += "<meta http-equiv='refresh' content='1;URL=" + url + "'>";
                                    html += "</head>";
                                    html += "<body>";
                                    html += "</body>";
                                    html += "</html>";

                                    return res.status(200).type("text/html").send(html);
                                }
                            }
                        }
                    }
                }
            }

            next(err);
        });

        callback();
    };

    r.defaultErrorHandler = function(app, callback)
    {
        app.use(function(err, req, res, next) {

            // use the stock error handler
            errorHandler()(err, req, res, next);
        });

        callback();
    };

    // additional methods for Gitana driver
    var Gitana = require("gitana");

    Gitana.Directory.prototype.findUserForProvider = function(providerId, providerUserId, token, refreshToken, tokenSecret, profile, domain, callback)
    {
        var self = this;

        var params = {
            "domainId": domain.getId(),
            "providerId": providerId,
            "providerUserId": providerUserId
        };

        var payload = {};
        if (token)
        {
            payload.token = token;
        }
        if (refreshToken)
        {
            payload.refreshToken = refreshToken;
        }
        if (tokenSecret)
        {
            payload.tokenSecret = tokenSecret;
        }
        if (profile)
        {
            payload.profile = profile;
        }

        payload = {};

        var uriFunction = function()
        {
            return self.getUri() + "/connections/finduser";
        };

        return this.trap(function(err) {
            callback(err);
            return false;
        }).chainPostResponse(this, uriFunction, params, payload).then(function(response) {
            callback(null, response);
        });
    };

    Gitana.Directory.prototype.createUserForProvider = function(providerId, providerUserId, userObject, token, refreshToken, tokenSecret, profile, domain, callback)
    {
        var self = this;

        var params = {
            "domainId": domain.getId(),
            "providerId": providerId,
            "providerUserId": providerUserId
        };

        var payload = {
            "user": userObject,
            "token": token,
            "refreshToken": refreshToken,
            "tokenSecret": tokenSecret,
            "profile": profile
        };

        var uriFunction = function()
        {
            return self.getUri() + "/connections/createuser";
        };

        return this.trap(function(err) {
            callback(err);
            return false;
        }).chainPostResponse(this, uriFunction, params, payload).then(function(response) {
            callback(null, response);
        });
    };

    return r;
}();
