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

exports = module.exports = function()
{
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

                try
                {
                    res.status(503);
                    res.send({
                        "ok": false,
                        "message": info.message
                    });
                }
                catch (e)
                {
                    console.log("handleLogin error");
                    console.log(e);
                    return;
                }
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

                res.status(200);
                res.send({
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

        res.status(200);
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
        return function(req, res, next)
        {
            if (req.gitana && req.gitana.datastore)
            {
                var repository = req.gitana.datastore("content");
                if (repository)
                {
                    req.repositoryId = repository.getId();

                    // helper function
                    req.repository = function(callback)
                    {
                        if (req._repository)
                        {
                            callback(null, req._repository);
                            return;
                        }

                        req.gitana.datastore("content").then(function() {
                            req._repository = this;
                            callback(null, this);
                        });
                    };
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

                // helper function
                req.branch = function(callback)
                {
                    if (req._branch)
                    {
                        callback(null, Chain(req._branch));
                        return;
                    }

                    req.repository(function(err, repository) {
                        Chain(repository).readBranch(req.branchId).then(function() {
                            req._branch = this;
                            callback(null, req._branch);
                        });
                    });
                };
            }

            next();
        }
    };

    /**
     * Determines which gitana domain to use in future operations.
     *
     * @return {Function}
     */
    r.domainInterceptor = function()
    {
        return function(req, res, next)
        {
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
        }
    };

    /**
     * Determines which gitana domain to use in future operations.
     *
     * @return {Function}
     */
    r.applicationInterceptor = function()
    {
        return function(req, res, next)
        {
            if (req.gitana && req.gitana.datastore)
            {
                var application = req.gitana.application();
                if (application)
                {
                    req.applicationId = application.getId();
                }

                // helper function
                req.application = function(callback) {
                    callback(null, application);
                };
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
     *    /preview/node/{nodeId}/{previewId}
     *    /preview/repository/{repositoryId}/branch/{branchId}/node/{nodeId}/{previewId}
     *    /preview/repository/{repositoryId}/branch/{branchId}/path/A/B/C/D/{previewId}
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
        return util.createHandler("virtualContent", function(req, res, next, configuration, stores) {

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

                        // if preview node has "/" in it, then it is "<nodeId>/<filename>"
                        x1 = previewNode.indexOf("/");
                        if (x1 > -1) {
                            previewId = previewNode.substring(x1 + 1);
                            previewNode = previewNode.substring(0, x1);
                        }
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
                    if (a === "true") {
                        useContentDispositionResponse = true;
                    }

                    cloudcmsUtil.download(contentStore, gitana, repositoryId, branchId, nodeId, attachmentId, nodePath, locale, forceReload, function(err, filePath, cacheInfo) {

                        // if the file was found on disk or was downloaded, then stream it back
                        if (!err && filePath && cacheInfo)
                        {
                            var filename = resolveFilename(filePath, cacheInfo, requestedFilename);

                            if (useContentDispositionResponse)
                            {
                                contentStore.downloadFile(res, filePath, filename, function(err) {

                                    // something went wrong while streaming the content back...
                                    if (err)
                                    {
                                        res.status(503);
                                        res.send(err);
                                        res.end();
                                    }

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

                    if (!previewId)
                    {
                        previewId = req.param("name");
                    }

                    // mimetype (allow null or undefined)
                    var mimetype = req.param("mimetype");

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
                            var extension = previewId.substring(p + 1);
                            if (extension)
                            {
                                // see if we can determine the requested mimetype from the file extension of the previewId
                                mimetype = mime.lookup(extension);
                            }
                            previewId = previewId.substring(0, p);
                        }
                    }

                    // note: mimetype can be null or undefined at this point
                    // server side will sort this out for us

                    // size
                    var size = req.param("size") ? req.param("size") : -1;
                    if (size && (typeof(size) == "string"))
                    {
                        size = parseInt(size, 10);
                    }

                    // force
                    var forceReload = req.param("force") ? req.param("force") : false;

                    // whether to set content disposition on response
                    var useContentDispositionResponse = false;
                    var a = req.param("a");
                    if (a == "true") {
                        useContentDispositionResponse = true;
                    }

                    cloudcmsUtil.preview(contentStore, gitana, repositoryId, branchId, nodeId, nodePath, attachmentId, locale, previewId, size, mimetype, forceReload, function(err, filePath, cacheInfo) {

                        if (err)
                        {
                            req.log("Error on preview node: " + err.message);
                        }

                        // if the file was found on disk or was downloaded, then stream it back
                        if (!err && filePath && cacheInfo)
                        {
                            var filename = resolveFilename(filePath, cacheInfo, requestedFilename);

                            if (useContentDispositionResponse)
                            {
                                contentStore.downloadFile(res, filePath, filename, function(err) {

                                    // something went wrong while streaming the content back...
                                    if (err) {
                                        res.status(503);
                                        res.send(err);
                                        res.end();
                                    }

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
        return util.createHandler("virtualContent", function(req, res, next, configuration, stores) {

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
                    if (req.param("metadata"))
                    {
                        attachmentId = null;
                    }

                    // or override the attachmentId
                    if (req.param("attachment"))
                    {
                        attachmentId = req.param("attachment");
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

                    cloudcmsUtil.downloadAttachable(contentStore, gitana, "domain", domainId, "principal", principalId, attachmentId, locale, forceReload, function(err, filePath, cacheInfo) {

                        // if the file was found on disk or was downloaded, then stream it back
                        if (!err && filePath && cacheInfo)
                        {
                            var filename = resolveFilename(filePath, cacheInfo, requestedFilename);

                            if (useContentDispositionResponse)
                            {
                                contentStore.downloadFile(res, filePath, filename, function(err) {

                                    // something went wrong while streaming the content back...
                                    if (err) {
                                        res.status(503);
                                        res.send(err);
                                        res.end();
                                    }

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

                    // mimetype (allow null or undefined)
                    var mimetype = req.param("mimetype");

                    // force
                    var forceReload = req.param("force") ? req.param("force") : false;

                    // whether to set content disposition on response
                    var useContentDispositionResponse = false;
                    var a = req.param("a");
                    if (a == "true") {
                        useContentDispositionResponse = true;
                    }

                    cloudcmsUtil.previewAttachable(contentStore, gitana, "domain", domainId, "principal", principalId, attachmentId, locale, previewId, size, mimetype, forceReload, function(err, filePath, cacheInfo) {

                        if (err)
                        {
                            req.log("Error on preview attachable: " + err.message);
                        }

                        // if the file was found on disk or was downloaded, then stream it back
                        if (!err && filePath && cacheInfo)
                        {
                            var filename = resolveFilename(filePath, cacheInfo, requestedFilename);

                            if (useContentDispositionResponse)
                            {
                                contentStore.downloadFile(res, filePath, filename, function(err) {

                                    // something went wrong while streaming the content back...
                                    if (err) {
                                        res.status(503);
                                        res.send(err);
                                        res.end();
                                    }

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

    r.invalidateNode = function(repositoryId, branchId, nodeId, callback)
    {
        var stores = require("../stores/stores");
        stores.listHosts("content", function(err, hostnames) {

            var fns = [];
            for (var i = 0; i < hostnames.length; i++)
            {
                var hostname = hostnames[i];

                var fn = function(hostname, repositoryId, branchId, nodeId)
                {
                    return function(done)
                    {
                        stores.produce(hostname, function (err, stores) {

                            if (err) {
                                done(err);
                                return;
                            }

                            cloudcmsUtil.invalidate(stores.content, repositoryId, branchId, nodeId, function () {
                                done();
                            });
                        });

                    }
                }(hostname, repositoryId, branchId, nodeId);
                fns.push(fn);
            }

            async.series(fns, function(err) {
                if (callback)
                {
                    callback(err);
                }
            });

        });
    };

    return r;
}();

