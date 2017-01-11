var path = require('path');
var fs = require('fs');
var http = require('http');
var util = require("../../util/util");
var duster = require("../../duster/index");
var async = require("async");

var support = require("../../duster/support")(duster.getDust());

var renditions = require("../../util/renditions");

/**
 * WCM middleware.
 *
 * Serves up HTML pages based on WCM configuration.  Applies duster tag processing.
 *
 * @type {Function}
 */
exports = module.exports = function()
{
    // cache keys
    var WCM_PAGES = "wcmPages";

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
            if (process.env.NODE_ENV === "production") {
                // skip
            } else {
                console.log("Matched - pattern: " + matcher + ", text: " + text + ", tokens: " + JSON.stringify(tokens));
            }
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
            if (matcher === "**")
            {
                // it's a match, pull out wildcard token
                tokens["**"] = text;
                printDebug();
                return tokens;
            }

            // if matcher has no wildcards or tokens...
            if ((matcher.indexOf("{") === -1) && (matcher.indexOf("*") === -1))
            {
                // if they're equal...
                if (matcher === text)
                {
                    // it's a match, no tokens
                    tokens["_exact"] = true;
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
                if (pattern === "*")
                {
                    // wildcard - element matches
                }
                else if (pattern === "**")
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

                    // assign to token collection
                    if (value)
                    {
                        // URL decode the value
                        value = decodeURIComponent(value);

                        // assign to tokens
                        tokens[key] = value;
                    }
                }
                else
                {
                    // check for exact match
                    if (pattern === value)
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
            // find the index with the greatest # of tokens
            var index = 0;
            var maxLen = 0;
            for (var i = 0; i < discoveredTokensArray.length; i++)
            {
                var len = discoveredTokensArray[i].length;
                if (len > maxLen) {
                    index = i;
                    maxLen = len;
                }

                if (discoveredTokensArray[i]["_exact"])
                {
                    index = i;
                    break;
                }
            }

            // hand back the discovered page that matches the greatest # of tokens
            discoveredPage = discoveredPages[index];
            discoveredTokens = discoveredTokensArray[index];
            discoveredPageOffsetPath = discoveredPageOffsetPaths[index];
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

    var preloadPages = function(req, finished)
    {
        var ensureInvalidate = function(callback) {

            // allow for forced invalidation via req param
            if (req.query["invalidate"]) {
                req.cache.remove(WCM_PAGES, function() {
                    callback();
                });
                return;
            }

            callback();
        };

        ensureInvalidate(function() {

            req.cache.read(WCM_PAGES, function (err, pages) {

                if (pages) {
                    return finished(null, pages);
                }

                req.application(function(err, application) {

                    var loadingPagesCacheKey = application._doc + "-wcm-loading-pages";

                    // take out a preloading lock so that only one thread proceeds at a time here
                    _LOCK(null, loadingPagesCacheKey, function (releaseLockFn) {

                        // check again inside lock in case another request preloaded this before we arrived
                        req.cache.read(WCM_PAGES, function (err, pages) {

                            if (pages)
                            {
                                releaseLockFn();
                                return finished(null, pages);
                            }

                            req.log("Loading Web Pages into cache");

                            // error handler
                            var errorHandler = function (err) {

                                console.log("a3");
                                req.log("Error while loading web pages: " + JSON.stringify(err));
                                console.trace();

                                return finished(err);
                            };

                            // load all wcm pages from the server
                            req.branch(function (err, branch) {

                                if (err)
                                {
                                    // release the lock
                                    releaseLockFn();

                                    // fire the error handler
                                    return errorHandler(err);
                                }

                                // build out pages
                                pages = {};

                                branch.trap(function (err) {

                                    // release the lock
                                    releaseLockFn();

                                    // fire the error handler
                                    errorHandler(err);

                                    return false;
                                }).then(function () {

                                    var fns = [];

                                    // load all of the pages
                                    this.trap(function(err) {

                                        // release the lock
                                        releaseLockFn();

                                        // fire the error handler
                                        errorHandler(err);

                                        return false;

                                    }).queryNodes({
                                        "_type": "wcm:page"
                                    }, {
                                        "limit": -1
                                    }).each(function () {

                                        // THIS = wcm:page
                                        var page = this;

                                        // if the page has a template
                                        if (page.template)
                                        {
                                            var fn = function (branch, page) {
                                                return function (allDone) {

                                                    var completionFn = function () {

                                                        if (page.templatePath)
                                                        {
                                                            if (page.uris)
                                                            {
                                                                // merge into our pages collection
                                                                for (var i = 0; i < page.uris.length; i++)
                                                                {
                                                                    pages[page.uris[i]] = page;
                                                                }
                                                            }
                                                        }

                                                        allDone();
                                                    };

                                                    // is the template a GUID or a path to the template file?
                                                    if ((page.template.indexOf("/") > -1) || (page.template.indexOf(".") > -1))
                                                    {
                                                        page.templatePath = page.template;
                                                        completionFn();
                                                    }
                                                    else
                                                    {
                                                        // load the template
                                                        Chain(branch).trap(function (e2) {
                                                            // skip it
                                                            completionFn();
                                                            return false;
                                                        }).readNode(page.template).then(function () {

                                                            // THIS = wcm:template
                                                            var template = this;

                                                            if (template.path)
                                                            {
                                                                page.templatePath = template.path;
                                                            }

                                                            //
                                                            // // try to download the "default" attachment if it exists
                                                            // this.trap(function() {
                                                            // return false;
                                                            // }).attachment("default").download(function(text) {
                                                            // console.log("DOWNLOADED TEXT: " + text);
                                                            // page.tempateText = text;
                                                            // });
                                                            //

                                                            completionFn();

                                                        });
                                                    }
                                                };
                                            }(branch, page);
                                            fns.push(fn);
                                        }

                                    }).then(function () {

                                        console.log("Processing " + fns.length + " web pages");

                                        async.series(fns, function (err) {

                                            console.log("Web Page processing complete");
                                            for (var uri in pages)
                                            {
                                                req.log("Loaded Web Page -> " + uri);
                                            }

                                            req.cache.write(WCM_PAGES, pages, WCM_CACHE_TIMEOUT_SECONDS);

                                            releaseLockFn();

                                            finished(null, pages);

                                        });

                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    };

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // PAGE CACHE (WITH DEPENDENCIES)
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var isEnabled = function()
    {
        if (!process.configuration.wcm) {
            process.configuration.wcm = {};
        }

        if (typeof(process.configuration.wcm.enabled) === "undefined") {
            process.configuration.wcm.enabled = false;
        }

        return process.configuration.wcm.enabled;
    };

    /**
     * Determines whether to use the page cache.  We use this cache if we're instructed to and if we're in
     * production model.
     *
     * @returns {boolean}
     */
    var isPageCacheEnabled = function(req)
    {
        if (!process.configuration.wcm) {
            process.configuration.wcm = {};
        }

        if (typeof(process.configuration.wcm.enabled) === "undefined") {
            process.configuration.wcm.enabled = false;
        }

        if (typeof(process.configuration.wcm.cache) === "undefined") {
            process.configuration.wcm.cache = false;
        }

        if (process.env.FORCE_CLOUDCMS_WCM_PAGE_CACHE === "true")
        {
            process.configuration.wcm.cache = true;
        }
        else if (process.env.FORCE_CLOUDCMS_WCM_PAGE_CACHE === "false")
        {
            process.configuration.wcm.cache = false;
        }

        if (process.env.CLOUDCMS_APPSERVER_MODE !== "production")
        {
            process.configuration.wcm.cache = false;
        }

        var enabled = (process.configuration.wcm.enabled && process.configuration.wcm.cache);

        // is it disabled per request?
        if (req && req.disablePageCache)
        {
            enabled = false;
        }

        return enabled;
    };

    var handleCachePageWrite = function(req, descriptor, pageBasePath, dependencies, text, callback)
    {
        if (!isPageCacheEnabled(req))
        {
            return callback();
        }

        var contentStore = req.stores.content;

        // take out a lock so that only one "request" can write to cache at a time for this path
        _LOCK(contentStore, _lock_identifier(pageBasePath), function(releaseLockFn) {

            var pageFilePath = path.join(pageBasePath, "page.html");

            contentStore.writeFile(pageFilePath, text, function (err) {

                if (err)
                {
                    releaseLockFn();
                    return callback(err);
                }

                if (dependencies)
                {
                    // we let this run on it's own
                    renditions.markRendition(req, descriptor, dependencies, function (err) {
                        // all done, nothing to do
                    });
                }

                releaseLockFn();

                callback();
            });
        });
    };

    var handleCachePageRead = function(req, descriptor, pageBasePath, callback)
    {
        if (!isPageCacheEnabled(req))
        {
            return callback();
        }

        var contentStore = req.stores.content;

        // take out a lock so that only one "request" can read from cache at a time for this path
        _LOCK(contentStore, _lock_identifier(pageBasePath), function(releaseLockFn) {

            var pageFilePath = path.join(pageBasePath, "page.html");

            util.safeReadStream(contentStore, pageFilePath, function (err, stream) {
                releaseLockFn();
                callback(err, stream);
            });
        });
    };

    var handleCachePageInvalidate = function(host, repositoryId, branchId, pageCacheKey, callback)
    {
        // this is the path to the page folder
        // if we blow away this folder, we blow away all page fragments as well
        var pageBasePath = path.join("wcm");
        if (repositoryId)
        {
            pageBasePath = path.join(pageBasePath, "repositories", repositoryId);
        }
        if (branchId)
        {
            pageBasePath = path.join(pageBasePath, "branches", branchId);
        }
        if (pageCacheKey)
        {
            pageBasePath = path.join(pageBasePath, "pages", pageCacheKey);
        }

        // list all of the hosts
        var stores = require("../stores/stores");
        stores.produce(host, function (err, stores) {

            if (err) {
                return callback(err);
            }

            _LOCK(stores.content, _lock_identifier(pageBasePath), function(releaseLockFn) {

                stores.content.existsDirectory(pageBasePath, function (exists) {

                    if (!exists)
                    {
                        releaseLockFn();
                        return callback();
                    }

                    stores.content.removeDirectory(pageBasePath, function () {
                        releaseLockFn();
                        callback();
                    });
                });
            });

        });
    };

    var _lock_identifier = function()
    {
        var args = Array.prototype.slice.call(arguments);

        return args.join("_");
    };

    var _LOCK = function(store, lockIdentifier, workFunction)
    {
        var lockKeys = [];
        if (store) {
            lockKeys.push(store.id);
        }
        if (lockIdentifier) {
            lockKeys.push(lockIdentifier);
        }

        process.locks.lock(lockKeys.join("_"), workFunction);
    };

    var bindSubscriptions = function()
    {
        if (process.broadcast)
        {
            // NOTE: all page rendition invalidation based on changes to nodes happens on the server side within the
            // Cloud CMS API itself. Cloud CMS maintains a master record of how page renditions and nodes are related.
            // When a node changes in Cloud CMS, the API finds any page renditions that need to invalidate and then
            // sends those along as page rendition invalidation events.  These are handled here...

            // LISTEN: "invalidate_page_rendition"
            process.broadcast.subscribe("invalidate_page_rendition", function (message, invalidationDone) {

                console.log("HEARD: invalidate_page_rendition");

                var clearFragmentCacheFn = function(message)
                {
                    var pageCacheKey = message.pageCacheKey;
                    var fragmentCacheKey = message.fragmentCacheKey;

                    var scope = message.scope;
                    var host = message.host;

                    var repositoryId = message.repositoryId;
                    var branchId = message.branchId;
                    // at the moment, caching on disk uses "master" for the master branch instead of the actual branch id
                    var isMasterBranch = message.isMasterBranch;

                    return function(done3)
                    {
                        if (scope === "FRAGMENT" || scope === "ALL")
                        {
                            var buildFragmentsBasePath = function(branchId) {
                                if (pageCacheKey) {
                                    return path.join("wcm", "repositories", repositoryId, "branches", branchId, "pages", pageCacheKey, "fragments");
                                }

                                return path.join("duster", "repositories", repositoryId, "branches", branchId, "fragments");
                            };

                            if (support.isFragmentCacheEnabled())
                            {
                                // for master branch, we make a silent attempt using "master" as the branch ID
                                if (isMasterBranch)
                                {
                                    var fragmentsBasePath = buildFragmentsBasePath("master");
                                    support.handleCacheFragmentInvalidate(host, fragmentsBasePath, fragmentCacheKey, function(err) {
                                        // done
                                    });
                                }

                                var fragmentsBasePath = buildFragmentsBasePath(branchId);
                                support.handleCacheFragmentInvalidate(host, fragmentsBasePath, fragmentCacheKey, function(err, invalidatedPath) {

                                    if (!err) {
                                        console.log(" > Invalidated fragment [host: " + host + ", path: " + invalidatedPath + "]");
                                    }

                                    return done3();
                                });
                            }
                            else
                            {
                                return done3();
                            }
                        }
                        else
                        {
                            done3();
                        }
                    }
                }(message);

                var clearPageCacheFn = function(message)
                {
                    var pageCacheKey = message.pageCacheKey;
                    var scope = message.scope;
                    var host = message.host;

                    var repositoryId = message.repositoryId;
                    var branchId = message.branchId;
                    // at the moment, caching on disk uses "master" for the master branch instead of the actual branch id
                    var isMasterBranch = message.isMasterBranch;

                    return function(done2)
                    {
                        if (scope === "PAGE" || scope === "ALL")
                        {
                            if (isPageCacheEnabled())
                            {
                                // for master branch, we make a silent attempt using "master" as the branch ID
                                if (isMasterBranch)
                                {
                                    handleCachePageInvalidate(host, repositoryId, "master", pageCacheKey, function() {

                                    });
                                }

                                handleCachePageInvalidate(host, repositoryId, branchId, pageCacheKey, function(err) {

                                    if (!err) {
                                        console.log(" > Invalidated page [host: " + host + ", repository: " + repositoryId + ", branch: " + branchId + ", page: " + pageCacheKey + "]");
                                    }

                                    return done2();
                                });
                            }
                            else
                            {
                                return done2();
                            }
                        }
                        else
                        {
                            done2();
                        }

                    }
                }(message);

                async.waterfall([
                    clearFragmentCacheFn,
                    clearPageCacheFn
                ], function() {
                    invalidationDone();
                });

            });

            // LISTEN: "invalidate_all_page_renditions"
            process.broadcast.subscribe("invalidate_all_page_renditions", function (message, invalidationDone) {

                // console.log("HEARD: invalidate_all_page_renditions");

                var clearFragmentCacheFn = function(message)
                {
                    //var host = message.host;
                    var scope = message.scope;

                    return function(done2)
                    {
                        if (scope === "FRAGMENT" || scope === "ALL")
                        {
                            // TODO: fragment level invalidation
                            return done2();
                        }
                        else
                        {
                            done2();
                        }
                    }
                }(message);

                var clearPageCacheFn = function(message)
                {
                    var host = message.host;
                    var scope = message.scope;

                    return function(done2)
                    {
                        if (scope === "PAGE" || scope === "ALL")
                        {
                            if (isPageCacheEnabled())
                            {
                                handleCachePageInvalidate(host, null, null, null, function(err) {

                                    if (!err) {
                                        console.log(" > Invalidated all pages [host: " + host + "]");
                                    }

                                    return done2();
                                });
                            }
                            else
                            {
                                return done2();
                            }
                        }

                    }
                }(message);

                async.waterfall([
                    clearFragmentCacheFn,
                    clearPageCacheFn
                ], function() {
                    invalidationDone();
                });

            });
        }
    };

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    r.wcmInterceptor = function()
    {
        return util.createInterceptor("wcm", function(req, res, next, stores, cache, configuration) {

            if (!isEnabled())
            {
                return next();
            }

            if (!req.gitana)
            {
                return next();
            }

            if (req.method.toLowerCase() !== "get")
            {
                return next();
            }

            // ensures that the WCM PAGES cache is preloaded for the current branch
            // pages must be loaded ahead of time so that matching can be performed
            preloadPages(req, function(err, pages) {

                /*
                // DEBUG: randomly fake an expired refresh token 20% of the time
                var rand = Math.random() * 10;
                console.log("rand: " + rand);
                if (rand > 8)
                {
                    // debug
                    err = {
                        "name":"Http Error",
                        "message":"Invalid refresh token (expired): 15b3fcd3-e7fb-4ea6-a0d2-c4cc481d8426",
                        "status":401,
                        "statusText":null,
                        "errorType":"http"
                    };
                }
                */

                if (err)
                {
                    return next(err);
                }

                var offsetPath = req.path;

                // find a page for this path
                // this looks at wcm:page urls and finds a best fit, extracting tokens
                findMatchingPage(pages, offsetPath, function(err, page, tokens, matchingPath) {

                    if (err)
                    {
                        req.log("An error occurred while attempting to match path: " + offsetPath);

                        return next();
                    }

                    // if we found a page, then store it on the request and adjust the request to reflect things we extract
                    if (page)
                    {
                        req.page = page;

                        // ensure empty set of page attributes
                        if (!req.pageAttributes) {
                            req.pageAttributes = {};
                        }

                        req.pageTokens = tokens ? tokens : {};
                        req.pageMatchingPath = matchingPath;

                        // override the param() method so that token values are handed back as well
                        var _param = req.param;
                        req.param = function(name) {

                            var v = undefined;

                            if (this.pageTokens)
                            {
                                v = this.pageTokens[name];
                            }
                            if (!v)
                            {
                                v = _param.call(this, name);
                            }

                            return v;
                        };

                    }

                    next();
                });
            });
        });
    };

    /**
     * Provides WCM page retrieval from Cloud CMS.
     *
     * @param configuration
     * @return {Function}
     */
    r.wcmHandler = function()
    {
        // bind listeners for broadcast events
        bindSubscriptions();

        // wcm handler
        return util.createHandler("wcm", function(req, res, next, stores, cache, configuration) {

            if (!isEnabled())
            {
                return next();
            }

            if (!req.gitana)
            {
                return next();
            }

            var page = req.page;
            if (!page)
            {
                return next();
            }

            var offsetPath = req.path;

            var tokens = req.pageTokens;
            var matchingPath = req.pageMatchingPath;

            var webStore = stores.web;

            // either serve the page back from cache or run dust over it
            // after dust is run over it, we can stuff it into cache for the next request to benefit from
            var descriptor = {
                "url": req.protocol + "://" + req.domainHost + offsetPath,
                "host": req.domainHost,
                "protocol": req.protocol,
                "path": offsetPath,
                "params": req.query ? req.query : {},
                "pageAttributes": req.pageAttributes ? req.pageAttributes : {},
                "headers": req.headers,
                "matchingTokens": tokens,
                "matchingPath": matchingPath,
                "matchingUrl": req.protocol + "://" + req.domainHost + matchingPath,
                "matchingPageId": page._doc,
                "matchingPageTitle": page.title ? page.title : page._doc,
                "scope": "PAGE"
            };

            if (req.repositoryId) {
                descriptor.repositoryId = req.repositoryId;
            }

            if (req.branchId) {
                descriptor.branchId = req.branchId;
            }

            // generate a page cache key from the descriptor (and store on the descriptor)
            var pageCacheKey = util.generatePageCacheKey(descriptor);
            descriptor.pageCacheKey = pageCacheKey;

            // base path for storage
            var pageBasePath = path.join("wcm", "repositories", req.repositoryId, "branches", req.branchId, "pages", pageCacheKey);

            // is this already in cache?
            handleCachePageRead(req, descriptor, pageBasePath, function(err, readStream) {

                if (!err && readStream)
                {
                    // yes, we found it in cache, so we'll simply pipe it back from disk
                    req.log("WCM Page Cache Hit: " + offsetPath);

                    // SPECIAL HANDLING FOR OFFSET PATH "/" TO SUPPORT HTML CONTENT TYPE HEADER
                    if (offsetPath === "/") {
                        offsetPath += "index.html";
                    }

                    util.status(res, 200);
                    util.applyResponseContentType(res, null, offsetPath);
                    readStream.pipe(res);
                    return;
                }

                // otherwise, we need to run dust...

                var runDust = function()
                {
                    // TODO: block here in case another thread is trying to dust this page at the same time?

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

                    // model stores reference to page descriptor
                    model._page_descriptor = descriptor;

                    // model stores a base path that we'll use for storage of fragments
                    model._fragments_base_path = path.join(pageBasePath, "fragments");

                    // page keys to copy
                    for (var k in page) {
                        if (k.indexOf("_") === 0) {
                        } else {
                            model.page[k] = page[k];
                        }
                    }

                    // set _doc and id (equivalent)
                    model.page._doc = model.page.id = page._doc;

                    // dust it up
                    duster.execute(req, webStore, page.templatePath, model, function (err, text, dependencies) {

                        if (err)
                        {
                            // something screwed up during the dust execution
                            // it might be a bad template
                            req.log("Failed to process dust template: " + page.templatePath + " for model: " + JSON.stringify(model, null, "  "));

                            util.status(res, 500);
                            res.send(err);
                            return;
                        }

                        // we now have the result (text) and the dependencies that this page flagged (dependencies)
                        // use these to write to the page cache
                        // don't wait for this to complete, assume it completes in background
                        handleCachePageWrite(req, descriptor, pageBasePath, dependencies, text, function(err) {
                            //res.status(200);
                            //res.send(text);
                        });

                        // SPECIAL HANDLING FOR OFFSET PATH "/" TO SUPPORT HTML CONTENT TYPE HEADER
                        if (offsetPath === "/") {
                            offsetPath += "index.html";
                        }

                        // send back results right away
                        util.status(res, 200);
                        util.applyResponseContentType(res, null, offsetPath);
                        res.send(text);

                    });
                };
                runDust();
            });
        });
    };

    /**
     * Manual method for resetting cache.
     *
     * @param host
     * @param repositoryId
     * @param branchId
     * @param pageCacheKey
     * @param callback
     */
    r.resetCache = function(host, repositoryId, branchId, pageCacheKey, callback)
    {
        handleCachePageInvalidate(host, repositoryId, branchId, pageCacheKey, callback);
    };

    return r;
}();

