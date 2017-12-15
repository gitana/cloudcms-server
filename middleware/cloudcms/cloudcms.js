var path = require('path');
var http = require('http');
var util = require("../../util/util");
var async = require("async");

var Gitana = require("gitana");

var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

var mime = require("mime");

var cloudcmsUtil = require("../../util/cloudcms");

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

passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(user, done) {
    done(null, user);
});

/**
 * Looks up the user by username or email.
 *
 * @param req
 * @param username
 * @param callback
 */
var findUser = function(req, username, callback)
{
    var query = {
        "$or": [{
            "name": username
        }, {
            "email": username
        }]
    };

    var domain = req.gitana.datastore("principals");
    Chain(domain).queryPrincipals(query).then(function() {

        if (this.size() === 0) {
            return callback({
                "message": "Unable to find user for username or email: " + username
            });
        }

        this.keepOne().then(function() {
            callback(null, this);
        });
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
                return done(null, false, { "message": err.message });
            }

            if (!user) {
                return done(null, false, { "message": "Unable to find user: " + username });
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
                    return done(null, false, err);
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

////////////////////////////////////////////////////////////////////////////
//
// INTERFACE METHODS
//
////////////////////////////////////////////////////////////////////////////

exports = module.exports = function()
{
    var handleErrorMessage = function(req, res, errorMessage)
    {
        if (req.flash)
        {
            // stores error message into "flash" session memory
            req.flash("info", errorMessage);
        }

        var failureUrl = req.query["failureUrl"];
        if (failureUrl)
        {
            // redirect
            //res.redirect(failureUrl);

            req.session.save(function(){
                res.redirect(failureUrl);
            });
        }
        else
        {
            // otherwise, send JSON response
            util.status(res, 503);

            var body = {
                "ok": false
            };

            if (errorMessage)
            {
                body.message = errorMessage;
            }

            res.send(body);
        }
    };

    var handleLogin = function(req, res, next)
    {
        var successUrl = req.query["successUrl"];
        var failureUrl = req.query["failureUrl"];

        var options = {
            //session: false
        };

        passport.authenticate("local", options, function(err, user, info) {

            var errorMessage = null;

            if (err)
            {
                console.log("ERROR DURING AUTHENTICATION: " + err + ", text: " + JSON.stringify(err));
                errorMessage = "There was a problem logging in, please contact your system administrator";
            }

            if (!user)
            {
                if (info && info.message)
                {
                    errorMessage = info.message;
                }
                else
                {
                    errorMessage = "There was a problem logging in, please contact your system administrator.  User not found.";
                }
            }

            // if there was an error, respond thusly
            if (errorMessage)
            {
                return handleErrorMessage(req, res, errorMessage);
            }

            // otherwise, we're ok

            // info contains the "GITANA_COOKIE" that we handle back as a SSO token
            // it should be sent over in the GITANA_COOKIE or a "GITANA_TICKET" header on every follow-on request
            var ticket = info.ticket;
            var user = info.user;

            // convert to a regular old JS object to be compatible with session serialization
            user = JSON.parse(JSON.stringify(user));

            // try to log in to cloud cms with this user
            req.logIn(user, function(err) {

                if (err)
                {
                    // failed to log in...
                    console.log("ERROR DURING LOGIN: " + err + ", text: " + JSON.stringify(err));
                    errorMessage = "There was a problem logging in, please contact your system administrator";

                    return handleErrorMessage(req, res, errorMessage);
                }

                var config = process.configuration || {};
                config.auth = config.auth || {};
                if (successUrl)
                {
                    if(config.auth.passTicket)
                    {
                        res.redirect(successUrl + "?ticket=" + ticket);
                    }
                    else
                    {
                        res.redirect(successUrl);
                    }
                }
                else
                {
                    // otherwise, send JSON response
                    util.status(res, 200);
                    var result = {
                        "ok": true,
                        "user": user
                    };

                    if (config.auth.passTicket) {
                        result.ticket = ticket;
                    }

                    res.send(result);
                }
            });

        })(req, res, next);
    };

    var handleLogout = function(req, res, next)
    {
        var redirectUri = req.query["redirectUri"];
        if (!redirectUri) {
            redirectUri = req.query["redirectURI"];
        }
        if (!redirectUri) {
            redirectUri = req.query["redirect"];
        }

        if (req.logout) {
            req.logout();
        }

        var ticket = req.query["ticket"];
        if (ticket)
        {
            Gitana.disconnect(ticket);
        }

        // redirect?
        if (redirectUri)
        {
            return res.redirect(redirectUri);
        }

        util.status(res, 200);
        res.send({
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
     * Determines which gitana repository to use in future operations.
     *
     * @return {Function}
     */
    r.repositoryInterceptor = function()
    {
        return util.createInterceptor("repository", function(req, res, next, stores, cache, configuration) {

            if (req.gitana && req.gitana.datastore)
            {
                var repository = req.gitana.datastore("content");
                if (repository)
                {
                    req.repositoryId = repository.getId();

                    // helper function
                    req.repository = function(repository) {
                        return function(callback) {
                            callback(null, repository);
                        };
                    }(repository);
                }
            }

            next();
        });
    };

    var _LOCK = function(cacheKey, workFunction)
    {
        process.locks.lock("branchload-" + cacheKey, workFunction);
    };

    // store a cache of branches since we don't want to reload these every time
    var CACHED_BRANCHES = {};

    var _branch_key = function(repository, branchId) {
        return repository._doc + "_" + branchId;
    };

    var _load_branch = function(repository, branchId, callback)
    {
        var cacheKey = _branch_key(repository, branchId);

        var branch = CACHED_BRANCHES[cacheKey];
        if (branch) {
            return callback(null, Chain(branch));
        }

        // only allow one "thread" at a time to load the branch
        _LOCK(cacheKey, function(releaseLockFn) {

            var loadFn = function(finished) {

                Chain(repository).trap(function(e) {

                    // unable to load branch!
                    console.log("Unable to load branch: " + repository._doc + "/" + branchId + ", err: " + e);
                    console.log(JSON.stringify(e));
                    finished({
                        "message": "Unable to load branch: " + repository._doc + "/" + branchId
                    });
                    return false;
                }).readBranch(branchId).then(function() {
                    finished(null, this);
                });

            };

            loadFn(function(err, branch) {

                if (err || !branch)
                {
                    // try again...
                    return loadFn(function(err, branch) {

                        if (err) {

                            // release the lock
                            releaseLockFn();

                            // do the callback
                            return callback(err);
                        }

                        // success!

                        // store in cache
                        CACHED_BRANCHES[cacheKey] = branch;

                        // release the lock
                        releaseLockFn();

                        // do the callback
                        return callback(null, branch);
                    });
                }

                // store in cache
                CACHED_BRANCHES[cacheKey] = branch;

                // release the lock
                releaseLockFn();

                // do the callback
                return callback(null, branch);
            });
        });
    };

    var _invalidate_branch = function(repository, branchId)
    {
        var cacheKey = _branch_key(repository, branchId);

        delete CACHED_BRANCHES[cacheKey];
    };

    /**
     * Allows for branch switching via request parameter.
     *
     * @return {Function}
     */
    r.branchInterceptor = function()
    {
        return util.createInterceptor("branch", function(req, res, next, stores, cache, configuration) {

            if (req.gitana)
            {
                req.application(function(err, application) {

                    var branchCookieName = null;
                    var branchCookieId = null;
                    if (!err && application)
                    {
                        branchCookieName = "cloudcms-server-application-" + application.getId() + "-branch-id";
                        branchCookieId = req.cookies[branchCookieName];
                    }

                    // pick which branch
                    var branchId = req.query["branch"];
                    if (!branchId)
                    {
                        branchId = req.query["branchId"];
                    }
                    if (!branchId)
                    {
                        branchId = req.header("CLOUDCMS_BRANCH");
                    }
                    if (!branchId)
                    {
                        branchId = req.header("BRANCH");
                    }
                    if (!branchId)
                    {
                        branchId = req.header("branchId");
                    }
                    if (!branchId)
                    {
                        // does the runtime tell us which branch to use?
                        if (req.runtime && req.runtime.branchId)
                        {
                            branchId = req.runtime.branchId;
                        }
                    }
                    if (!branchId)
                    {
                        // allow for the branch to specified via an environment parameter
                        if (process.env.CLOUDCMS_BRANCH_ID)
                        {
                            branchId = process.env.CLOUDCMS_BRANCH_ID;
                        }
                    }
                    if (!branchId)
                    {
                        // allow for the branch to specified via an environment parameter
                        if (process.env.CLOUDCMS_RUNTIME_BRANCH_ID)
                        {
                            branchId = process.env.CLOUDCMS_RUNTIME_BRANCH_ID;
                        }
                    }
                    if (!branchId)
                    {
                        branchId = branchCookieId;
                    }

                    // fallback to master if no other choice
                    if (!branchId)
                    {
                        branchId = "master";
                    }

                    // allow value to be forced?
                    if (process.env.CLOUDCMS_RUNTIME_BRANCH_ID)
                    {
                        branchId = process.env.CLOUDCMS_RUNTIME_BRANCH_ID;
                    }

                    req.branchId = branchId;

                    // write a cookie down to store branch ID if it changed
                    if (branchId !== branchCookieId)
                    {
                        if (branchCookieName)
                        {
                            util.setCookie(req, res, branchCookieName, req.branchId);

                            // legacy cleanup
                            util.clearCookie(res, "cloudcms-server-branch-id");
                        }
                    }

                    // declare the helper function
                    req.branch = function()
                    {
                        var _branch = null;

                        return function(callback)
                        {
                            // if we already have a cached branch on this request, just hand that back
                            if (_branch)
                            {
                                return callback(null, Chain(_branch));
                            }

                            // load the branch, first get the repository
                            req.repository(function(err, repository) {

                                if (err) {
                                    console.log("Attempting to load branch, could not load repository, err: " + err);
                                    console.log(JSON.stringify(err));
                                    return callback({
                                        "message": "Attempting to load branch, failed to load repository for branch: " + req.branchId
                                    });
                                }

                                // now load the branch with a sync lock
                                _load_branch(repository, req.branchId, function(err, branch) {

                                    if (err)
                                    {
                                        // make sure to remove cookie
                                        var cookieName = "cloudcms-server-application-" + req.applicationId + "-branch-id";
                                        util.clearCookie(res, cookieName);

                                        return callback(err);
                                    }

                                    _branch = branch;

                                    callback(null, _branch);
                                });
                            });
                        }
                    }();
                });
            }

            next();
        });
    };

    /**
     * Determines which gitana domain to use in future operations.
     *
     * @return {Function}
     */
    r.domainInterceptor = function()
    {
        return util.createInterceptor("domain", function(req, res, next, stores, cache, configuration) {

            if (req.gitana && req.gitana.datastore)
            {
                var domain = req.gitana.datastore("principals");
                if (domain)
                {
                    req.domainId = domain.getId();
                }

                /*
                // helper function
                req.domain = function(callback)
                {
                    callback(null, domain);
                };
                */
            }

            next();
        });
    };

    /**
     * Determines which gitana domain to use in future operations.
     *
     * @return {Function}
     */
    r.applicationInterceptor = function()
    {
        return util.createInterceptor("application", function(req, res, next, stores, cache, configuration) {

            if (req.gitana && req.gitana.datastore)
            {
                var application = req.gitana.application();
                if (application)
                {
                    req.applicationId = application.getId();
                }

                // helper function
                req.application = function(application) {
                    return function (callback) {
                        callback(null, application);
                    };
                }(application);
            }

            next();
        });
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
     * Binds the req.cmsLog(message, level, data) method for use in logging to Cloud CMS.
     *
     * @return {Function}
     */
    r.cmsLogInterceptor = function() {

        return util.createInterceptor("cmslog", function(req, res, next, stores, cache, configuration) {

            // define function
            req.cmsLog = function (message, level, data, callback) {

                if (!this.gitana)
                {
                    console.log("Cannot find req.gitana instance, skipping logging");
                    return;
                }

                if (typeof(data) === "function")
                {
                    callback = data;
                    data = {};
                }

                if (!data)
                {
                    data = {};
                }

                var obj = {
                    "data": data
                };

                this.gitana.platform().createLogEntry(message, level, obj).then(function () {
                    if (callback)
                    {
                        callback();
                    }
                });
            };

            next();
        });
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
     *  (preferred)
     *
     *    /static/{filename}?repository={repositoryId}&branch={branchId}&node={nodeId}
     *    /static/{filename}?repository={repositoryId}&branch={branchId}&path={path}
     *    /static/{filename}?ref={ref}
     *
     *    /preview/{filename}?repository={repositoryId}&branch={branchId}&node={nodeId}
     *    /preview/{filename}?repository={repositoryId}&branch={branchId}&path={path}
     *    /preview/{filename}?ref={ref}
     *
     *  (legacy)
     *
     *    /static/path/{path...}
     *    /static/node/{nodeId}
     *    /static/node/{nodeId}/{attachmentId}
     *    /static/node/{nodeId}/{attachmentId}/{filename}
     *    /static/repository/{repositoryId}/branch/{branchId}/node/{nodeId}/{attachmentId}
     *    /static/repository/{repositoryId}/branch/{branchId}/node/{nodeId}/{attachmentId}/{filename}
     *    /static/repository/{repositoryId}/branch/{branchId}/path/A/B/C/D...
     *    /static/repository/{repositoryId}/branch/{branchId}?path=/A/B/C/D
     *
     *    /preview/path/{path...}
     *    /preview/node/{nodeId}
     *    /preview/node/{nodeId}/{previewId}
     *    /preview/repository/{repositoryId}/branch/{branchId}/node/{nodeId}/{previewId}
     *    /preview/repository/{repositoryId}/branch/{branchId}/node/{nodeId}?name={previewId}
     *    /preview/repository/{repositoryId}/branch/{branchId}/path/A/B/C/D/{previewId}
     *    /preview/repository/{repositoryId}/branch/{branchId}/{previewId}?path={path}
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
    r.virtualNodeHandler = function()
    {
        // bind listeners for broadcast events
        bindSubscriptions.call(this);

        return util.createHandler("virtualNode", null, function(req, res, next, stores, cache, configuration) {

            var contentStore = stores.content;

            var repositoryId = req.repositoryId;
            var branchId = req.branchId;
            var locale = req.locale;

            var previewId = null;

            var gitana = req.gitana;
            if (gitana)
            {
                var offsetPath = req.path;

                var virtualizedPath = null;
                var virtualizedNode = null;
                var virtualizedNodeExtra = null;
                var virtualizedUriExtra = null;
                var previewPath = null;
                var previewNode = null;
                var previewUriExtra = null;
                if (offsetPath.indexOf("/static/path/") === 0)
                {
                    virtualizedPath = offsetPath.substring(13);
                }
                else if (offsetPath.indexOf("/static/node/") === 0)
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
                else if (offsetPath.indexOf("/static/repository/") === 0)
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
                    if (x1 > -1)
                    {
                        branchId = z.substring(0, x1);

                        // advance to "thing" (either node or path)
                        z = z.substring(x1+1); // node/XYZ or path/1/2/3/4
                    }
                    else
                    {
                        branchId = z;
                        z = "";
                    }

                    // pluck off the thing
                    // "node" or "path" or "{filename}
                    x1 = z.indexOf("/");
                    var thing = null;
                    if (x1 > -1) {
                        thing = z.substring(0, x1);
                    } else {
                        thing = z;
                    }
                    if (thing === "node")
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
                    else if (thing === "path")
                    {
                        virtualizedPath = z.substring(x1+1);
                    }
                    else
                    {
                        virtualizedPath = req.query["path"];
                    }
                }
                else if (offsetPath.indexOf("/preview/path/") === 0)
                {
                    previewPath = offsetPath.substring(14);
                }
                else if (offsetPath.indexOf("/preview/node/") === 0)
                {
                    previewNode = offsetPath.substring(14);

                    // trim off anything extra...
                    var x = previewNode.indexOf("/");
                    if (x > 0)
                    {
                        previewNode = previewNode.substring(0,x);

                        // if preview node has "/" in it, then it is "<nodeId>/<filename>"
                        x1 = previewNode.indexOf("/");
                        if (x1 > -1) {
                            previewId = previewNode.substring(x1 + 1);
                            previewNode = previewNode.substring(0, x1);
                        }
                    }
                }
                else if (offsetPath.indexOf("/preview/repository/") === 0)
                {
                    // examples
                    //    /preview/repository/ABC/branch/DEF/node/XYZ
                    //    /preview/repository/ABC/branch/DEF/path/1/2/3/4
                    //    /preview/repository/ABC/branch/DEF/{previewId}?path={path}

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

                    // advance to "thing" (either node or path or preview ID)
                    z = z.substring(x1+1); // node/XYZ or path/1/2/3/4 or {previewId}

                    // pluck off the thing
                    // "node" or "path" or "{previewId}
                    x1 = z.indexOf("/");
                    var thing = null;
                    if (x1 > -1) {
                        thing = z.substring(0, x1);
                    } else {
                        thing = z;
                    }
                    if (thing === "node")
                    {
                        previewNode = z.substring(x1+1);

                        // if preview node has "/" in it, then it is "<nodeId>/<filename>"
                        x1 = previewNode.indexOf("/");
                        if (x1 > -1) {
                            previewId = previewNode.substring(x1 + 1);
                            previewNode = previewNode.substring(0, x1);
                        }
                    }
                    else if (thing == "path")
                    {
                        previewPath = z.substring(x1+1);
                    }
                    else
                    {
                        previewId = thing;
                        previewPath = req.query["path"];
                    }
                }
                else if ((offsetPath.indexOf("/static") === 0) || (offsetPath.indexOf("/preview") === 0))
                {
                    var isStatic = (offsetPath.indexOf("/static") === 0);
                    if (isStatic) {
                        virtualizedUriExtra = offsetPath.substring(7);
                        if (virtualizedUriExtra.indexOf("/") === 0) {
                            virtualizedUriExtra = virtualizedUriExtra.substring(1);
                        }
                    }
                    var isPreview = (offsetPath.indexOf("/preview") === 0);
                    if (isPreview) {
                        previewUriExtra = offsetPath.substring(8);
                        if (previewUriExtra.indexOf("/") === 0) {
                            previewUriExtra = previewUriExtra.substring(1);
                        }
                    }

                    var _repositoryId = req.query["repository"];
                    if (_repositoryId)
                    {
                        repositoryId = _repositoryId;
                    }

                    var _branchId = req.query["branch"];
                    if (_branchId)
                    {
                        branchId = _branchId;
                    }

                    var _node = req.query["node"];
                    if (_node)
                    {
                        if (isStatic) {
                            virtualizedNode = _node;
                        } else if (isPreview) {
                            previewNode = _node;
                        }
                    }

                    var _path = req.query["path"];
                    if (_path)
                    {
                        if (isStatic) {
                            virtualizedPath = _path;
                        } else if (isPreview) {
                            previewPath = _path;
                        }
                    }
                }

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
                    if (req.query["metadata"])
                    {
                        attachmentId = null;
                    }

                    // or override the attachmentId
                    if (req.query["attachment"])
                    {
                        attachmentId = req.query["attachment"];
                    }

                    // check whether there is a file matching this uri
                    if (nodePath && "/" === nodePath) {
                        nodePath = "index.html";
                    }

                    // the cache can be invalidated with either the "force" or "invalidate" request parameters
                    var forceCommand = req.query["force"] ? req.query["force"] : false;
                    var invalidateCommand = req.query["invalidate"] ? req.query["invalidate"] : false;
                    var forceReload = forceCommand || invalidateCommand;

                    // whether to set content disposition on response
                    var useContentDispositionResponse = false;
                    var a = req.query["a"];
                    if (a === "true") {
                        useContentDispositionResponse = true;
                    }
                    var filename = req.query["filename"];
                    if (filename) {
                        useContentDispositionResponse = true;
                    }

                    cloudcmsUtil.download(contentStore, gitana, repositoryId, branchId, nodeId, attachmentId, nodePath, locale, forceReload, function(err, filePath, cacheInfo, releaseLock) {

                        // if the file was found on disk or was downloaded, then stream it back
                        if (!err && filePath && cacheInfo)
                        {
                            if (useContentDispositionResponse)
                            {
                                var filename = resolveFilename(req, filePath, cacheInfo, requestedFilename);
                                contentStore.downloadFile(res, filePath, filename, function(err) {

                                    // something went wrong while streaming the content back...
                                    if (err)
                                    {
                                        util.status(res, 503);
                                        res.send(err);
                                        res.end();
                                    }

                                    releaseLock();
                                });
                            }
                            else
                            {
                                util.applyDefaultContentTypeCaching(res, cacheInfo);
                                //util.applyResponseContentType(res, cacheInfo, filePath);

                                contentStore.sendFile(res, filePath, cacheInfo, function(err) {

                                    if (err)
                                    {
                                        util.handleSendFileError(req, res, filePath, cacheInfo, req.log, err);
                                    }

                                    releaseLock();
                                });
                            }
                        }
                        else
                        {
                            if (err && err.invalidateGitanaDriver)
                            {
                                console.log("Found err.invalidateGitanaDriver true");
                                if (req.gitanaConfig)
                                {
                                    // at this point, our gitana driver's auth token was pronounced dead and we need to invalidate
                                    // to get a new one, so blow things away here
                                    // in terms of the current request, it is allowed to do the fallback
                                    // however the next request will go to the gitana.json and attempt to login
                                    // if that fails and virtual driver mode, then a new gitana.json will be pulled down
                                    if (req.gitanaConfig.key)
                                    {
                                        console.log("Disconnecting driver: " + req.gitanaConfig.key);
                                        try
                                        {
                                            Gitana.disconnect(req.gitanaConfig.key);
                                        }
                                        catch (e)
                                        {
                                        }
                                    }

                                    // remove from cache
                                    if (req.virtualHost)
                                    {
                                        console.log("Remove driver cache for virtual host: " + req.virtualHost);
                                        try
                                        {
                                            process.driverConfigCache.invalidate(req.virtualHost, function () {
                                                // all done
                                            });
                                        }
                                        catch (e)
                                        {
                                        }
                                    }
                                }
                            }

                            if (req.query["fallback"])
                            {
                                // redirect to the fallback
                                res.redirect(req.query["fallback"]);
                            }
                            else
                            {
                                // otherwise, allow other handlers to process this request
                                next();
                            }

                            releaseLock();
                        }

                    });
                }
                else if (previewPath || previewNode)
                {
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

                    if (!previewUriExtra && !previewId)
                    {
                        previewId = req.query["name"];
                    }

                    // mimetype (allow null or undefined)
                    var mimetype = req.query["mimetype"];

                    // determine attachment id
                    var attachmentId = "default";
                    if (req.query["attachment"])
                    {
                        attachmentId = req.query["attachment"];
                    }

                    var requestedFilename = null;
                    if (previewId)
                    {
                        requestedFilename = previewId;

                        var p = previewId.indexOf(".");
                        if (p > -1)
                        {
                            var extension = previewId.substring(p + 1);
                            if (extension)
                            {
                                // see if we can determine the requested mimetype from the file extension of the previewId
                                mimetype = util.lookupMimeType(extension);
                                //mimetype = mime.lookup(extension);
                            }
                            previewId = previewId.substring(0, p);
                        }
                    }

                    // note: mimetype can be null or undefined at this point
                    // server side will sort this out for us

                    // size
                    var size = req.query["size"] ? req.query["size"] : -1;
                    if (size && (typeof(size) == "string"))
                    {
                        size = parseInt(size, 10);
                    }

                    // force
                    var forceReload = req.query["force"] ? req.query["force"] : false;

                    // whether to set content disposition on response
                    var useContentDispositionResponse = false;
                    var a = req.query["a"];
                    if (a === "true") {
                        useContentDispositionResponse = true;
                    }
                    var filename = req.query["filename"];
                    if (filename) {
                        useContentDispositionResponse = true;
                    }

                    // the range requested (for streaming)
                    var range = req.headers["range"];

                    cloudcmsUtil.preview(contentStore, gitana, repositoryId, branchId, nodeId, nodePath, attachmentId, locale, previewId, size, mimetype, forceReload, function(err, filePath, cacheInfo, releaseLock) {

                        if (err)
                        {
                            req.log("Error on preview node: " + err.message + ", err: " + JSON.stringify(err));
                        }

                        // if the file was found on disk or was downloaded, then stream it back
                        if (!err && filePath && cacheInfo)
                        {
                            // disable the accept-ranges header
                            util.setHeader(res, "Accept-Ranges", "none");

                            if (useContentDispositionResponse)
                            {
                                var filename = resolveFilename(req, filePath, cacheInfo, requestedFilename);
                                contentStore.downloadFile(res, filePath, filename, function(err) {

                                    // something went wrong while streaming the content back...
                                    if (err) {
                                        util.status(res, 503);
                                        res.send(err);
                                        res.end();
                                    }

                                    releaseLock();
                                });
                            }
                            else
                            {
                                util.applyDefaultContentTypeCaching(res, cacheInfo);

                                // UZI: file deleted by invalidate before this gets called
                                contentStore.sendFile(res, filePath, cacheInfo, function(err) {

                                    if (err)
                                    {
                                        util.handleSendFileError(req, res, filePath, cacheInfo, req.log, err);
                                    }

                                    releaseLock();
                                });
                            }
                        }
                        else
                        {
                            if (req.query["fallback"])
                            {
                                // redirect to the fallback
                                res.redirect(req.query["fallback"]);
                            }
                            else
                            {
                                // otherwise, allow other handlers to process this request
                                next();
                            }

                            releaseLock();
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
        });
    };

    /**
     * Provides virtualized principal retrieval from Cloud CMS.
     *
     * This handler checks to see if the requested resource is already cached to disk.  If not, it makes an attempt
     * to retrieve the content from Cloud CMS (and cache to disk).
     *
     * If nothing found, this handler passes through, allowing other handlers downstream to serve back the content.
     *
     * URIs may include the following structures:
     *
     *    /static/principal/{principalId}
     *    /static/principal/{principalId}/{attachmentId}
     *    /static/principal/{principalId}/{attachmentId}/{filename}
     *    /static/domain/{domainId}/principal/{principalId}/
     *    /static/domain/{domainId}/principal/{principalId}/{attachmentId}
     *    /static/domain/{domainId}/principal/{principalId}/{attachmentId}/{filename}
     *    /preview/principal/{principalId}
     *    /preview/domain/{domainId}/principal/{principalId}
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
    r.virtualPrincipalHandler = function()
    {
        // bind listeners for broadcast events
        bindSubscriptions.call(this);

        return util.createHandler("virtualPrincipal", null, function(req, res, next, stores, cache, configuration) {

            var contentStore = stores.content;

            var domainId = req.domainId;
            var locale = req.locale;

            var previewId = null;

            var gitana = req.gitana;
            if (gitana)
            {
                var offsetPath = req.path;

                var virtualizedPrincipal = null;
                var virtualizedPrincipalExtra = null;
                var previewPrincipal = null;
                if (offsetPath.indexOf("/static/principal/") === 0)
                {
                    virtualizedPrincipal = offsetPath.substring(18);

                    // trim off anything extra...
                    var x = virtualizedPrincipal.indexOf("/");
                    if (x > 0)
                    {
                        virtualizedPrincipalExtra = virtualizedPrincipal.substring(x+1);
                        virtualizedPrincipal = virtualizedPrincipal.substring(0,x);
                    }
                }
                if (offsetPath.indexOf("/static/domain/") === 0)
                {
                    // examples
                    //    /static/domain/ABC/principal/DEF
                    //    /static/domain/ABC/principal/DEF/avatar
                    //    /static/domain/ABC/principal/DEF/avatar/avatar.jpg

                    var z = offsetPath.substring(15); // ABC/principal/DEF/avatar/avatar.jpg

                    // pluck off the domain id
                    var x1 = z.indexOf("/");
                    domainId = z.substring(0, x1);

                    // advance to principal
                    x1 = z.indexOf("/", x1+1);
                    virtualizedPrincipal = z.substring(x1+1); // DEF/avatar/avatar.jpg

                    // pluck off the principal id
                    x1 = virtualizedPrincipal.indexOf("/");
                    if (x1 > -1)
                    {
                        var z = virtualizedPrincipal;
                        virtualizedPrincipal = z.substring(0, x1);
                        virtualizedPrincipalExtra = z.substring(x1 + 1);
                    }
                }
                if (offsetPath.indexOf("/preview/principal/") === 0)
                {
                    previewPrincipal = offsetPath.substring(19);

                    // trim off anything extra...
                    var x = previewPrincipal.indexOf("/");
                    if (x > 0)
                    {
                        previewPrincipal = previewPrincipal.substring(0,x);
                    }
                }
                if (offsetPath.indexOf("/preview/domain/") === 0)
                {
                    // examples
                    //    /preview/domain/ABC/principal/DEF
                    //    /preview/domain/ABC/principal/DEF/avatar
                    //    /preview/domain/ABC/principal/DEF/avatar/avatar.jpg

                    var z = offsetPath.substring(16); // ABC/principal/DEF/avatar/avatar.jpg

                    // pluck off the domain id
                    var x1 = z.indexOf("/");
                    domainId = z.substring(0, x1);

                    // advance to principal
                    x1 = z.indexOf("/", x1+1);
                    previewPrincipal = z.substring(x1+1);

                    // pluck off the principal id
                    x1 = previewPrincipal.indexOf("/");
                    if (x1 > -1)
                    {
                        var z = previewPrincipal;
                        previewPrincipal = z.substring(0, x1);
                    }
                }

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
                // Virtual Principal is:
                //    /static/principal/{principalId}?options...
                //    /static/principal/GUID/tommy.jpg?options...
                //
                if (virtualizedPrincipal)
                {
                    var principalId = virtualizedPrincipal;
                    var requestedFilename = null;
                    var attachmentId = "default";

                    if (virtualizedPrincipal && virtualizedPrincipalExtra)
                    {
                        attachmentId = virtualizedPrincipalExtra;
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
                    if (req.query["metadata"])
                    {
                        attachmentId = null;
                    }

                    // or override the attachmentId
                    if (req.query["attachment"])
                    {
                        attachmentId = req.query["attachment"];
                    }

                    // the cache can be invalidated with either the "force" or "invalidate" request parameters
                    var forceCommand = req.query["force"] ? req.query["force"] : false;
                    var invalidateCommand = req.query["invalidate"] ? req.query["invalidate"] : false;
                    var forceReload = forceCommand || invalidateCommand;

                    // whether to set content disposition on response
                    var useContentDispositionResponse = false;
                    var a = req.query["a"];
                    if (a === "true") {
                        useContentDispositionResponse = true;
                    }

                    cloudcmsUtil.downloadAttachable(contentStore, gitana, "domain", domainId, "principal", principalId, attachmentId, locale, forceReload, function(err, filePath, cacheInfo, releaseLock) {

                        // if the file was found on disk or was downloaded, then stream it back
                        if (!err && filePath && cacheInfo)
                        {
                            if (useContentDispositionResponse)
                            {
                                var filename = resolveFilename(req, filePath, cacheInfo, requestedFilename);
                                contentStore.downloadFile(res, filePath, filename, function(err) {

                                    // something went wrong while streaming the content back...
                                    if (err) {
                                        util.status(res, 503);
                                        res.send(err);
                                        res.end();
                                    }

                                    releaseLock();
                                });
                            }
                            else
                            {
                                util.applyDefaultContentTypeCaching(res, cacheInfo);

                                contentStore.sendFile(res, filePath, cacheInfo, function(err) {

                                    if (err)
                                    {
                                        util.handleSendFileError(req, res, filePath, cacheInfo, req.log, err);
                                    }

                                    releaseLock();
                                });
                            }
                        }
                        else
                        {
                            if (req.query["fallback"])
                            {
                                // redirect to the fallback
                                res.redirect(req.query["fallback"]);
                            }
                            else
                            {
                                // otherwise, allow other handlers to process this request
                                next();
                            }

                            releaseLock();
                        }

                    });
                }
                else if (previewPrincipal)
                {
                    /*
                     Params are:

                     "name"
                     "mimetype"
                     "size"
                     "force"

                     Preview principal is:
                     /preview/principal/{principalId}?name={name}... rest of options
                     /preview/principal/GUID/tommy.jpg?name={name}... rest of options
                     */

                    // principal
                    var principalId = previewPrincipal;

                    if (!previewId)
                    {
                        previewId = req.query["name"];
                    }

                    // determine attachment id
                    var attachmentId = "default";
                    if (req.query["attachment"])
                    {
                        attachmentId = req.query["attachment"];
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
                    var size = req.query["size"] ? req.query["size"] : -1;
                    if (size && (typeof(size) == "string"))
                    {
                        size = parseInt(size, 10);
                    }

                    // mimetype (allow null or undefined)
                    var mimetype = req.query["mimetype"];

                    // force
                    var forceReload = req.query["force"] ? req.query["force"] : false;

                    // whether to set content disposition on response
                    var useContentDispositionResponse = false;
                    var a = req.query["a"];
                    if (a === "true") {
                        useContentDispositionResponse = true;
                    }

                    cloudcmsUtil.previewAttachable(contentStore, gitana, "domain", domainId, "principal", principalId, attachmentId, locale, previewId, size, mimetype, forceReload, function (err, filePath, cacheInfo, releaseLock) {

                        if (err)
                        {
                            req.log("Error on preview attachable: " + err.message + ", err: " + JSON.stringify(err));
                        }

                        // if the file was found on disk or was downloaded, then stream it back
                        if (!err && filePath && cacheInfo)
                        {
                            if (useContentDispositionResponse)
                            {
                                var filename = resolveFilename(req, filePath, cacheInfo, requestedFilename);
                                contentStore.downloadFile(res, filePath, filename, function (err) {

                                    // something went wrong while streaming the content back...
                                    if (err)
                                    {
                                        util.status(res, 503);
                                        res.send(err);
                                        res.end();
                                    }

                                    releaseLock();
                                });
                            }
                            else
                            {
                                util.applyDefaultContentTypeCaching(res, cacheInfo);

                                contentStore.sendFile(res, filePath, cacheInfo, function (err) {

                                    if (err)
                                    {
                                        util.handleSendFileError(req, res, filePath, cacheInfo, req.log, err);
                                    }

                                    releaseLock();
                                });
                            }
                        }
                        else
                        {
                            if (req.query["fallback"])
                            {
                                // redirect to the fallback
                                res.redirect(req.query["fallback"]);
                            }
                            else
                            {
                                // otherwise, allow other handlers to process this request
                                next();
                            }

                            releaseLock();
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
        });
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
        return function(req, res, next)
        {
            var handled = false;

            if (req.method.toLowerCase() === "post")
            {
                if (req.url.indexOf("/login") === 0)
                {
                    handleLogin(req, res, next);
                    handled = true;
                }
            }

            if (req.method.toLowerCase() === "post" || req.method.toLowerCase() === "get")
            {
                if (req.url.indexOf("/logout") === 0)
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
     * @param req
     * @param filePath
     * @param cacheInfo
     * @param requestedFilename
     */
    var resolveFilename = function(req, filePath, cacheInfo, requestedFilename)
    {
        var filename = req.query.filename;
        if (!filename)
        {
            filename = requestedFilename;
        }
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

    r.invalidateNode = function(host, repositoryId, branchId, nodeId, paths, callback)
    {
        var stores = require("../stores/stores");
        stores.produce(host, function (err, stores) {

            if (err) {
                return callback(err);
            }

            console.log("Invalidating node " + nodeId + " for hostname: " + host);

            cloudcmsUtil.invalidate(stores.content, repositoryId, branchId, nodeId, paths, function (err) {
                if (err) {
                    console.error("invalidate done. err: " + err);
                }
                console.log("invalidate done");
                callback(err);
            });
        });
    };

    var bound = false;
    var bindSubscriptions = function()
    {
        var self = this;

        if (process.broadcast && !bound)
        {
            process.broadcast.subscribe("node_invalidation", function (message, channel, invalidationDone) {
                console.log("cloudcms received node_invalidation message. " + JSON.stringify(message,null,2));

                if (!invalidationDone) {
                    invalidationDone = function() { };
                }

                var nodeId = message.nodeId;
                var branchId = message.branchId;
                var repositoryId = message.repositoryId;
                var host = message.host;
                var paths = message.paths || {};

                self.invalidateNode(host, repositoryId, branchId, nodeId, paths, function(err) {

                    if (message.isMasterBranch)
                    {
                        // for master branch, we make a second attempt using "master" as the branch ID
                        self.invalidateNode(host, repositoryId, "master", nodeId, paths, function(err) {
                            invalidationDone(err);
                        });
                    }
                    else
                    {
                        invalidationDone(err);
                    }

                });

            });

            bound = true;
        }
    };

    return r;
}();
