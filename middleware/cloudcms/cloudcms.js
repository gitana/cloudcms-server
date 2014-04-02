var path = require('path');
var fs = require('fs');
var http = require('http');
var util = require("../../util/util");
var localeUtil = require("../../util/locale");
var mkdirp = require('mkdirp');

var Gitana = require("gitana");

var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

var mime = require("mime");

/**
 * Cloud CMS middleware.
 *
 * @type {*}
 */

////////////////////////////////////////////////////////////////////////////
//
// Configure Passport to use a Cloud CMS strategy
//
////////////////////////////////////////////////////////////////////////////

/**
 * Looks up the user by username or email.
 *
 * @param req
 * @param username
 * @param callback
 */
var findUser = function(req, username, callback)
{
    var ds = req.gitana.datastore("principals");
    var trap = function(err) {
        callback({
            "message": "Unable to find user for username or email: " + username
        });
    };
    var query = {
        "$or": [{
            "name": username
        }, {
            "email": username
        }]
    };
    Chain(ds).trap(trap).queryPrincipals(query).keepOne().then(function() {
        callback(null, this);
    });
};

passport.use(new LocalStrategy({
        passReqToCallback: true
    },  function(req, username, password, done) {

        var clientKey = req.gitanaConfig.clientKey;
        var clientSecret = req.gitanaConfig.clientSecret;
        var applicationId = req.gitanaConfig.application;
        var baseURL = req.gitanaConfig.baseURL;

        // pick the domain that we'll authenticate against
        var domainId = req.gitana.datastore("principals").getId();

        findUser(req, username, function(err, user) {

            if (err) {
                done(null, false, { "message": err.message });
                return;
            }

            // update username to the username of the actual user
            username = user.name;

            // authenticate to cloud cms
            // automatically caches based on ticket
            Gitana.connect({
                "clientKey": clientKey,
                "clientSecret": clientSecret,
                "application": applicationId,
                "username": domainId + "/" + username,
                "password": password,
                "baseURL": baseURL,
                "invalidatePlatformCache": true
            }, function(err) {

                if (err) {
                    done(null, false, { "message": err.message });
                    return;
                }

                // authentication was successful!

                // auth info
                var authInfo = this.platform().getDriver().getAuthInfo();

                // ticket
                var ticket = authInfo.getTicket();

                // user object
                var user = {
                    "id": authInfo.getPrincipalId(),
                    "domainId": authInfo.getPrincipalDomainId(),
                    "name": authInfo.getPrincipalName(),
                    "firstName": authInfo["user"]["firstName"],
                    "middleName": authInfo["user"]["middleName"],
                    "lastName": authInfo["user"]["lastName"]
                };

                // construct full name
                var fullName = null;
                if (user.firstName)
                {
                    fullName = user.firstName;
                    if (user.lastName) {
                        fullName += " " + user.lastName;
                    }
                }
                if (!fullName) {
                    fullName = user.name;
                }
                user.fullName = fullName;

                done(null, user, {
                    "ticket": ticket,
                    "user": user,
                    "test": 1
                });
            });
        });
    }
));

/*
passport.serializeUser(function(user, done) {
    done(null, user._doc);
});

passport.deserializeUser(function(id, done) {
    accounts.findOne(id, function (err, user) {
        done(err, user);
    });
});
*/


////////////////////////////////////////////////////////////////////////////
//
// INTERFACE METHODS
//
////////////////////////////////////////////////////////////////////////////

exports = module.exports = function(basePath)
{
    var storage = require("../../util/storage")(basePath);
    var cloudcmsUtil = require("../../util/cloudcms")(basePath);

    var resolveGitanaJson = function(req, callback)
    {
        var json = req.gitanaConfig;
        if (json)
        {
            // we force the cache key to the application id
            json.key = json.application;
            if (!json.key)
            {
                json.key = "default";
            }
        }

        callback(null, json);
    };

    var handleLogin = function(req, res, next)
    {
        var successUrl = req.param("successUrl");
        var failureUrl = req.param("failureUrl");

        var options = {
            session: false
        };

        passport.authenticate("local", options, function(err, user, info) {

            // info contains the "GITANA_COOKIE" that we handle back as a SSO token
            // it should be sent over in the GITANA_COOKIE or a "GITANA_TICKET" header on every follow-on request
            var ticket = info.ticket;
            var user = info.user;

            if (err) {
                return next(err);
            }

            if (!user) {

                if (failureUrl) {
                    return res.redirect(failureUrl);
                }

                res.send(503, {
                    "ok": false,
                    "message": info.message
                });
                return;
            }

            req.logIn(user, { session: false }, function(err) {

                if (err) {
                    return next(err);
                }

                if (successUrl) {
                    res.redirect(successUrl + "?ticket=" + ticket);
                    return;
                }

                res.send(200, {
                    "ok": true,
                    "ticket": ticket,
                    "user": user
                });
                res.end();
            });

        })(req, res, next);
    };

    var handleLogout = function(req, res, next)
    {
        var redirectUri = req.param("redirectUri");

        req.logout();

        var ticket = req.param("ticket");
        if (ticket)
        {
            Gitana.disconnect(ticket);
        }

        if (redirectUri) {
            res.redirect(redirectUri);
            res.end();
        }

        res.send(200, {
            "ok": true
        });
    };

    var autoRefreshRunner = function(configuration)
    {
        var diLog = function(text)
        {
            var shouldLog = configuration && configuration.autoRefresh && configuration.autoRefresh.log;
            if (shouldLog)
            {
                console.log(text);
            }
        };

        // AUTO REFRESH PROCESS
        // set up a background process that refreshes the appuser access token every 30 minutes
        setInterval(function() {

            diLog("Gitana Driver Health Check thread running...");

            // gather all of the configs that we'll refresh (keyed by host -> gitana config)
            var driverConfigs = {};
            if (configuration.virtualDriver)
            {
                driverConfigs["virtual"] = configuration.virtualDriver;
            }
            /*
             if (process.cache)
             {
             process.cache.each("hostGitanaConfigs", function(host, gitanaConfig) {
             driverConfigs[host] = gitanaConfig;
             });
             }
             */

            var hosts = [];
            for (var host in driverConfigs)
            {
                hosts.push(host);
            }

            var f = function(i)
            {
                if (i == hosts.length)
                {
                    // we're done
                    diLog("Gitana Driver Health Check thread finished");
                    return;
                }

                var host = hosts[i];
                var gitanaConfig = driverConfigs[host];

                Gitana.connect(gitanaConfig, function(err) {

                    diLog(" -> [" + host + "] running health check");

                    var g = this;

                    if (err)
                    {
                        diLog(" -> [" + host + "] Caught error while running auto-refresh");
                        diLog(" -> [" + host + "] " + err);
                        diLog(" -> [" + host + "] " + JSON.stringify(err));

                        diLog(" -> [" + host + "] Removing key: " + gitanaConfig.key);
                        Gitana.disconnect(gitanaConfig.key);

                        /*
                         process.cache.clear("hostGitanaConfigs", host);
                         */

                        f(i+1);
                        return;
                    }
                    else
                    {
                        diLog(" -> [" + host + "] refresh for host: " + host);

                        g.getDriver().refreshAuthentication(function(err) {

                            if (err) {
                                diLog(" -> [" + host + "] Refresh Authentication caught error: " + JSON.stringify(err));

                                diLog(" -> [" + host + "] Auto disconnecting key: " + gitanaConfig.key);
                                Gitana.disconnect(gitanaConfig.key);

                                /*
                                 process.cache.clear("hostGitanaConfigs", host);
                                 */

                            } else {
                                diLog(" -> [" + host + "] Successfully refreshed authentication for appuser");
                                diLog(" -> [" + host + "] grant time: " + new Date(g.getDriver().http.grantTime()));
                                diLog(" -> [" + host + "] access token: " + g.getDriver().http.accessToken());
                            }

                            f(i+1);
                        });
                    }
                });

            };

            f(0);

        }, (30*60*1000)); // thirty minutes
    };


    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    var doConnect = r.doConnect = function(req, gitanaConfig, callback)
    {
        var configuration = process.configuration;

        // either connect anew or re-use an existing connection to Cloud CMS for this application
        Gitana.connect(gitanaConfig, function(err) {

            if (err)
            {
                //
                // if the "gitana.json" came from a virtual driver acquire, then it might have changed and we
                // may need to reload it
                //
                // to allow that, we delete the file from disk here
                //
                // if we have virtual driver mode at the app server level...
                if (configuration.virtualDriver)
                {
                    if (req.virtualHost)
                    {
                        // if the gitana config was virtually loaded, we remove it from disk
                        if (req.gitanaConfig && req.gitanaConfig._virtual)
                        {
                            if (fs.existsSync(req.gitanaJsonPath))
                            {
                                var backupGitanaJsonPath = req.gitanaJsonPath + ".backup-" + new Date().getTime();

                                // first make a BACKUP of the original gitana.json file
                                console.log("Backing up: " + req.gitanaJsonPath + " to: " + backupGitanaJsonPath);
                                util.copyFile(req.gitanaJsonPath, backupGitanaJsonPath);

                                // now remove
                                fs.unlinkSync(req.gitanaJsonPath);
                            }
                        }
                    }
                }

                // either
                //   a) we're not supposed to be able to connect because guest was attempted and is not allowed
                //   b) non-guest and something went wrong

                if (!gitanaConfig.username || gitanaConfig.username == "guest")
                {
                    // guest mode
                    err.output = "Unable to connect to Cloud CMS as guest user";
                }
                else
                {
                    // otherwise assume that it is a configuration error?
                    err.output = "Cannot connect to Cloud CMS, contact your administrator";
                }
            }

            callback.call(this, err);
        });
    };

    /**
     * Ensures that a Cloud CMS driver is active and bound to the request.
     *
     * @return {Function}
     */
    r.driverInterceptor = function(configuration)
    {
        // the auto refresh runner ensures that the virtual driver gitana is always refreshed
        autoRefreshRunner(configuration);

        return function(req, res, next)
        {
            resolveGitanaJson(req, function(err, gitanaConfig) {

                if (err) {
                    req.log("Error loading gitana config: " + JSON.stringify(err));
                    next();
                    return;
                }

                if (!gitanaConfig)
                {
                    req.log("Could not find gitana.json file");
                    next();
                    return;
                }

                if (!gitanaConfig.key)
                {
                    gitanaConfig.key = gitanaConfig.application;
                }

                // either connect anew or re-use an existing connection to Cloud CMS for this application
                doConnect(req, gitanaConfig, function(err) {

                    if (err)
                    {
                        var configString = "null";
                        if (gitanaConfig) {
                            configString = JSON.stringify(gitanaConfig);
                        }

                        console.log("Cannot connect to Cloud CMS for config: " + configString + ", message: " + JSON.stringify(err));

                        // send back error
                        res.status(err.status).send(err.output);
                        res.end();
                        return;
                    }

                    req.gitana = this;

                    if (gitanaConfig)
                    {
                        req.applicationId = gitanaConfig.application;
                        req.principalId = this.getDriver().getAuthInfo().getPrincipalId();
                        req.gitanaConfig = gitanaConfig;
                    }

                    next();
                });

            });
        }
    };

    /**
     * Determines which gitana repository to use in future operations.
     *
     * @return {Function}
     */
    r.repositoryInterceptor = function()
    {
        return function(req, res, next)
        {
            if (req.gitana)
            {
                var repository = req.gitana.datastore("content");
                if (repository) {
                    req.repositoryId = repository.getId();
                }
            }

            next();
        }
    };

    /**
     * Allows for branch switching via request parameter.
     *
     * @return {Function}
     */
    r.branchInterceptor = function()
    {
        return function(req, res, next)
        {
            if (req.gitana)
            {
                // pick which branch
                var branchId = req.query["branch"];
                if (!branchId)
                {
                    branchId = req.header("CLOUDCMS_BRANCH");
                }
                if (!branchId)
                {
                    branchId = "master";
                }

                req.branchId = branchId;
            }

            next();
        }
    };

    /**
     * Allows for an in-context menu when connected to Cloud CMS for editing content.
     *
     * @return {Function}
     */
    r.iceInterceptor = function()
    {
        return function(req, res, next)
        {
            if (req.gitana)
            {
                req.ice = true;
            }

            next();
        }
    };

    /**
     * Provides virtualized content retrieval from Cloud CMS.
     *
     * This handler checks to see if the requested resource is already cached to disk.  If not, it makes an attempt
     * to retrieve the content from Cloud CMS (and cache to disk).
     *
     * If nothing found, this handler passes through, allowing other handlers downstream to serve back the content.
     *
     * URIs may include the following structures:
     *
     *    /static/path/{path...}
     *    /static/node/{nodeId}
     *    /static/node/{nodeId}/{attachmentId}
     *    /static/node/{nodeId}/{attachmentId}/{filename}
     *    /static/repository/{repositoryId}/branch/{branchId}/node/{nodeId}/{attachmentId}
     *    /static/repository/{repositoryId}/branch/{branchId}/node/{nodeId}/{attachmentId}/{filename}
     *    /static/repository/{repositoryId}/branch/{branchId}/path/A/B/C/D...
     *    /preview/path/{path...}
     *    /preview/node/{nodeId}
     *    /preview/node/{nodeId}/{filename}
     *    /preview/repository/{repositoryId}/branch/{branchId}/node/{nodeId}
     *    /s/{applicationsPath}
     *
     * And the following flags are supported:
     *
     *    metadata          - set to true to retrieve JSON metadata for object
     *    full              - set to true to retrieve JSON recordset data
     *    attachment        - the ID of the attachment ("default")
     *    force             - whether to overwrite saved state
     *    a                 - set to true to set Content Disposition response header
     *
     * For preview, the following are also supported:
     *
     *    name              - sets the name of the preview attachment id to be written / cached
     *    mimetype          - sets the desired mimetype of response
     *    size              - for images, sets the width in px of response image
     *
     * @param directory
     * @return {Function}
     */
    r.virtualHandler = function()
    {
        return function(req, res, next)
        {
            var host = req.virtualHost;
            var repositoryId = req.repositoryId;
            var branchId = cloudcmsUtil.determineBranchId(req);
            var locale = localeUtil.determineLocale(req);

            var previewId = null;

            var gitana = req.gitana;
            if (gitana)
            {
                var offsetPath = req.path;

                var virtualizedPath = null;
                var virtualizedNode = null;
                var virtualizedNodeExtra = null;
                var previewPath = null;
                var previewNode = null;
                if (offsetPath.indexOf("/static/path/") === 0)
                {
                    virtualizedPath = offsetPath.substring(13);
                }
                if (offsetPath.indexOf("/static/node/") === 0)
                {
                    virtualizedNode = offsetPath.substring(13);

                    // trim off anything extra...
                    var x = virtualizedNode.indexOf("/");
                    if (x > 0)
                    {
                        virtualizedNodeExtra = virtualizedNode.substring(x+1);
                        virtualizedNode = virtualizedNode.substring(0,x);
                    }
                }
                if (offsetPath.indexOf("/static/repository/") === 0)
                {
                    // examples
                    //    /static/repository/ABC/branch/DEF/node/XYZ
                    //    /static/repository/ABC/branch/DEF/node/XYZ/filename.ext
                    //    /static/repository/ABC/branch/DEF/path/A/B/C/D/E.jpg

                    var z = offsetPath.substring(19); // ABC/branch/DEF/node/XYZ

                    // pluck off the repository id
                    var x1 = z.indexOf("/");
                    repositoryId = z.substring(0, x1);

                    // advance to branch
                    x1 = z.indexOf("/", x1+1);
                    z = z.substring(x1+1); // DEF/node/XYZ

                    // pluck off the branch id
                    x1 = z.indexOf("/");
                    branchId = z.substring(0, x1);

                    // advance to "thing" (either node or path)
                    z = z.substring(x1+1); // node/XYZ or path/1/2/3/4

                    // pluck off the thing
                    x1 = z.indexOf("/");
                    var thing = z.substring(0, x1); // "node" or "path"
                    if (thing == "node")
                    {
                        virtualizedNode = z.substring(x1+1);

                        // trim off anything extra...
                        var x = virtualizedNode.indexOf("/");
                        if (x > 0)
                        {
                            virtualizedNodeExtra = virtualizedNode.substring(x+1);
                            virtualizedNode = virtualizedNode.substring(0,x);
                        }
                    }
                    else if (thing == "path")
                    {
                        virtualizedPath = z.substring(x1+1);
                    }
                }
                if (offsetPath.indexOf("/preview/path/") === 0)
                {
                    previewPath = offsetPath.substring(14);
                }
                if (offsetPath.indexOf("/preview/node/") === 0)
                {
                    previewNode = offsetPath.substring(14);

                    // trim off anything extra...
                    var x = previewNode.indexOf("/");
                    if (x > 0)
                    {
                        previewNode = previewNode.substring(0,x);
                    }
                }
                if (offsetPath.indexOf("/preview/repository/") === 0)
                {
                    // examples
                    //    /preview/repository/ABC/branch/DEF/node/XYZ
                    //    /preview/repository/ABC/branch/DEF/path/1/2/3/4

                    var z = offsetPath.substring(20); // ABC/branch/DEF/node/XYZ

                    // pluck off the repository id
                    var x1 = z.indexOf("/");
                    repositoryId = z.substring(0, x1);

                    // advance to branch
                    x1 = z.indexOf("/", x1+1);
                    z = z.substring(x1+1); // DEF/node/XYZ

                    // pluck off the branch id
                    x1 = z.indexOf("/");
                    branchId = z.substring(0, x1);

                    // advance to "thing" (either node or path)
                    z = z.substring(x1+1); // node/XYZ or path/1/2/3/4

                    // pluck off the thing
                    x1 = z.indexOf("/");
                    var thing = z.substring(0, x1); // "node" or "path"
                    if (thing == "node")
                    {
                        previewNode = z.substring(x1+1);
                    }
                    else if (thing == "path")
                    {
                        previewPath = z.substring(x1+1);
                    }
                }
                /*
                if (offsetPath.indexOf("/s/") === 0)
                {
                    var fullPath = path.join("Applications", req.gitana.application().getId(), offsetPath.substring(3));
                    if (req.param("preview"))
                    {
                        previewPath = fullPath;
                    }
                    else if (req.param("size") || req.param("mimetype"))
                    {
                        if (req.param("size")) {
                            previewId = "preview_" + req.param("size");
                        }
                        else if (req.param("mimetype")) {
                            previewId = "preview_" + req.param("mimetype");
                        }
                        previewPath = fullPath;
                    }
                    else
                    {
                        virtualizedPath = fullPath;
                    }
                }
                */

                // TODO: handle certain mimetypes
                // TODO: images, css, html, js?

                // virtualized content retrieval
                // these urls can have request parameters
                //
                //    "metadata"
                //    "full"
                //    "attachment"
                //    "force"
                //    "a" (to force content disposition header)
                //
                // Virtual Path is:
                //    /static/path/{...path}?options...
                //
                // Virtual Node is:
                //    /static/node/{nodeId}?options...
                //    /static/node/GUID/tommy.jpg?options...
                //
                if (virtualizedPath || virtualizedNode)
                {
                    // node and path to offset against
                    var nodePath = null;
                    var nodeId = null;
                    if (virtualizedNode) {
                        nodeId = virtualizedNode;
                        nodePath = null;
                    } else if (virtualizedPath) {
                        nodeId = "root";
                        nodePath = virtualizedPath;
                    }

                    var requestedFilename = null;

                    var attachmentId = "default";
                    if (virtualizedNode && virtualizedNodeExtra)
                    {
                        attachmentId = virtualizedNodeExtra;
                        if (attachmentId)
                        {
                            // if the attachment id is "a/b" or something with a slash in it
                            // we keep everything ahead of the slash
                            var p = attachmentId.indexOf("/");
                            if (p > -1)
                            {
                                requestedFilename = attachmentId.substring(p+1);
                                attachmentId = attachmentId.substring(0, p);
                            }
                            else
                            {
                                requestedFilename = attachmentId;
                            }
                        }
                        if (attachmentId)
                        {
                            var a = attachmentId.indexOf(".");
                            if (a > -1)
                            {
                                attachmentId = attachmentId.substring(0, a);
                            }
                        }
                    }

                    // pass in the ?metadata=true parameter to get back the JSON for any Gitana object
                    // otherwise, the "default" attachment is gotten
                    if (req.param("metadata"))
                    {
                        attachmentId = null;
                    }

                    // or override the attachmentId
                    if (req.param("attachment"))
                    {
                        attachmentId = req.param("attachment");
                    }

                    // check whether there is a file matching this uri
                    if (nodePath && "/" === nodePath) {
                        nodePath = "index.html";
                    }

                    // the cache can be invalidated with either the "force" or "invalidate" request parameters
                    var forceCommand = req.param("force") ? req.param("force") : false;
                    var invalidateCommand = req.param("invalidate") ? req.param("invalidate") : false;
                    var forceReload = forceCommand || invalidateCommand;

                    // whether to set content disposition on response
                    var useContentDispositionResponse = false;
                    var a = req.param("a");
                    if (a == "true") {
                        useContentDispositionResponse = true;
                    }

                    cloudcmsUtil.download(host, gitana, repositoryId, branchId, nodeId, attachmentId, nodePath, locale, forceReload, function(err, filePath, cacheInfo) {

                        // if the file was found on disk or was downloaded, then stream it back
                        if (!err && filePath)
                        {
                            var filename = resolveFilename(filePath, cacheInfo, requestedFilename);

                            if (useContentDispositionResponse)
                            {
                                res.download(filePath, filename, function(err) {

                                    // something went wrong while streaming the content back...
                                    if (err) {
                                        res.send(503, err);
                                        res.end();
                                    }

                                });
                            }
                            else
                            {
                                var contentType = applyResponseContentType(res, cacheInfo, filename);
                                applyDefaultContentTypeCaching(res, contentType);

                                res.sendfile(filePath, function(err)
                                {
                                    // something went wrong while streaming the content back...
                                    if (err) {
                                        res.send(503, err);
                                        res.end();
                                    }

                                });
                            }
                        }
                        else
                        {
                            if (req.param("fallback"))
                            {
                                // redirect to the fallback
                                res.redirect(req.param("fallback"));
                                return;
                            }

                            // otherwise, allow other handlers to process this request
                            next();
                        }

                    });
                }
                else

                /*
                    Params are:

                        "name"
                        "mimetype"
                        "size"
                        "force"

                    Preview path is:
                        /preview/path/{...path}?name={name}...rest of options

                    Preview node is:
                        /preview/node/{nodeId}?name={name}... rest of options
                        /preview/node/GUID/tommy.jpg?name={name}... rest of options
                 */
                if (previewPath || previewNode)
                {
                    // node and path to offset against
                    var nodePath = null;
                    var nodeId = null;
                    if (previewNode) {
                        nodeId = previewNode;
                        nodePath = null;
                    } else if (previewPath) {
                        nodeId = "root";
                        nodePath = previewPath;
                    }

                    if (!previewId)
                    {
                        previewId = req.param("name");
                    }

                    // determine attachment id
                    var attachmentId = "default";
                    if (req.param("attachment"))
                    {
                        attachmentId = req.param("attachment");
                    }

                    var requestedFilename = null;
                    if (previewId)
                    {
                        requestedFilename = previewId;

                        var p = previewId.indexOf(".");
                        if (p > -1)
                        {
                            previewId = previewId.substring(0, p);
                        }
                    }

                    // size
                    var size = req.param("size") ? req.param("size") : -1;
                    if (size && (typeof(size) == "string"))
                    {
                        size = parseInt(size, 10);
                    }

                    // mimetype
                    var mimetype = req.param("mimetype") ? req.param("mimetype") : "image/jpeg";

                    // force
                    var forceReload = req.param("force") ? req.param("force") : false;

                    // whether to set content disposition on response
                    var useContentDispositionResponse = false;
                    var a = req.param("a");
                    if (a == "true") {
                        useContentDispositionResponse = true;
                    }

                    cloudcmsUtil.preview(host, gitana, repositoryId, branchId, nodeId, nodePath, attachmentId, locale, previewId, size, mimetype, forceReload, function(err, filePath, cacheInfo) {

                        if (err)
                        {
                            req.log("PREVIEW ERR: " + JSON.stringify(err));
                        }

                        // if the file was found on disk or was downloaded, then stream it back
                        if (!err && filePath)
                        {
                            var filename = resolveFilename(filePath, cacheInfo, requestedFilename);

                            if (useContentDispositionResponse)
                            {
                                res.download(filePath, filename, function(err) {

                                    // something went wrong while streaming the content back...
                                    if (err) {
                                        res.send(503, err);
                                        res.end();
                                    }

                                });
                            }
                            else
                            {
                                applyResponseContentType(res, cacheInfo, filename);

                                res.sendfile(filePath, function(err)
                                {
                                    // something went wrong while streaming the content back...
                                    if (err) {
                                        res.send(503, err);
                                        res.end();
                                    }
                                });
                            }
                        }
                        else
                        {
                            if (req.param("fallback"))
                            {
                                // redirect to the fallback
                                res.redirect(req.param("fallback"));
                                return;
                            }

                            // otherwise, allow other handlers to process this request
                            next();
                        }

                    });
                }
                else
                {
                    // not something we virtualize
                    next();
                }
            }
            else
            {
                // if gitana not being used, then allow other handlers to handle the request
                next();
            }
        };
    };

    /**
     * Handles authentication calls -
     *
     *    /login
     *    /logout
     *
     * @return {Function}
     */
    r.authenticationHandler = function(app)
    {
        app.use(passport.initialize());
        //app.use(passport.session());

        return function(req, res, next)
        {
            var handled = false;

            if (req.method.toLowerCase() == "post") {

                if (req.url.indexOf("/login") == 0)
                {
                    handleLogin(req, res, next);
                    handled = true;
                }
                else if (req.url.indexOf("/logout") == 0)
                {
                    handleLogout(req, res, next);
                    handled = true;
                }
            }

            if (!handled)
            {
                next();
            }
        }
    };

    /**
     * Determines which filename to use for content disposition requests.
     *
     * The strategy is thus:
     *
     *    1.  If there is a requested filename, then that is used
     *    2.  Otherwise, the content disposition header is used
     *    3.  If still nothing, then the last element from the file path is used
     *
     * No matter what file name is picked, a check is then made to see whether it has an extension.  If not, the
     * response headers are looked at for "content-type" and the mime package is used to figure out an extension that
     * can be applied.
     *
     * If, in the end, an extension cannot be applied, then the filename may come back without one.
     *
     * @param filePath
     * @param cacheInfo
     * @param requestedFilename
     */
    var resolveFilename = function(filePath, cacheInfo, requestedFilename)
    {
        var filename = requestedFilename;
        if (!filename)
        {
            filename = cacheInfo.filename;
        }
        if (!filename)
        {
            // pick last from file path
            filename = path.basename(filePath);
        }

        // safety check - if for some reason, no filename, bail out
        if (!filename)
        {
            return null;
        }

        // if filename doesn't have an extension, we'll conjure one up
        var ext = path.extname(filename);
        if (!ext)
        {
            var mimetype = cacheInfo.mimetype;
            if (mimetype)
            {
                ext = mime.extension(mimetype);
                if (ext)
                {
                    filename += "." + ext;
                }
            }
        }

        return filename;
    };

    var applyResponseContentType = function(response, cacheInfo, filename)
    {
        var contentType = null;

        // do the response headers have anything to tell us
        if (cacheInfo)
        {
            // is there an explicit content type?
            contentType = cacheInfo.mimetype;
        }

        // if still nothing, what can we guess from the filename mime?
        if (!contentType && filename)
        {
            var ext = path.extname(filename);
            if (ext)
            {
                contentType = mime.lookup(ext);
            }
        }

        // TODO: should we look for ";charset=" and strip out?

        if (contentType)
        {
            response.setHeader("Content-Type", contentType);
        }

        return contentType;
    };

    //var MAXAGE_ONE_YEAR = 31536000;
    //var MAXAGE_ONE_HOUR = 3600;
    //var MAXAGE_ONE_WEEK = 604800;
    var MAXAGE_THIRTY_MINUTES = 1800;

    var applyDefaultContentTypeCaching = function(res, mimetype)
    {
        if (!mimetype || !res)
        {
            return;
        }

        var cacheControl = null;

        if (process.env.CLOUDCMS_APPSERVER_MODE == "production")
        {
            var isCSS = ("text/css" == mimetype);
            var isImage = (mimetype.indexOf("image/") > -1);
            var isJS = ("text/javascript" == mimetype) || ("application/javascript" == mimetype);
            var isHTML = ("text/html" == mimetype);

            // html
            if (isHTML)
            {
                cacheControl = "public, max-age=" + MAXAGE_THIRTY_MINUTES;
            }

            // css, images and js get 1 year
            if (isCSS || isImage || isJS)
            {
                cacheControl = "public, max-age=" + MAXAGE_THIRTY_MINUTES;
            }
        }

        if (!cacheControl)
        {
            // set to no-cache
            cacheControl = "no-cache";
        }

        res.header('Cache-Control', cacheControl);

    };


    return r;
};

