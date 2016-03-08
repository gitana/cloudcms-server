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

    var isDefined = r.isDefined = function(thing)
    {
        return (typeof(thing) !== "undefined");
    };

    /**
     * Determines whether to use the fragment cache.  We use this cache if we're instructed to and if we're in
     * production model.
     *
     * @returns {boolean}
     */
    var isFragmentCacheEnabled = function()
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
     */
    var end = r.end = function(chunk, context)
    {
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
            if (!requirements[key]) {
                badKeys.push(key);
            }
        }

        for (var i = 0; i < badKeys.length; i++) {
            delete requirements[badKeys[i]];
        }

        // add in stuff from request if available
        var req = context.get("req");
        if (req)
        {
            if (req.repositoryId) {
                requirements["repository"] = req.repositoryId;
            }
            if (req.branchId) {
                requirements["branch"] = req.branchId;
            }
        }

        return requirements;
    };

    var handleCacheFragmentRead = function(context, fragmentId, requirements, callback)
    {
        if (!isFragmentCacheEnabled())
        {
            callback();
            return;
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
        var fragmentFilePath = path.join(fragmentsBasePath, fragmentId, fragmentCacheKey, "fragment.html");
        util.safeReadStream(contentStore, fragmentFilePath, function(err, stream) {
            callback(err, stream);
        });
    };

    var handleCacheFragmentWrite = function(context, fragmentDescriptor, fragmentDependencies, requirements, text, callback)
    {
        if (!isFragmentCacheEnabled())
        {
            callback();
            return;
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

        // disk location
        var fragmentFilePath = path.join(fragmentsBasePath, fragmentDescriptor.fragmentId, fragmentCacheKey, "fragment.html");
        contentStore.writeFile(fragmentFilePath, text, function(err) {

            if (err)
            {
                callback(err);
                return;
            }

            renditions.markRendition(req, fragmentDescriptor, fragmentDependencies, function(err) {
                callback(err);
            });

        });
    };

    var serveFragment = r.serveFragment = function(context, chunk, fragmentId, requirements, callback)
    {
        if (!isFragmentCacheEnabled())
        {
            return callback(null, true);
        }

        if (!fragmentId) {
            return callback(null, true);
        }

        var req = context.get("req");

        handleCacheFragmentRead(context, fragmentId, requirements, function(err, readStream) {

            if (!err && readStream)
            {
                // yes, we found it in cache, so we'll simply pipe it back from disk
                req.log("Dust Fragment Cache Hit: " + fragmentId);

                // read stream in
                var text = "";
                var bufs = [];
                readStream.on('data', function(d){ bufs.push(d); });
                readStream.on('end', function(){
                    var buf = Buffer.concat(bufs);

                    var text = "" + buf.toString();

                    console.log("read stream done: " + text);

                    chunk.write(text);
                    end(chunk, context);

                    callback();
                });

                return;
            }

            callback({
                "message": "Unable to read fragment"
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

        // otherwise, trap the output stream so that we can cache to disk

        var curChunk = chunk.data.join() || ""; // Capture anything in chunk prior to this helper
        chunk.data = []; // Empty current chunk
        var body = bodies.block(chunk, context).data.join() || "";

        var text = curChunk + body;

        // write to dust.js chunk
        chunk.write(text);
        end(chunk, context);

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
        handleCacheFragmentWrite(context, fragmentDescriptor, fragmentDependencies, requirements, text, function(err) {

            if (err) {
                console.log("Fragment cache write failed");
                console.log(err);
                callback(err);
                return;
            }

            console.log("Successfully wrote to cache: " + fragmentDescriptor.fragmentId + ", text: " + text);

            callback();
        });
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
