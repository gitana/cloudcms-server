var path = require('path');
var fs = require('fs');
var http = require('http');
var util = require("../util/util");
var localeUtil = require("../util/locale");
var mkdirp = require('mkdirp');

var Gitana = require("gitana");

var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

////////////////////////////////////////////////////////////////////////////
//
// Configure Passport to use a Cloud CMS strategy
//
////////////////////////////////////////////////////////////////////////////

passport.use(new LocalStrategy({
        passReqToCallback: true
    },  function(req, username, password, done) {

        var clientKey = req.gitanaConfig.clientKey;
        var clientSecret = req.gitanaConfig.clientSecret;
        var applicationId = req.gitanaConfig.application;
        var baseURL = req.gitanaConfig.baseURL;

        // pick the domain that we'll authenticate against
        var domainId = req.gitana.datastore("principals").getId()

        // authenticate to cloud cms
        // automatically caches based on ticket
        Gitana.connect({
            "clientKey": clientKey,
            "clientSecret": clientSecret,
            "application": applicationId,
            "username": domainId + "/" + username,
            "password": password,
            "baseURL": baseURL
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
                "user": user
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
    var storage = require("../util/storage")(basePath);
    var cloudcmsUtil = require("../util/cloudcms")(basePath);

    var readGitanaJson = function(req, callback)
    {
        var gitanaJsonPath = null;
        if (req.virtualHostGitanaJsonPath)
        {
            gitanaJsonPath = req.virtualHostGitanaJsonPath;
        }
        else if (process.env.CLOUDCMS_GITANA_JSON_PATH)
        {
            gitanaJsonPath = process.env.CLOUDCMS_GITANA_JSON_PATH;
        }

        fs.readFile(gitanaJsonPath, function(err, text) {

            if (err) {
                callback(err);
                return;
            }

            var json = JSON.parse(text);

            // make sure a "default" cache key is specified
            if (!json.key) {
                json.key = "default";
            }

            callback(null, json);
        });
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

        if (redirectUri) {
            res.redirect(redirectUri);
            res.end();
        }

        res.send(200, {
            "ok": true
        });
    };


    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    /**
     * Ensures that a Cloud CMS driver is active and bound to the request.
     *
     * @return {Function}
     */
    r.driverInterceptor = function(missing)
    {
        return function(req, res, next)
        {
            readGitanaJson(req, function(err, gitanaConfig) {

                if (err) {
                    next();
                    return;
                }

                if (!gitanaConfig.key)
                {
                    gitanaConfig.key = gitanaConfig.application;
                }

                // either connect anew or re-use an existing connection to Cloud CMS for this application
                Gitana.connect(gitanaConfig, function(err) {

                    if (err)
                    {
                        var configString = "null";
                        if (gitanaConfig) {
                            configString = JSON.stringify(gitanaConfig);
                        }

                        console.log("Cannot connect to Cloud CMS for config: " + configString + ", message: " + JSON.stringify(err));

                        res.status(503).send("Cannot connect to Cloud CMS, contact your administrator");
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
                if (!branchId) {
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
                        virtualizedNode = virtualizedNode.substring(0,x);
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

                // TODO: handle certain mimetypes
                // TODO: images, css, html, js?

                // virtualized content retrieval
                // these urls can have request parameters
                //
                //    "metadata"
                //    "full"
                //    "attachmentId"
                //    "force"
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

                    var attachmentId = "default";

                    // pass in the ?metadata=true parameter to get back the JSON for any Gitana object
                    // otherwise, the "default" attachment is gotten
                    if (req.param("metadata") || req.param("m"))
                    {
                        attachmentId = null;
                    }

                    // or override the attachmentId
                    if (req.param("attachment") || req.param("a"))
                    {
                        attachmentId = req.param("attachment") ? req.param("attachment") : req.param("a");
                    }

                    // check whether there is a file matching this uri
                    if (nodePath && "/" === nodePath) {
                        nodePath = "index.html";
                    }
                    var forceReload = req.param("force") ? req.param("force") : false;

                    cloudcmsUtil.download(host, gitana, repositoryId, branchId, nodeId, attachmentId, nodePath, locale, forceReload, function(err, filePath) {

                        // if the file was found on disk or was downloaded, then stream it back
                        if (!err && filePath)
                        {
                            res.sendfile(filePath, function(err)
                            {
                                // something went wrong while streaming the content back...
                                if (err) {
                                    res.send(503, err);
                                    res.end();
                                }
                            });
                        }
                        else
                        {
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
                    if (!previewId)
                    {
                        previewId = "preview64";
                    }

                    // size
                    var size = req.param("size") ? req.param("size") : 64;

                    // mimetype
                    var mimetype = req.param("mimetype") ? req.param("mimetype") : "image/jpeg";

                    // force
                    var forceReload = req.param("force") ? req.param("force") : false;

                    cloudcmsUtil.preview(host, gitana, repositoryId, branchId, nodeId, nodePath, locale, previewId, size, forceReload, function(err, filePath) {

                        if (err)
                        {
                            console.log("PREVIEW ERR: " + err);
                            console.log("PREVIEW ERR.message: " + err.message);
                        }

                        // if the file was found on disk or was downloaded, then stream it back
                        if (!err && filePath)
                        {
                            res.sendfile(filePath, function(err)
                            {
                                // something went wrong while streaming the content back...
                                if (err) {
                                    res.send(503, err);
                                    res.end();
                                }
                            });
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

    return r;
};

