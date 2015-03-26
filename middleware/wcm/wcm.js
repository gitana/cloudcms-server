var path = require('path');
var fs = require('fs');
var http = require('http');
var util = require("../../util/util");
var duster = require("../../duster");
var async = require("async");
var dependencies = require("./dependencies");

/**
 * WCM middleware.
 *
 * Serves up HTML pages based on WCM configuration.  Applies duster tag processing.
 *
 * @type {Function}
 */
exports = module.exports = function()
{
    var isEmpty = function(thing)
    {
        return (typeof(thing) === "undefined") || (thing === null);
    };

    var startsWith = function(text, prefix) {
        return text.substr(0, prefix.length) === prefix;
    };

    var executeMatch = function(matcher, text)
    {
        // strip matcher from "/a/b/c" to "a/b/c"
        if (matcher && matcher.length > 0 && matcher.substring(0,1) === "/")
        {
            matcher = matcher.substring(1);
        }

        // strip text from "/a/b/c" to "a/b/c"
        if (text && text.length > 0 && text.substring(0,1) === "/")
        {
            text = text.substring(1);
        }

        var tokens = {};

        var printDebug = function()
        {
            //console.log("Matched - pattern: " + matcher + ", text: " + text + ", tokens: " + JSON.stringify(tokens));
        };

        var array1 = [];
        if (matcher)
        {
            array1 = matcher.split("/");
        }
        var array2 = [];
        if (text)
        {
            array2 = text.split("/");
        }

        // short cut - zero length matches
        if ((array1.length === 0) && (array2.length === 0))
        {
            printDebug();
            return tokens;
        }

        if (matcher)
        {
            // short cut - **
            if (matcher == "**")
            {
                // it's a match, pull out wildcard token
                tokens["**"] = text;
                printDebug();
                return tokens;
            }

            // if matcher has no wildcards or tokens...
            if ((matcher.indexOf("{") == -1) && (matcher.indexOf("*") == -1))
            {
                // if they're equal...
                if (matcher == text)
                {
                    // it's a match, no tokens
                    printDebug();
                    return tokens;
                }
            }
        }

        var pattern = null;
        var value = null;
        do
        {
            pattern = array1.shift();
            value = array2.shift();

            var patternEmpty = (isEmpty(pattern) || pattern === "");
            var valueEmpty = (isEmpty(value) || value === "");

            // if there are remaining pattern and value elements
            if (!patternEmpty && !valueEmpty)
            {
                if (pattern == "*")
                {
                    // wildcard - element matches
                }
                else if (pattern == "**")
                {
                    // wildcard - match everything else, so break out
                    tokens["**"] = "/" + [].concat(value, array2).join("/");
                    break;
                }
                else if (pattern.indexOf("{") > -1)
                {
                    var startIndex = pattern.indexOf("{");
                    var stopIndex = pattern.indexOf("}");

                    var prefix = null;
                    if (startIndex > 0)
                    {
                        prefix = pattern.substring(0, startIndex);
                    }

                    var suffix = null;
                    if (stopIndex < pattern.length - 1)
                    {
                        suffix = pattern.substring(stopIndex);
                    }

                    if (prefix)
                    {
                        value = value.substring(prefix.length);
                    }

                    if (suffix)
                    {
                        value = value.substring(0, value.length - suffix.length + 1);
                    }

                    var key = pattern.substring(startIndex + 1, stopIndex);

                    // URL decode the value
                    value = decodeURIComponent(value);

                    // assign to token collection
                    tokens[key] = value;
                }
                else
                {
                    // check for exact match
                    if (pattern == value)
                    {
                        // exact match
                    }
                    else
                    {
                        // not a match, thus fail
                        return null;
                    }
                }
            }
            else
            {
                // if we expected a pattern but empty value or we have a value but no pattern
                // then it is a mismatch
                if ((pattern && valueEmpty) || (patternEmpty && value))
                {
                    return null;
                }
            }
        }
        while (!isEmpty(pattern) && !isEmpty(value));

        printDebug();
        return tokens;
    };

    var findMatchingPage = function(pages, offsetPath, callback)
    {
        // walk through the routes and find one that matches this URI and method
        var discoveredTokensArray = [];
        var discoveredPages = [];
        var discoveredPageOffsetPaths = [];
        for (var pageOffsetPath in pages)
        {
            var matchedTokens = executeMatch(pageOffsetPath, offsetPath);
            if (matchedTokens)
            {
                discoveredPages.push(pages[pageOffsetPath]);
                discoveredTokensArray.push(matchedTokens);
                discoveredPageOffsetPaths.push(pageOffsetPath);
            }
        }

        // pick the closest page (overrides are sorted first)
        var discoveredPage = null;
        var discoveredTokens = null;
        var discoveredPageOffsetPath = null;
        if (discoveredPages.length > 0)
        {
            discoveredPage = discoveredPages[0];
            discoveredTokens = discoveredTokensArray[0];
            discoveredPageOffsetPath = discoveredPageOffsetPaths[0];
        }

        callback(null, discoveredPage, discoveredTokens, discoveredPageOffsetPath);
    };

    // assume 120 seconds (for development mode)
    var WCM_CACHE_TIMEOUT_SECONDS = 120;
    if (process.env.CLOUDCMS_APPSERVER_MODE === "production")
    {
        // for production, set to 24 hours
        WCM_CACHE_TIMEOUT_SECONDS = 60 * 60 * 24;
    }

    var preloadPages = function(req, callback)
    {
        var ensureInvalidate = function(callback) {
            // allow for forced invalidation via req param
            if (req.query["invalidate"]) {
                req.cache.remove("wcmPages", function() {
                    callback();
                });
                return;
            }

            callback();
        };

        ensureInvalidate(function() {

            req.cache.read("wcmPages", function (err, pages) {

                if (pages) {
                    callback(null, pages);
                    return;
                }

                // build out pages
                pages = {};

                var errorHandler = function (err) {
                    req.log("WCM populate cache err: " + JSON.stringify(err));

                    callback(err);
                };

                // load all wcm pages from the server
                req.branch(function(err, branch) {

                    branch.then(function () {

                        this.queryNodes({
                            "_type": "wcm:page"
                        }, {
                            "limit": -1
                        }).each(function () {

                            // THIS = wcm:page
                            var page = this;

                            // if page has a template
                            if (page.template)
                            {
                                if (page.uris)
                                {
                                    // merge into our pages collection
                                    for (var i = 0; i < page.uris.length; i++)
                                    {
                                        pages[page.uris[i]] = page;
                                    }
                                }

                                // is the template a GUID or a path to the template file?
                                if (page.template.indexOf("/") > -1)
                                {
                                    page.templatePath = page.template;
                                }
                                else
                                {
                                    // load the template
                                    this.subchain(branch).readNode(page.template).then(function () {

                                        // THIS = wcm:template
                                        var template = this;
                                        page.templatePath = template.path;
                                    });
                                }
                            }
                        })

                    }).then(function () {

                        console.log("Writing pages to WCM cache");
                        for (var uri in pages) {
                            console.log(" -> " + uri);
                        }

                        req.cache.write("wcmPages", pages, WCM_CACHE_TIMEOUT_SECONDS);

                        callback(null, pages);
                    });
                });
            });
        });
    };

    var isPageCacheEnabled = function()
    {
        var enabled = false;

        if (process.configuration.wcm && process.configuration.wcm.enabled)
        {
            enabled = process.configuration.wcm.cache;
        }

        return enabled;
    };

    var handleCachePageWrite = function(req, uri, dependencies, text, callback)
    {
        if (!isPageCacheEnabled())
        {
            callback();
            return;
        }

        var contentStore = req.stores.content;

        // write page cache entry
        var pageFilePath = path.join("wcm", "repositories", req.repositoryId, "branches", req.branchId, "pages", uri, "page.html");
        contentStore.writeFile(pageFilePath, text, function(err) {

            if (err)
            {
                callback(err);
                return;
            }

            if (dependencies && dependencies.length > 0)
            {
                dependencies.add(req, uri, dependencies, function (err) {
                    callback(err);
                });
            }
            else
            {
                callback();
            }
        });
    };

    var handleCachePageRead = function(req, uri, callback)
    {
        if (!isPageCacheEnabled())
        {
            callback();
            return;
        }

        var contentStore = req.stores.content;

        var pageFilePath = path.join("wcm", "repositories", req.repositoryId, "branches", req.branchId, "pages", uri, "page.html");
        util.safeReadStream(contentStore, pageFilePath, function(err, data) {
            callback(err, data);
        });
    };

    /*
    var handleCachePageInvalidate = function(req, uri, callback)
    {
        var contentStore = req.stores.content;

        var pageFilePath = path.join("wcm", "repositories", req.repositoryId, "branches", req.branchId, "pages", uri, "page.html");
        contentStore.existsFile(pageFilePath, function(exists) {

            if (!exists) {
                callback();
                return;
            }

            // delete the page file
            contentStore.deleteFile(pageFilePath, function (err) {

                // invalidate all page dependencies
                dependencies.remove(req, uri, function (err) {
                    callback(err);
                });
            });
        });
    };

    var handleCacheDependencyInvalidate = function(req, key, value, callback)
    {
        var contentStore = req.stores.content;

        // read page json
        var dependencyDirectoryPath = path.join("wcm", "applications", req.applicationId, "dependencies", key, value);
        contentStore.listFiles(dependencyDirectoryPath, function(err, filenames) {

            var fns = [];
            for (var i = 0; i < filenames.length; i++)
            {
                var fn = function(req, dependencyDirectoryPath, filename) {
                    return function(done) {

                        var dependencyFilePath = path.join(dependencyDirectoryPath, filename);
                        contentStore.existsFile(dependencyFilePath, function(exists) {

                            if (!exists) {
                                done();
                                return;
                            }

                            contentStore.readFile(dependencyFilePath, function (err, data) {

                                if (err) {
                                    done();
                                    return;
                                }

                                try
                                {
                                    var json = JSON.parse("" + data);
                                    var uri = json.uri;

                                    // remove the dependency entry
                                    contentStore.deleteFile(dependencyFilePath, function(err) {

                                        // invalidate the page
                                        handleCachePageInvalidate(req, uri, function (err) {
                                            done();
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
        });
    };
    */



    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    /**
     * Provides WCM page retrieval from Cloud CMS.
     *
     * @param configuration
     * @return {Function}
     */
    r.wcmHandler = function()
    {
        return util.createHandler("wcm", function(req, res, next, configuation, stores) {

            if (!req.gitana)
            {
                next();
                return;
            }

            var webStore = stores.web;

            preloadPages(req, function(err, pages) {

                if (err)
                {
                    next();
                    return;
                }

                var offsetPath = req.path;

                // find a page for this path
                findMatchingPage(pages, offsetPath, function(err, page, tokens, matchingPath) {

                    if (err)
                    {
                        next();
                        return;
                    }

                    if (page)
                    {
                        // handle cache read
                        handleCachePageRead(req, offsetPath, function(err, readStream) {

                            if (!err && readStream)
                            {
                                console.log("SERVING FROM CACHE: " + offsetPath);
                                res.status(200);
                                readStream.pipe(res);
                                return;
                            }

                            if (!tokens) {
                                tokens = {};
                            }

                            if (!req.helpers) {
                                req.helpers = {};
                            }
                            req.helpers.page = page;

                            // build the model
                            var model = {
                                "page": {},
                                "template": {
                                    "path": page.templatePath
                                },
                                "request": {
                                    "tokens": tokens,
                                    "matchingPath": matchingPath
                                }
                            };

                            // page keys to copy
                            for (var k in page) {
                                if (k == "templatePath") {
                                } else if (k == "_doc") {
                                } else if (k.indexOf("_") === 0) {
                                } else {
                                    model.page[k] = page[k];
                                }
                            }

                            // dust it
                            duster.execute(req, webStore, page.templatePath, model, function (err, text, dependencies) {

                                if (err) {
                                    res.status(500).send(err);
                                }
                                else {
                                    // write to page cache
                                    console.log("WRITING TO CACHE: " + offsetPath);
                                    handleCachePageWrite(req, offsetPath, dependencies, text, function(err) {
                                        res.status(200).send.call(res, text);
                                    });
                                }

                            });
                        });
                    }
                    else
                    {
                        next();
                    }

                });
            });
        });
    };

    return r;
}();

