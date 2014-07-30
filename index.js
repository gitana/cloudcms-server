var path = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp');

var GITANA_DRIVER_CONFIG_CACHE = require("./cache/driverconfigs");

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
    // TODO: this is to disable really annoying Express 3.0 deprecated's for multipart() which should hopefully
    // TODO: be resolved soon
    console.warn = function() {};

    // this is the root path where hosts, their public files and content caches are stored
    var basePath = process.env.CLOUDCMS_HOSTS_PATH;
    if (!basePath) {
        basePath = process.env.CLOUDCMS_HOSTS_PATH = "/hosts";
    }

    // middleware
    var virtual = require("./middleware/virtual/virtual")(basePath);
    var deployment = require("./middleware/deployment/deployment")(basePath);
    var authorization = require("./middleware/authorization/authorization")(basePath);
    var cloudcms = require("./middleware/cloudcms/cloudcms")(basePath);
    var wcm = require("./middleware/wcm/wcm")(basePath);
    var textout = require("./middleware/textout/textout")(basePath);
    var local = require("./middleware/local/local")(basePath);
    var final = require("./middleware/final/final")(basePath);
    var libraries = require("./middleware/libraries/libraries")(basePath);
    var cache = require("./middleware/cache/cache")(basePath);
    var welcome = require("./middleware/welcome/welcome")(basePath);
    var config = require("./middleware/config")(basePath);
    var flow = require("./middleware/flow/flow")(basePath);
    var authentication = require("./middleware/authentication")(basePath);

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
    if (!process.env.CLOUDCMS_HOSTS_PATH) {
        process.env.CLOUDCMS_HOSTS_PATH = "/hosts";
    }

    // assume app-server base path if none provided
    if (!process.env.CLOUDCMS_APPSERVER_BASE_PATH) {
        process.env.CLOUDCMS_APPSERVER_BASE_PATH = process.cwd();
    }

    if (!process.env.CLOUDCMS_APPSERVER_PUBLIC_PATH) {
        process.env.CLOUDCMS_APPSERVER_PUBLIC_PATH = path.join(process.env.CLOUDCMS_APPSERVER_BASE_PATH, "public");
    }

    // other paths we can pre-establish
    process.env.CLOUDCMS_GITANA_JSON_PATH = path.join(process.env.CLOUDCMS_APPSERVER_BASE_PATH, "gitana.json");
    process.env.CLOUDCMS_CONFIG_BASE_PATH = path.join(process.env.CLOUDCMS_APPSERVER_BASE_PATH, "config");

    // cache
    process.cache = cache;

    // read the package.json file and determine the build timestamp
    var packageJsonPath = path.resolve(__dirname, "package.json");
    if (fs.existsSync(packageJsonPath))
    {
        var packageJson = JSON.parse(fs.readFileSync(packageJsonPath).toString());

        process.env.CLOUDCMS_APPSERVER_PACKAGE_NAME = packageJson.name;
        process.env.CLOUDCMS_APPSERVER_PACKAGE_VERSION = packageJson.version;
    }

    // make sure that the /hosts directory exists if it does not
    if (!fs.existsSync(process.env.CLOUDCMS_HOSTS_PATH))
    {
        console.log("Creating hosts path: " + process.env.CLOUDCMS_HOSTS_PATH);

        mkdirp(process.env.CLOUDCMS_HOSTS_PATH, function() {
            // all done
        });
    }
    console.log("Mounting hosts path: " + process.env.CLOUDCMS_HOSTS_PATH);

    // object that we hand back
    var r = {};

    r.common = function(app, configuration)
    {
        if (!configuration) {
            configuration = {};
        }

        // bind cache
        app.cache = cache;

        app.use(function(req, res, next) {

            var completionFunction = function(err, gitanaJsonPath, gitanaConfig)
            {
                if (err)
                {
                    req.log(err.message);
                    next();
                    return;
                }

                if (gitanaJsonPath && gitanaConfig)
                {
                    // overwrite path to gitana.json file
                    req.gitanaJsonPath = gitanaJsonPath;
                    req.gitanaConfig = gitanaConfig;
                }

                next();
            };

            var cachedValue = GITANA_DRIVER_CONFIG_CACHE.read("local");
            if (cachedValue)
            {
                if (cachedValue == "null")
                {
                    // null means there verifiably isn't anything on disk (null used as sentinel marker)
                    completionFunction();
                }
                else
                {
                    // we have something in cache
                    completionFunction(null, cachedValue.path, cachedValue.config);
                }
            }
            else
            {
                // try to load from disk
                fs.exists(process.env.CLOUDCMS_GITANA_JSON_PATH, function(exists) {

                    if (exists)
                    {
                        fs.readFile(process.env.CLOUDCMS_GITANA_JSON_PATH, function(err, data) {

                            if (err)
                            {
                                completionFunction(err);
                                return;
                            }

                            var gitanaConfig = null;
                            try
                            {
                                gitanaConfig = JSON.parse(data.toString());
                            }
                            catch (e)
                            {
                                console.log("Error reading json file in local driver check: " + process.env.CLOUDCMS_GITANA_JSON_PATH);
                                completionFunction();
                                return;
                            }

                            GITANA_DRIVER_CONFIG_CACHE.write("local", {
                                "path": process.env.CLOUDCMS_GITANA_JSON_PATH,
                                "config": gitanaConfig
                            });

                            completionFunction(null, process.env.CLOUDCMS_GITANA_JSON_PATH, gitanaConfig);
                        });
                    }
                    else
                    {
                        // mark with sentinel
                        GITANA_DRIVER_CONFIG_CACHE.write("local", "null");

                        completionFunction();
                    }
                });
            }
        });
    };

    r.welcome = function(app, configuration)
    {
        // support for "welcome" files (i.e. index.html)
        app.use(welcome.welcomeInterceptor(configuration));
    };

    r.virtual = function(app, configuration)
    {
        // binds virtual interceptors
        virtual.interceptors(app, configuration);
    };

    r.driver = function(app, configuration)
    {
        // binds "req.gitana" into the request for the loaded "req.gitanaConfig"
        app.use(cloudcms.driverInterceptor(configuration));
    };

    r.interceptors = function(app, includeCloudCMS, configuration)
    {
        if (!configuration) {
            configuration = {};
        }

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

            // enables ICE menu
            // app.use(cloudcms.iceInterceptor());
        }

        // textout (tag processing, injection of scripts, etc, kind of a catch all at the moment)
        app.use(textout.interceptor(configuration));
    };

    r.handlers = function(app, includeCloudCMS, configuration)
    {
        if (!configuration) {
            configuration = {};
        }

        // handles deploy/undeploy commands
        app.use(deployment.handler());

        // handles calls to the configuration service
        app.use(config.handler());

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
        app.use(flow.handlers(configuration));

        // handles virtualized local content retrieval from disk
        app.use(local.virtualHandler());

        // handles default content retrieval from disk
        app.use(local.defaultHandler());

        if (includeCloudCMS)
        {
            // handles retrieval of content from wcm
            app.use(wcm.wcmHandler(configuration));
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
    r.ensureCORSCrossDomain = function()
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

