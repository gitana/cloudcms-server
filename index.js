var path = require('path');
var fs = require('fs');
var temp = require('temp');
var url = require('url');

var async = require("async");

var util = require("./util/util");

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

    // root ssl ca's
    require('ssl-root-cas').inject();

    // middleware
    var authentication = require("./middleware/authentication/authentication");
    var authorization = require("./middleware/authorization/authorization");
    var cache = require("./middleware/cache/cache");
    var cloudcms = require("./middleware/cloudcms/cloudcms");
    var config = require("./middleware/config/config");
    var deployment = require("./middleware/deployment/deployment");
    var driver = require("./middleware/driver/driver");
    var driverConfig = require("./middleware/driver-config/driver-config");
    var final = require("./middleware/final/final");
    var flow = require("./middleware/flow/flow");
    //var hashlessRouting = require("./middleware/hashless-routing/hashless-routing");
    var host = require("./middleware/host/host");
    var libraries = require("./middleware/libraries/libraries");
    var local = require("./middleware/local/local");
    var locale = require("./middleware/locale/locale");
    var perf = require("./middleware/perf/perf");
    var proxy = require("./middleware/proxy/proxy");
    var serverTags = require("./middleware/server-tags/server-tags");
    var storeService = require("./middleware/stores/stores");
    var templates = require("./middleware/templates/templates");
    var virtualConfig = require("./middleware/virtual-config/virtual-config");
    var virtualFiles = require("./middleware/virtual-files/virtual-files");
    var wcm = require("./middleware/wcm/wcm");
    var welcome = require("./middleware/welcome/welcome");

    // services
    var notifications = require("./notifications/notifications");
    var broadcast = require("./broadcast/broadcast");

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

        var fns = [
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
        app.use(driver.driverInterceptor());

        // puts req.descriptor into the request and req.virtualFiles = true
        app.use(virtualFiles.interceptor());
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
                        callback(null, configuration);
                        return;
                    }

                    if (!name)
                    {
                        callback(null, configuration);
                    }
                    else
                    {
                        var c = configuration[name];
                        if (!c) {
                            c = {};
                        }

                        callback(null, c);
                    }
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
                        if (!applicationConfiguration) {
                            applicationConfiguration = {};
                        }

                        // merge configs
                        util.merge(applicationConfiguration, configuration);

                        finish();
                    }
                    else
                    {
                        finish();
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

    r.interceptors = function(app, includeCloudCMS)
    {
        var configuration = app.configuration;

        if (includeCloudCMS)
        {
            // bind a cache helper
            app.use(cache.cacheInterceptor());

            // auto-select which gitana repository to use
            app.use(cloudcms.repositoryInterceptor());

            // auto-select which gitana branch to use
            // allows for branch specification via request parameter
            app.use(cloudcms.branchInterceptor());

            // auto-select which gitana domain to use
            app.use(cloudcms.domainInterceptor());

            // auto-select the application
            app.use(cloudcms.applicationInterceptor());

            // enables ICE menu
            // app.use(cloudcms.iceInterceptor());
        }

        // authorization interceptor
        app.use(authorization.authorizationInterceptor());

        // tag processing, injection of scripts, etc, kind of a catch all at the moment
        app.use(serverTags.interceptor(configuration));
    };

    r.handlers = function(app, includeCloudCMS)
    {
        // handles deploy/undeploy commands
        app.use(deployment.handler());

        // handles calls to the configuration service
        app.use(config.handler());

        // handles calls to the templates service
        app.use(templates.handler());

        // handles thirdparty browser libraries that are included with cloudcms-server
        app.use(libraries.handler());

        // authentication
        app.use(authentication.handler(app));

        if (includeCloudCMS)
        {
            // handles /login and /logout for cloudcms principals
            app.use(cloudcms.authenticationHandler(app));

            // handles virtualized content retrieval from cloud cms
            app.use(cloudcms.virtualNodeHandler());

            // handles virtualized principal retrieval from cloud cms
            app.use(cloudcms.virtualPrincipalHandler());
        }

        // handles calls to web flow controllers
        app.use(flow.handlers());

        // handles virtualized local content retrieval from disk
        app.use(local.webStoreHandler());

        // handles default content retrieval from disk
        app.use(local.defaultHandler());

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

            // use "*" here to accept any origin
            res.set('Access-Control-Allow-Origin', '*');
            res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Authorization');
            // res.set('Access-Control-Allow-Max-Age', 3600);

            if ('OPTIONS' == req.method) {
                return res.send(200);
            }

            next();
        };
    };

    return r;
}();

