var path = require('path');
var fs = require('fs');
var http = require('http');
var util = require("../../util/util");
var Gitana = require("gitana");

var Loaders = require("../../util/loaders");

/**
 * Runtime middleware.
 *
 * @type {Function}
 */
exports = module.exports = function()
{
    var completionFn = function(err, res, data)
    {
        if (err)
        {
            res.send({
                "ok": false,
                "message": err.message,
                "err": err
            });
            res.end();
            return;
        }

        if (!data) {
            data = {};
        }

        var x = util.clone(data, true);
        x.ok = true;

        // respond with ok
        res.status(200).send(x).end();
    };

    /**
     * Migrates the current host to the given branch/release.
     *
     * JSON should look like:
     *
     *  {
     *      "branchId": "ASD",
     *      "releaseId": "ASD",
     *      "cb": "ASD"
     *  }
     *
     * @param req
     * @param host
     * @param json
     * @param callback
     */
    var doMigrate = function(req, json, callback)
    {
        var data = {};

        // generate a cache buster (in case we're in production mode)
        data.cb = Date.now();
        if (json.cb) {
            data.cb = json.cb;
        }

        // pick up release id
        data.releaseId = null;
        if (json.releaseId) {
            data.releaseId = json.releaseId;
        }

        // pick up branch id
        data.branchId = null;
        if (json.branchId) {
            data.branchId = json.branchId;
        }

        // write a new runtime file
        req.stores.content.writeFile("runtime.json", JSON.stringify(data, null, "  "), function(err) {
            callback(err);
        });
    };

    var TEMPLATE_RUNTIME_BRANCHES = "" + fs.readFileSync(path.join(__dirname, "../../templates/runtime_branches.html"));
    var TEMPLATE_RUNTIME_RELEASES = "" + fs.readFileSync(path.join(__dirname, "../../templates/runtime_releases.html"));

    var renderBranchesMenu = function(req, res, next)
    {
        req.branch(function(err, branch) {

            var repository = branch.getRepository();

            Chain(repository).listBranches({
                "limit": -1
            }).each(function() {
                this._active = (this.getId() === branch.getId());
            }).then(function() {

                var branches = this.asArray();

                var handlebars = require("handlebars");
                var template = handlebars.compile(TEMPLATE_RUNTIME_BRANCHES);

                var data = {
                    "branches": branches
                };
                var result = template(data);

                res.type("text/html").send(result);
            });
        });
    };

    var renderReleasesMenu = function(req, res, next)
    {
        req.branch(function(err, branch) {

            var repository = branch.getRepository();

            Chain(repository).listReleases({
                "limit": -1
            }).each(function() {
                this._active = (this.branchId === branch.getId());
            }).then(function() {

                var releases = this.asArray();

                // splice in MASTER
                releases.unshift({
                    "_doc": "master",
                    "title": "Master",
                    "released": "",
                    "branchId": "master",
                    "_active": branch.type === "MASTER"
                });

                var handlebars = require("handlebars");
                var template = handlebars.compile(TEMPLATE_RUNTIME_RELEASES);

                var data = {
                    "releases": releases
                };
                var result = template(data);

                res.type("text/html").send(result);
            });
        });

    };


    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    /**
     * Ensures that runtime information is loaded onto the request.
     *
     * @return {Function}
     */
    r.interceptor = function()
    {
        var loadRuntime = function(req, res, callback)
        {
            var store = req.stores.content;
            var key = store.id;

            // define the loader (loads runtime)
            var loader = function(store)
            {
                return function(cb)
                {
                    store.existsFile("runtime.json", function(exists) {

                        if (exists)
                        {
                            store.readFile("runtime.json", function (err, data) {

                                if (err) {
                                    return cb(err);
                                }

                                return cb(null, JSON.parse(data));
                            });
                        }
                        else
                        {
                            // write initial file

                            var runtime = {};

                            // cache buster (cb)
                            runtime.cb = Date.now();
                            if (process.env.CLOUDCMS_RUNTIME_CB) {
                                runtime.cb = process.env.CLOUDCMS_RUNTIME_CB;
                            }

                            // release id
                            runtime.releaseId = null;
                            if (process.env.CLOUDCMS_RUNTIME_RELEASE_ID) {
                                runtime.releaseId = process.env.CLOUDCMS_RUNTIME_RELEASE_ID;
                            }

                            // branch id
                            runtime.branchId = null;
                            if (process.env.CLOUDCMS_RUNTIME_BRANCH_ID) {
                                runtime.branchId = process.env.CLOUDCMS_RUNTIME_BRANCH_ID;
                            }

                            // don't bother writing to disk if we don't have any state to set
                            if (!runtime.releaseId && !runtime.branchId) {
                                return cb(null, runtime);
                            }

                            // create runtime file
                            store.writeFile("runtime.json", JSON.stringify(runtime, null, 2), function (err) {
                                return cb(null, runtime);
                            });
                        }
                    });
                }
            }(store);

            // wrap loader with caching + an exclusive lock
            var cachedExclusiveLoader = Loaders.cachedExclusive(loader, process.runtimeCache, key, process.defaultExclusiveLockTimeoutMs);

            cachedExclusiveLoader(callback);
        };

        return util.createInterceptor("runtime", function(req, res, next, stores, cache, configuration) {

            loadRuntime(req, res, function(err, runtime) {

                if (err) {
                    req.log("Error loading runtime");
                    req.log(err);
                    return next();
                }

                req.runtime = runtime;
                next();
            });
        });
    };

    /**
     * Handles retrieval of runtime status.
     *
     * @return {Function}
     */
    r.handler = function()
    {
        return util.createHandler("runtime", function(req, res, next, stores, cache, configuration) {

            var handled = false;

            if (req.method.toLowerCase() === "get") {

                if (req.url.indexOf("/_runtime/status") === 0)
                {
                    var data = {};
                    data.runtime = req.runtime;

                    // show which branch we're running on
                    req.branch(function(err, branch) {

                        if (!err)
                        {
                            data.live = {};
                            data.live.repositoryId = branch.getRepositoryId();
                            data.live.branchId = branch.getId();
                        }

                        completionFn(null, res, data);
                    });

                    handled = true;
                }
                else if (req.url.indexOf("/_runtime/branches") === 0)
                {
                    renderBranchesMenu(req, res, next);

                    handled = true;
                }
                else if (req.url.indexOf("/_runtime/releases") === 0)
                {
                    renderReleasesMenu(req, res, next);

                    handled = true;
                }

            }
            else if (req.method.toLowerCase() === "post") {

                if (req.url.indexOf("/_runtime/migrate") === 0)
                {
                    doMigrate(req, req.body, function(err) {
                        completionFn(err, res);
                    });

                    handled = true;
                }

            }

            if (!handled)
            {
                next();
            }
        });
    };

    return r;
}();

