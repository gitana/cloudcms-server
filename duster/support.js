var async = require("async");
var path = require("path");
var fs = require("fs");

var util = require("../util/util");
var renditions = require("../util/renditions");

/**
 * Helper functions for Dust Tags
 *
 * @type {Function}
 */
exports = module.exports = function(dust)
{
    var r = {};

    // used to check whether a parameter is defined, meaning it has a value and the value is NON EMPTY.
    var isDefined = r.isDefined = function(thing)
    {
        return ( (typeof(thing) !== "undefined") && (thing !== "") );
    };

    /**
     * Determines whether to use the fragment cache.  We use this cache if we're instructed to and if we're in
     * production model.
     *
     * @returns {boolean}
     */
    var isFragmentCacheEnabled = r.isFragmentCacheEnabled = function()
    {
        if (!process.configuration.duster) {
            process.configuration.duster = {};
        }
        if (!process.configuration.duster.fragments) {
            process.configuration.duster.fragments = {};
        }
        if (typeof(process.configuration.duster.fragments.cache) === "undefined") {
            process.configuration.duster.fragments.cache = true;
        }

        if (process.env.FORCE_CLOUDCMS_DUST_FRAGMENT_CACHE === "true")
        {
            process.configuration.duster.fragments.cache = true;
        }
        else if (process.env.FORCE_CLOUDCMS_DUST_FRAGMENT_CACHE === "false")
        {
            process.configuration.duster.fragments.cache = false;
        }

        if (process.env.CLOUDCMS_APPSERVER_MODE !== "production") {
            process.configuration.duster.fragments.cache = false;
        }

        return process.configuration.duster.fragments.cache;
    };


    var resolveVariables = r.resolveVariables = function(variables, context, callback)
    {
        if (!variables) {
            callback();
            return;
        }

        if (variables.length === 0)
        {
            callback(null, []);
            return;
        }

        var resolvedVariables = [];

        var fns = [];
        for (var i = 0; i < variables.length; i++)
        {
            var fn = function(variable) {
                return function(done) {

                    dust.renderSource("" + variable, context, function (err, value) {

                        if (err) {
                            done(err);
                            return;
                        }

                        value = value.trim();

                        resolvedVariables.push(value);
                        done();
                    });

                }
            }(variables[i]);
            fns.push(fn);
        }

        async.series(fns, function(err) {
            callback(err, resolvedVariables);
        });
    };

    /**
     * Helper function that sets the dust cursor to flushable.
     * This is to get around an apparent bug with dust:
     *
     *    https://github.com/linkedin/dustjs/issues/303
     *
     * @param chunk
     * @param callback
     * @returns {*}
     */
    var map = r.map = function(chunk, callback)
    {
        var cursor = chunk.map(function(branch) {
            callback(branch);
        });
        cursor.flushable = true;

        return cursor;
    };

    /**
     * Helper function to end the chunk.  This is in place because it's unclear exactly what is needed to counter
     * the issue mentioned in:
     *
     *    https://github.com/linkedin/dustjs/issues/303
     *
     * At one point, it seemed that some throttling of the end() call was required.  It may still be at some point.
     * So for now, we use this helper method to end() since it lets us inject our own behaviors if needed.
     *
     * @param chunk
     * @param context
     * @param err
     */
    var end = r.end = function(chunk, context, err)
    {
        if (err)
        {
            chunk.setError(err);
        }

        chunk.end();
    };

    var _MARK_INSIGHT = r._MARK_INSIGHT = function(node, result)
    {
        if (result)
        {
            result.insightNode = node.getRepositoryId() + "/" + node.getBranchId() + "/" + node.getId();
        }
        else
        {
            console.log("WARN: result node should not be null");
            console.trace();
        }
    };


    //
    // tracker related stuff
    //

    var buildRequirements = r.buildRequirements  = function(context, requirements)
    {
        var badKeys = [];

        for (var key in requirements)
        {
            if (!requirements[key])
            {
                badKeys.push(key);
            }
        }

        for (var i = 0; i < badKeys.length; i++)
        {
            delete requirements[badKeys[i]];
        }

        // add in stuff from request if available
        var req = context.get("req");
        if (req)
        {
            if (req.repositoryId)
            {
                requirements["repository"] = req.repositoryId;
            }

            if (req.branchId)
            {
                requirements["branch"] = req.branchId;
            }
        }

        return requirements;
    };

    var handleCacheFragmentRead = r.handleCacheFragmentRead = function(context, fragmentId, requirements, callback)
    {
        if (!isFragmentCacheEnabled())
        {
            return callback();
        }

        var req = context.get("req");

        var contentStore = req.stores.content;

        var fragmentsBasePath = context.get("_fragments_base_path");
        if (!fragmentsBasePath) {
            fragmentsBasePath = path.join("duster", "repositories", req.repositoryId, "branches", req.branchId, "fragments");
        }

        // fragment cache key
        var fragmentCacheKey = util.generateFragmentCacheKey(fragmentId, requirements);

        // disk location
        var fragmentFilePath = path.join(fragmentsBasePath, fragmentCacheKey, "fragment.html");
        util.safeReadStream(contentStore, fragmentFilePath, function(err, stream) {
            callback(err, stream, fragmentFilePath);
        });
    };

    var handleCacheFragmentWrite = r.handleCacheFragmentWrite = function(context, fragmentDescriptor, fragmentDependencies, requirements, text, callback)
    {
        // if fragment cache not enabled, return right away
        if (!isFragmentCacheEnabled())
        {
            return callback();
        }

        var req = context.get("req");

        var contentStore = req.stores.content;

        var fragmentsBasePath = context.get("_fragments_base_path");
        if (!fragmentsBasePath) {
            fragmentsBasePath = path.join("duster", "repositories", req.repositoryId, "branches", req.branchId, "fragments");
        }

        // fragment cache key
        var fragmentCacheKey = util.generateFragmentCacheKey(fragmentDescriptor.fragmentId, requirements);

        // store this
        fragmentDescriptor.fragmentCacheKey = fragmentCacheKey;

        // mark the rendition
        if (fragmentDependencies)
        {
            renditions.markRendition(req, fragmentDescriptor, fragmentDependencies, function (err) {

                // if we got an error writing the rendition, then we have to roll back and invalidate disk cache
                if (err)
                {
                    var fragmentFolderPath = path.join(fragmentsBasePath, fragmentCacheKey);

                    console.log("Caught error on fragment markRendition, invalidating: " + fragmentFolderPath + ", err:" + err);

                    _handleCacheFragmentInvalidate(contentStore, fragmentFolderPath, function() {
                        // done
                    });
                }

            });
        }

        // disk location
        var fragmentFilePath = path.join(fragmentsBasePath, fragmentCacheKey, "fragment.html");
        contentStore.writeFile(fragmentFilePath, text, function(err) {
            callback(err, fragmentFilePath);
        });
    };

    var handleCacheFragmentInvalidate = r.handleCacheFragmentInvalidate = function(host, fragmentsBasePath, fragmentCacheKey, callback)
    {
        var fragmentFolderPath = path.join(fragmentsBasePath, fragmentCacheKey);

        // list all of the hosts
        var stores = require("../middleware/stores/stores");
        stores.produce(host, function (err, stores) {

            if (err) {
                return callback(err, fragmentFolderPath);
            }

            _handleCacheFragmentInvalidate(stores.content, fragmentFolderPath, function(err, fragmentFolderPath) {
                return callback(null, fragmentFolderPath);
            });
        });
    };

    var _handleCacheFragmentInvalidate = function(contentStore, fragmentFolderPath, callback)
    {
        contentStore.existsDirectory(fragmentFolderPath, function (exists) {

            if (!exists) {
                return callback();
            }

            contentStore.removeDirectory(fragmentFolderPath, function () {
                callback();
            });
        });
    };

    var loadFragment = r.loadFragment = function(context, fragmentId, requirements, callback)
    {
        if (!isFragmentCacheEnabled())
        {
            return callback();
        }

        if (!fragmentId)
        {
            return callback();
        }

        var req = context.get("req");

        handleCacheFragmentRead(context, fragmentId, requirements, function(err, readStream, readPath) {

            if (!err && readStream)
            {
                // yes, we found it in cache, so we'll simply pipe it back from disk
                req.log("Dust Fragment Cache Hit - path: " + readPath);

                // read stream in
                var bufs = [];
                readStream.on('data', function(d){ bufs.push(d);});
                readStream.on('end', function(){

                    var fragment = "" + Buffer.concat(bufs).toString();

                    callback(null, fragment);
                });

                return;
            }

            callback({
                "message": "Unable to read fragment: " + fragmentId
            });

        });
    };

    var renderFragment = r.renderFragment = function(context, fragmentId, requirements, chunk, bodies, callback)
    {
        if (!isFragmentCacheEnabled() || !fragmentId)
        {
            chunk.render(bodies.block, context);
            end(chunk, context);

            return callback();
        }

        var c = chunk.capture(bodies.block, context, function(text, chunk2) {

            // we leave a timeout here so that things can catch up internally within Dust (more oddness!)
            setTimeout(function() {

                // for reasons that have everything to do with Dust oddness...
                // write to "c" and be sure to end "c" then "chunk2"
                c.write(text);
                c.end();
                chunk2.end();
                // NOTE: normally, we'd expect to do something like this
                //chunk2.write(text);
                //end(chunk2);
                // but this doesn't work and it has something to do with dust.map and chunk.capture intermingling weirdly

                // now let's cache it
                var fragmentDescriptor = {};
                var pageDescriptor = context.get("_page_descriptor");
                if (pageDescriptor) {
                    fragmentDescriptor = JSON.parse(JSON.stringify(pageDescriptor));
                }
                fragmentDescriptor.fragmentId = fragmentId;
                fragmentDescriptor.scope = "FRAGMENT";

                var tracker = context.get("__tracker");

                var fragmentDependencies = {};
                fragmentDependencies.requires = tracker.requires;
                fragmentDependencies.produces = tracker.produces;

                // write to cache
                handleCacheFragmentWrite(context, fragmentDescriptor, fragmentDependencies, requirements, text, function(err, writtenPath) {

                    if (err) {
                        console.log("Fragment cache write failed");
                        console.log(err);
                        return callback(err);
                    }

                    console.log("Successfully wrote to cache - path: " + writtenPath + " (" + text.length + " chars)");

                    callback();
                });
            }, 1);
        });

        return c;
    };

    var addHelpers = r.addHelpers = function(app, dust, filepaths, callback) {

        var fns = [];
        for (var i = 0; i < filepaths.length; i++)
        {
            var fn = function(filepath, app, dust) {
                return function(done) {

                    require(filepath)(app, dust, function() {
                        //console.log("Loaded dust helper: " + filepath);
                        done();
                    });
                }
            }(filepaths[i], app, dust);
            fns.push(fn);
        }

        async.series(fns, function() {
            callback();
        });

    };

    return r;
};
