var path = require('path');
var fs = require('fs');
var util = require("../../util/util");
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
     * Marks a resource as dependent on a set of dependencies.  This calls over to Cloud CMS to register a page rendition
     * described by "descriptor" as being dependent on the "dependencies".
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
     *      "pageId": page._doc
     *  }
     *
     * @type {Function}
     */
    var add = r.add = function(req, descriptor, dependencies, callback)
    {
        // empty dependencies if not defined
        if (!dependencies) {
            dependencies = {};
        }

        // noop callback if not defined
        if (!callback) {
            callback = function() { };
        }

        req.application(function(err, application) {

            if (err) {
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

            var pageRenditionObject = {
                "deploymentKey": deploymentKey,
                "key": pageCacheKey,
                "page": {
                    "id": descriptor.matchingPageId,
                    "title": descriptor.matchingPageTitle,
                    "url": descriptor.matchingUrl,
                    "path": descriptor.matchingPath,
                    "tokens": descriptor.tokens
                },
                "request": {
                    "url": descriptor.url,
                    "path": descriptor.path,
                    "host": descriptor.host,
                    "protocol": descriptor.protocol,
                    "headers": descriptor.headers,
                    "params": descriptor.params
                },
                "dependencies": dependencies,
                "active": true
            };

            //console.log("PAGE RENDITION OBJECT");
            //console.log(JSON.stringify(pageRenditionObject, null, "  "));

            var URL = process.env.GITANA_PROXY_SCHEME + "://" + process.env.GITANA_PROXY_HOST + ":" + process.env.GITANA_PROXY_PORT + "/applications/" + applicationId + "/deployments/" + deploymentKey + "/pagerenditions";

            request({
                "method": "POST",
                "url": URL,
                "qs": {},
                "json": pageRenditionObject,
                "headers": headers
            }, function(err, response, body) {

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
    };

    var remove = r.remove = function(req, resource, callback)
    {
        var contentStore = req.stores.content;

        // read all dependencies for this resource
        var dependenciesFilePath = path.join("dependencies", "repositories", req.repositoryId, "branches", req.branchId, "resources", resource, "dependencies.json");
        contentStore.readFile(dependenciesFilePath, function(err, data) {

            var dependenciesJson = JSON.parse("" + data);

            var fns = [];
            for (var key in dependenciesJson)
            {
                var array = dependenciesJson[key];

                for (var i = 0; i < array.length; i++)
                {
                    var fn = function (req, key, value) {
                        return function (done) {
                            invalidateResourcesWithDependency(req, key, value, function (err) {
                                done(err);
                            });
                        }
                    }(req, key, array[i]);
                    fns.push(fn);
                }
            }

            async.series(fns, function(err) {
                callback(err);
            });
        });
    };

    var findDependentOn = r.findDependentOn = function(req, key, value, callback)
    {
        var contentStore = req.stores.content;

        // the dependency directory
        var dependencyDirectoryPath = path.join("dependencies", "repositories", req.repositoryId, "branches", req.branchId, "dependencies", key, value);

        // list all resource descriptors
        contentStore.listFiles(dependencyDirectoryPath, function(err, filenames) {

            var resources = [];

            var fns = [];
            for (var i = 0; i < filenames.length; i++)
            {
                var fn = function(req, dependencyDirectoryPath, filename, resources) {
                    return function(done) {

                        var resourceDescriptorFilePath = path.join(dependencyDirectoryPath, filename);
                        contentStore.existsFile(resourceDescriptorFilePath, function(exists) {

                            if (!exists) {
                                done();
                                return;
                            }

                            contentStore.readFile(resourceDescriptorFilePath, function (err, data) {

                                if (err) {
                                    done();
                                    return;
                                }

                                try
                                {
                                    var json = JSON.parse("" + data);
                                    var resource = json.resource;

                                    resources.push(resource);
                                }
                                catch (e) {
                                    // oh well
                                }

                                done();
                            });
                        });

                    };
                }(req, dependencyDirectoryPath, filenames[i], resources);
                fns.push(fn);
            }

            async.series(fns, function(err) {
                callback(err, resources);
            });

        });
    };

    var removeDependency = r.removeDependency = function(req, key, value, callback)
    {
        var contentStore = req.stores.content;

        // the dependency directory
        var dependencyDirectoryPath = path.join("dependencies", "repositories", req.repositoryId, "branches", req.branchId, "dependencies", key, value);

        contentStore.existsDirectory(dependencyDirectoryPath, function(exists) {

            if (!exists)
            {
                callback();
                return;
            }

            contentStore.removeDirectory(dependencyDirectoryPath, function(err) {
                callback(err);
            });
        });
    };

    var invalidateResourcesWithDependency = r.invalidateResourcesWithDependency = function(req, key, value, callback)
    {
        var contentStore = req.stores.content;

        // the dependency directory
        var dependencyDirectoryPath = path.join("dependencies", "repositories", req.repositoryId, "branches", req.branchId, "dependencies", key, value);

        // list all resource descriptors
        contentStore.listFiles(dependencyDirectoryPath, function(err, filenames) {

            var fns = [];
            for (var i = 0; i < filenames.length; i++)
            {
                var fn = function(req, dependencyDirectoryPath, filename) {
                    return function(done) {

                        var resourceDescriptorFilePath = path.join(dependencyDirectoryPath, filename);
                        contentStore.existsFile(resourceDescriptorFilePath, function(exists) {

                            if (!exists) {
                                done();
                                return;
                            }

                            contentStore.readFile(resourceDescriptorFilePath, function (err, data) {

                                if (err) {
                                    done();
                                    return;
                                }

                                try
                                {
                                    var json = JSON.parse("" + data);
                                    var uri = json.uri;

                                    // remove the resource descriptor
                                    contentStore.deleteFile(resourceDescriptorFilePath, function(err) {

                                        // invalidate the resource
                                        remove(req, uri, function(err) {
                                            done(err);
                                        });
                                    });
                                }
                                catch (e) {
                                    // oh well
                                }
                            });
                        });

                    };
                }(req, dependencyDirectoryPath, filenames[i]);
                fns.push(fn);
            }

            async.series(fns, function(err) {
                callback(err);
            });

        });
    };

    return r;
}();

