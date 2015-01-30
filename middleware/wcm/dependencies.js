var path = require('path');
var fs = require('fs');
var util = require("../../util/util");
var async = require("async");

/**
 * Lightweight store-based dependencies management.
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
     * Adds a resource and marks it as dependent upon the given set of dependencies (key/value pairs).
     *
     * The resource can be a string or a path separated URI.
     *
     * @type {Function}
     */
    var add = r.add = function(req, resource, dependencies, callback)
    {
        var contentStore = req.stores.content;

        // write page -> dependencies cache entry
        var dependenciesCount = 0;
        for (var key in dependencies)
        {
            dependenciesCount++;
        }

        if (dependenciesCount > 0)
        {
            var dependenciesFilePath = path.join("dependencies", "repositories", req.repositoryId, "branches", req.branchId, "resources", resource, "dependencies.json");
            contentStore.writeFile(dependenciesFilePath, JSON.stringify(keys, null, "   "), function (err) {

                if (err) {
                    callback(err);
                    return;
                }

                // write dependency -> page cache entries
                var fns = [];
                for (var key in dependencies)
                {
                    var value = dependencies[key];

                    var fn = function (contentStore, req, key, value) {
                        return function (done) {

                            var resourceJson = {
                                "resource": resource
                            };

                            var filename = util.hashcode(resource);

                            var resourceJsonPath = path.join("dependencies", "repositories", req.repositoryId, "branches", req.branchId, "dependencies", key, value, filename + ".json");

                            contentStore.writeFile(resourceJsonPath, JSON.stringify(resourceJson, null, "  "), function (err) {
                                done();
                            });
                        }
                    }(contentStore, req, key, value);
                    fns.push(fn);
                }

                async.series(fns, function (err) {
                    callback(err);
                });
            });
        }
        else
        {
            callback();
        }
    };

    var remove = r.remove = function(req, resource, callback)
    {
        var contentStore = req.stores.content;

        // read all dependencies
        var dependenciesFilePath = path.join("dependencies", "repositories", req.repositoryId, "branches", req.branchId, "resources", resource, "dependencies.json");
        contentStore.readFile(dependenciesFilePath, function(err, data) {

            var dependenciesJson = JSON.parse("" + data);

            var fns = [];
            for (var key in dependenciesJson)
            {
                var value = dependenciesJson[key];

                var fn = function(req, key, value)
                {
                    return function(done)
                    {
                        invalidateResourcesWithDependency(req, key, value, function(err) {
                            done(err);
                        });
                    }
                }(req, key, value);
                fns.push(fn);
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

    /*
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
                                        invalidateResource(req, uri, function(err) {
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
    */

    return r;
}();

