var path = require('path');
var fs = require('fs');
var util = require("../util/util");
var async = require("async");
var request = require("request");

var http = require("http");
var https = require("https");

/**
 * WCM Resource Dependency Manager
 *
 * Tracks page renditions and their dependencies.
 * Calls over to Cloud CMS to store page renditions.
 *
 * @type {Function}
 */
exports = module.exports = function()
{
    var isRenditionsEnabled = function()
    {
        if (!process.configuration.renditions) {
            process.configuration.renditions = {};
        }
        if (typeof(process.configuration.renditions.enabled) === "undefined") {
            if (process.env.CLOUDCMS_APPSERVER_MODE === "production")
            {
                console.log("App Server running in production mode, renditions not defined, defaulting to: true");
                process.configuration.renditions.enabled = true;
            }
        }

        if (process.env.FORCE_CLOUDCMS_RENDITIONS_ENABLED === "true")
        {
            process.configuration.renditions.enabled = true;
        }

        return process.configuration.renditions.enabled;
    };

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    /**
     * Marks a page cache element as dependent on a set of dependencies.
     *
     * This calls over to Cloud CMS to register a page rendition described by "descriptor" as being dependent on the "dependencies".
     *
     * The descriptor structure is:
     *
     *  {
     *      "url": req.url,
     *      "host": req.host,
     *      "path": offsetPath,
     *      "params": req.params,
     *      "headers": req.headers,
     *      "tokens": tokens,
     *      "matchingPath": matchingPath,
     *      "pageId": page._doc,
     *      "scope": scope (either "PAGE" or "FRAGMENT")
     *  }
     *
     *  And dependencies are:
     *
     *  {
     *      "requires": {
     *         "locale": ["en-US"]
     *      },
     *      "produces": {
     *         "node": ["abc123", "def456"]
     *      }
     *  }
     *
     * @type {Function}
     */
    var markRendition = r.markRendition = function(req, descriptor, dependencies, callback)
    {
        // if renditions aren't enabled, don't bother sending back
        if (!isRenditionsEnabled())
        {
            return;
        }

        // empty dependencies if not defined
        if (!dependencies) {
            dependencies = {};
        }

        // noop callback if not defined
        if (!callback) {
            callback = function() { };
        }

        req.branch(function(err, branch) {

            req.application(function (err, application) {

                if (err)
                {
                    return callback(err);
                }

                var applicationId = application._doc;

                var deploymentKey = "default";
                if (req.descriptor && req.descriptor.deploymentKey)
                {
                    deploymentKey = req.descriptor.deploymentKey;
                }

                // the descriptor contains "path", "params" and "headers".  We use this to generate a unique key.
                // essentially this is a hash and acts as the page cache key
                var pageCacheKey = util.generatePageCacheKey(descriptor);

                // headers
                var headers = {};

                // add "authorization" for OAuth2 bearer token
                var headers2 = req.gitana.platform().getDriver().getHttpHeaders();
                headers["Authorization"] = headers2["Authorization"];

                var renditionObject = {
                    "deploymentKey": deploymentKey,
                    "key": pageCacheKey,
                    "page": {
                        "id": descriptor.matchingPageId,
                        "title": descriptor.matchingPageTitle,
                        "url": descriptor.matchingUrl,
                        "path": descriptor.matchingPath,
                        "tokens": descriptor.tokens,
                        "attributes": descriptor.pageAttributes ? descriptor.pageAttributes : {}
                    },
                    "pageCacheKey": pageCacheKey,
                    "request": {
                        "url": descriptor.url,
                        "path": descriptor.path,
                        "host": descriptor.host,
                        "protocol": descriptor.protocol,
                        "headers": descriptor.headers,
                        "params": descriptor.params
                    },
                    "dependencies": dependencies,
                    "active": true,
                    "scope": "PAGE"
                };

                renditionObject.repositoryId = branch.getRepositoryId();
                renditionObject.branchId = branch.getId();

                if (descriptor.scope)
                {
                    renditionObject.scope = descriptor.scope;
                }
                if (descriptor.fragmentId)
                {
                    renditionObject.fragmentId = descriptor.fragmentId;
                    renditionObject.fragmentCacheKey = descriptor.fragmentCacheKey;
                    renditionObject.key = descriptor.fragmentCacheKey;
                }

                //console.log("PAGE RENDITION OBJECT");
                //console.log(JSON.stringify(renditionObject, null, "  "));

                var URL = util.asURL(process.env.GITANA_PROXY_SCHEME, process.env.GITANA_PROXY_HOST, process.env.GITANA_PROXY_PORT) + "/applications/" + applicationId + "/deployments/" + deploymentKey + "/pagerenditions";
                //console.log("URL: " + URL);

                //console.log("Mark Rendition: " + JSON.stringify(renditionObject, null, "  "));

                var agent = http.globalAgent;
                if (process.env.GITANA_PROXY_SCHEME === "https")
                {
                    agent = https.globalAgent;
                }

                request({
                    "method": "POST",
                    "url": URL,
                    "qs": {},
                    "json": renditionObject,
                    "headers": headers,
                    "timeout": process.defaultHttpTimeoutMs,
                    "agent": agent
                }, function (err, response, body) {

                    if (err)
                    {
                        // failed to add the page rendition
                        console.log("WARNING: failed to add the page rendition\n" + JSON.stringify(renditionObject,null,2));
                        return callback(err);
                    }

                    console.log("Done writing page rendition\n" + JSON.stringify(renditionObject,null,2));
                    callback();
                });

            });
        });
    };

    return r;
}();

