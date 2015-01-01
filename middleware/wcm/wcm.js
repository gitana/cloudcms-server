var path = require('path');
var fs = require('fs');
var http = require('http');
var util = require("../../util/util");
var mkdirp = require('mkdirp');
var duster = require("../../duster");

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

    // assume thirty seconds (for development mode)
    var WCM_CACHE_TIMEOUT = 60 * 1000 * 0.5; // 30 seconds
    if (process.env.CLOUDCMS_APPSERVER_MODE == "production")
    {
        // for production, set to 24 hours
        WCM_CACHE_TIMEOUT = 60 * 1000 * 60 * 24;
    }

    var preloadPages = function(req, callback)
    {
        var gitana = req.gitana;

        var cacheValid = false;

        var pages = req.cache.read("wcmPages");
        var pagesTimestamp = req.cache.read("wcmPagesTimestamp");
        var now = new Date().getTime();

        // do a quick page count check
        var pageCount = 0;
        if (pages)
        {
            for (var k in pages) {
                pageCount++;
            }
        }

        //console.log("WCM cached page count: " + pageCount + " with timestamp: " + pagesTimestamp);
        //console.log("Now is: " + now + " with difference: " + (now - pagesTimestamp));

        if (pagesTimestamp && pagesTimestamp > 0)
        {
            if (now - pagesTimestamp > WCM_CACHE_TIMEOUT)
            {
                //console.log("WCM cache invalid -> exceeded 30 seconds");
                cacheValid = false;
            }
            else
            {
                //console.log("WCM cache valid");
                cacheValid = true;
            }

            if (pageCount == 0)
            {
                // force invalid
                //console.log("WCM page count == 0, forcing invalid");
                cacheValid = false;
            }
        }

        // allow for forced invalidation via req param
        if (req.param("invalidate"))
        {
            //console.log("Forcing cache invalidation via request param");
            cacheValid = false;
        }

        if (cacheValid)
        {
            //console.log("WCM responds from cache");
            callback(null, pages);
            return;
        }

        console.log("WCM populate cache, cache timeout: " + WCM_CACHE_TIMEOUT);
        pages = {};

        // cache is not valid, let's populate it
        req.cache.clear("wcmPages");
        req.cache.clear("wcmPagesTimestamp");

        var errorHandler = function(err)
        {
            req.log("WCM populate cache err: " + JSON.stringify(err));
            //console.log("WCM populate cache err: " + err);
            //console.log("WCM populate cache err2: " + JSON.stringify(err));
            //console.log("WCM populate cache err3: " + err.message);

            callback(err);
        };

        // load all wcm pages from the server
        var repository = gitana.datastore("content");
        if (!repository)
        {
            req.log("Cannot find 'content' datastore for gitana instance");

            callback({
                "message": "Cannot find 'content' datastore for gitana instance"
            });

            return;
        }

        //var t1 = new Date().getTime();
        Chain(repository).trap(errorHandler).readBranch("master").then(function() {

            var branch = this;

            this.queryNodes({
                "_type": "wcm:page"
            }, {
                "limit": -1
            }).each(function() {

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
                            // console.log("Mapping page: " + page.uris[i] + " to " + JSON.stringify(page));
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
                        this.subchain(branch).readNode(page.template).then(function() {

                            // THIS = wcm:template
                            var template = this;
                            page.templatePath = template.path;
                        });
                    }
                }
            });

        }).then(function() {

            //var t2 = new Date().getTime();

            //console.log("WCM page time: " + (t2-t1));

            console.log("Writing pages to WCM cache");
            for (var uri in pages)
            {
                console.log(" -> " + uri);
            }

            req.cache.write("wcmPages", pages);
            req.cache.write("wcmPagesTimestamp", new Date().getTime());

            callback(null, pages);
        });
    };



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
        return util.createHandler("wcm", function(req, res, next, configuation, store, cache) {

            if (!req.gitana)
            {
                next();
                return;
            }

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
                        if (!tokens) {
                            tokens = {};
                        }

                        if (!req.helpers) {
                            req.helpers = {};
                        }
                        req.helpers.page = page;

                        // build the model
                        var model = {
                            "page": {
                            },
                            "template": {
                                "path": page.templatePath
                            },
                            "request": {
                                "tokens": tokens,
                                "matchingPath": matchingPath
                            }
                        };
                        // page keys to copy
                        for (var k in page)
                        {
                            if (k == "templatePath") {

                            } else if (k == "_doc") {
                            } else if (k.indexOf("_") === 0) {
                            } else {
                                model.page[k] = page[k];
                            }
                        }

                        store.publicPath(req, function(err, publicPath) {

                            if (err) {
                                next(err);
                                return;
                            }

                            var filePath = path.join(publicPath, page.templatePath);

                            // dust it
                            duster.execute(req, filePath, model, function (err, out) {

                                if (err) {
                                    res.send(500, err);
                                }
                                else {
                                    res.status(200).send.call(res, out);
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

