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
        if (req.virtualHost)
        {
            gitanaJsonPath = path.join(storage.hostDirectoryPath(req.virtualHost), "gitana.json");
        }
        else if (process.env.CLOUDCMS_DEFAULT_ROOT_PATH)
        {
            gitanaJsonPath = path.join(process.env.CLOUDCMS_DEFAULT_ROOT_PATH, "gitana.json");
        }

        fs.readFile(gitanaJsonPath, function(err, text) {

            if (err) {
                callback(err);
                return;
            }

            var json = JSON.parse(text);

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
    r.driverInterceptor = function()
    {
        return function(req, res, next)
        {
            readGitanaJson(req, function(err, gitanaConfig) {

                if (err) {
                    next();
                    return;
                }

                // either connect anew or re-use an existing connection to Cloud CMS for this application
                Gitana.connect(gitanaConfig, function(err) {

                    if (err)
                    {
                        res.status(503).send("Cannot connect to Cloud CMS for application: " + descriptor.application.key + ", message: " + JSON.stringify(err));
                        res.end();
                        return;
                    }

                    req.gitana = this;

                    if (gitanaConfig)
                    {
                        req.applicationId = gitanaConfig.application;
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

    /*
     r.invalidateCacheInterceptor = function()
     {
     return function(req, res, next)
     {
     // allow for local production cache invalidation
     if (req.query["invalidate"] === "true")
     {
     var branchId = cloudCmsUtil.determineBranchId(req);
     var locale = requestUtil.determineLocale(req);

     var dir = path.join(storesPath, directory, branchId, locale);

     rmdirRecursiveSync(dir);
     }

     next();
     };
     };
     */

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
            var gitana = req.gitana;
            if (gitana)
            {
                var offsetPath = req.path;

                var virtualized = false;
                if (offsetPath.indexOf("/static") == 0)
                {
                    virtualized = true;
                }
                if (offsetPath.indexOf("/config") == 0)
                {
                    virtualized = true;
                }
                if (offsetPath.indexOf("/pages") == 0)
                {
                    virtualized = true;
                }

                if (virtualized)
                {
                    var host = req.virtualHost;
                    var repositoryId = req.repositoryId;
                    var branchId = cloudcmsUtil.determineBranchId(req);
                    var locale = localeUtil.determineLocale(req);
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
                    var offsetPath = req.path;
                    if ("/" === offsetPath) {
                        offsetPath = "/index.html";
                    }
                    if (offsetPath.indexOf("/") == 0) {
                        offsetPath = offsetPath.substring(1);
                    }
                    offsetPath = "/applications/" + req.applicationId + "/" + offsetPath;

                    var forceReload = true;

                    cloudcmsUtil.download(host, gitana, repositoryId, branchId, "root", attachmentId, offsetPath, locale, forceReload, function(err, filePath) {

                        // if the file was found on disk or was downloaded, then stream it back
                        if (filePath)
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

