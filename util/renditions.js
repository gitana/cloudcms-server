var path = require('path');
var fs = require('fs');
var util = require("../util/util");
var async = require("async");
var request = require("request");

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
                    callback(err);
                    return;
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
                    "repositoryId": branch.getRepositoryId(),
                    "branchId": branch.getId(),
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
                //console.log(JSON.stringify(pageRenditionObject, null, "  "));

                var URL = process.env.GITANA_PROXY_SCHEME + "://" + process.env.GITANA_PROXY_HOST + ":" + process.env.GITANA_PROXY_PORT + "/applications/" + applicationId + "/deployments/" + deploymentKey + "/pagerenditions";

                request({
                    "method": "POST", "url": URL, "qs": {}, "json": renditionObject, "headers": headers
                }, function (err, response, body) {

                    //console.log("Response error: " + JSON.stringify(err));
                    //console.log("Response: " + response);
                    //console.log("Body: " + body);
                    //console.log("Body2: " + JSON.stringify(body));

                    if (err)
                    {
                        // failed to add the page rendition
                        callback(err);
                        return;
                    }

                    callback();
                });

            });
        });
    };

    return r;
}();

