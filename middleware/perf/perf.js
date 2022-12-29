var path = require('path');
var fs = require('fs');
var http = require('http');
var mime = require("mime");
var util = require("../../util/util");

/**
 * Performance middleware.
 *
 * Applies cache headers to commonly requested mimetypes to ensure that appropriate client side caching is in place.
 * Also strips out filename cache keys (filename-<MD5>.extension) so that incoming requests resolve properly.
 *
 * @type {Function}
 */
exports = module.exports = function()
{
    // some time in the past
    var ALREADY_EXPIRED_DATE = "Mon, 7 Apr 2012, 16:00:00 GMT";

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var MAXAGE_ONE_YEAR_SECONDS = 31536000;
    var MAXAGE_ONE_HOUR_SECONDS = 3600;
    var MAXAGE_ONE_WEEK_SECONDS = 604800;
    var MAXAGE_ONE_MONTH_SECONDS = 2592000;

    var MAXAGE_DEFAULT_SECONDS = 60; // one minute

    var TEST_MODE = false;

    var r = {};

    /**
     * Supports pre-proxy caching of resources based on file path.
     *
     * Configuration looks like:
     *
     * {
     *    "perf": {
     *       "enabled": true,
     *       "paths": [{
     *          "regex": "/proxy/repositories/.*",
     *          "cache": {
     *              "seconds": 60 (or 0 for no cache and -1 for 1 year)
     *          }
     *       }]
     *    }
     * }
     *
     * @return {Function}
     */
    r.pathPerformanceInterceptor = function()
    {
        return util.createInterceptor("perf", function(req, res, next, stores, cache, configuration) {

            // NOTE: if we're not in production mode, we don't do any of this
            if (process.env.CLOUDCMS_APPSERVER_MODE === "production" || TEST_MODE)
            {
                // if req.query.invalidate, don't bother
                if (util.isInvalidateTrue(req))
                {
                    return next();
                }

                var paths = configuration.paths;
                if (paths)
                {
                    for (var i = 0; i < paths.length; i++)
                    {
                        if (paths[i].regex && paths[i].cache)
                        {
                            var regex = new RegExp(paths[i].regex);
                            if (regex.test(req.path))
                            {
                                var cacheSettings = paths[i].cache;
                                if (typeof(cacheSettings) === "undefined")
                                {
                                    cacheSettings = {
                                        "seconds": MAXAGE_DEFAULT_SECONDS
                                    };
                                }

                                if (typeof(cacheSettings.seconds) === "undefined")
                                {
                                    cacheSettings.seconds = MAXAGE_DEFAULT_SECONDS;
                                }

                                if (cacheSettings.seconds <= -1)
                                {
                                    cacheSettings.seconds = MAXAGE_DEFAULT_SECONDS;
                                }

                                var cacheControl = null;
                                var expires = null;

                                if (cacheSettings.seconds === 0)
                                {
                                    cacheControl = "no-cache,no-store,max-age=0,s-maxage=0,must-revalidate";
                                    expires = ALREADY_EXPIRED_DATE;
                                }
                                else if (cacheSettings.seconds > 0)
                                {
                                    cacheControl = "public,max-age=" + cacheSettings.seconds + ",s-maxage=" + cacheSettings.seconds;
                                    expires = new Date(Date.now() + (cacheSettings.seconds * 1000)).toUTCString();
                                }

                                if (cacheControl)
                                {
                                    util.setHeaderOnce(res, "Cache-Control", cacheControl);
                                }

                                if (expires)
                                {
                                    util.setHeaderOnce(res, "Expires", expires);
                                }

                                // always remove pragma
                                util.removeHeader(res, "Pragma");
                            }
                        }
                    }
                }
            }

            next();
        });
    };

    /**
     * Supports post-proxy caching of resources based on mimetype.
     *
     * Configuration looks like:
     *
     * {
     *    "perf": {
     *       "enabled": true,
     *       "types": [{
     *          "regex": "text/html",
     *          "cache": {
     *              "seconds": 60 (or 0 for no cache and -1 for 1 year)
     *          }
     *       }]
     *    }
     * }
     *
     * @return {Function}
     */
    r.mimeTypePerformanceInterceptor = function()
    {
        return util.createInterceptor("perf", function(req, res, next, stores, cache, configuration) {

            // NOTE: if we're not in production mode, we don't do any of this
            if (process.env.CLOUDCMS_APPSERVER_MODE === "production" || TEST_MODE)
            {
                // if req.query.invalidate, don't bother
                if (util.isInvalidateTrue(req))
                {
                    return next();
                }

                var assetPath = req.path;
                if (assetPath)
                {
                    var queryString = null;
                    if (req.url.indexOf("?") > -1) {
                        queryString = req.url.substring(req.url.indexOf("?")  + 1);
                    }

                    var dir = path.dirname(assetPath);

                    var filename = path.basename(assetPath);
                    if (filename)
                    {
                        // does the filename look like: <originalFilename>-<key>.<ext>?
                        var originalFilename = null;
                        var key = null;
                        var extension = null;

                        // pull apart if possible
                        var car = filename;
                        var x = car.indexOf(".");
                        if (x > -1)
                        {
                            extension = car.substring(x+1);
                            car = car.substring(0,x);
                        }
                        else
                        {
                            extension = null;
                            car = filename;
                        }
                        var regex1 = new RegExp("-[0-9a-f]{32}$"); // md5
                        var regex2 = new RegExp("-[0-9]{13}$"); // timestamp?
                        var regex3 = new RegExp("-[0-9]{10}$"); // epoch millis
                        if (regex1.test(car) || regex2.test(car) || regex3.test(car))
                        {
                            var x = car.lastIndexOf("-");

                            originalFilename = car.substring(0,x);
                            key = car.substring(x+1);
                        }
                        else
                        {
                            originalFilename = car;
                            key = null;
                        }

                        // if we have a cache key, then we set headers to ALWAYS cache
                        // this uses a cache of MAXAGE_ONE_MONTH_SECONDS since it has the "key" and can guaranteed to to be unique
                        var cacheControl = null;
                        var expires = null;
                        if (key)
                        {
                            cacheControl = "public, max-age=" + MAXAGE_ONE_MONTH_SECONDS;
                            expires = new Date(Date.now() + (MAXAGE_ONE_MONTH_SECONDS * 1000)).toUTCString();
                        }
                        else if (extension)
                        {
                            // set cache based on file extension
                            var ext = path.extname(filename);
                            if (ext)
                            {
                                var mimetype = util.lookupMimeType(ext);
                                if (mimetype)
                                {
                                    // walk through all configured types
                                    var types = configuration.types;
                                    if (types)
                                    {
                                        for (var i = 0; i < types.length; i++)
                                        {
                                            if (types[i].regex && types[i].cache)
                                            {
                                                var regex = new RegExp(types[i].regex);
                                                if (regex.test(mimetype))
                                                {
                                                    var cacheSettings = types[i].cache;
                                                    if (typeof(cacheSettings) === "undefined")
                                                    {
                                                        cacheSettings = {
                                                            "seconds": MAXAGE_DEFAULT_SECONDS
                                                        };
                                                    }

                                                    if (typeof(cacheSettings.seconds) === "undefined")
                                                    {
                                                        cacheSettings.seconds = MAXAGE_DEFAULT_SECONDS;
                                                    }

                                                    if (cacheSettings.seconds <= -1)
                                                    {
                                                        cacheSettings.seconds = MAXAGE_DEFAULT_SECONDS;
                                                    }

                                                    if (cacheSettings.seconds === 0)
                                                    {
                                                        cacheControl = "no-cache,no-store,max-age=0,s-maxage=0,must-revalidate";
                                                        expires = ALREADY_EXPIRED_DATE;
                                                    }
                                                    else if (cacheSettings.seconds > 0)
                                                    {
                                                        cacheControl = "public,max-age=" + cacheSettings.seconds + ",s-maxage=" + cacheSettings.seconds;
                                                        expires = new Date(Date.now() + (cacheSettings.seconds * 1000)).toUTCString();
                                                    }
                                                }
                                            }
                                        }
                                    }

                                    // if we didn't set anything via configuration, apply a default?
                                    // this uses a default of MAXAGE_DEFAULT_SECONDS seconds
                                    if (!cacheControl)
                                    {
                                        var isCSS = ("text/css" == mimetype);
                                        var isImage = (mimetype.indexOf("image/") > -1);
                                        var isJS = ("text/javascript" == mimetype) || ("application/javascript" == mimetype);
                                        var isHTML = ("text/html" == mimetype);
                                        var isFont = ("application/font-woff" == mimetype);

                                        // html
                                        if (isHTML)
                                        {
                                            // don't touch html
                                        }

                                        // apply a default for css, images and js
                                        if (isCSS || isImage || isJS || isFont)
                                        {
                                            cacheControl = "public,max-age=" + MAXAGE_DEFAULT_SECONDS + ",s-maxage=" + MAXAGE_DEFAULT_SECONDS;
                                            expires = new Date(Date.now() + (MAXAGE_DEFAULT_SECONDS * 1000)).toUTCString();
                                        }
                                    }
                                }
                            }
                        }

                        // NO: we want to leave cache control untouched so that download stream middleware can handle it
                        // such as the cloudcms-server preview download or perhaps a custom middleware piece
                        /*
                        if (!cacheControl)
                        {
                            // set to no-cache
                            cacheControl = "no-cache,no-store,max-age=0,s-maxage=0,must-revalidate";
                            expires = ALREADY_EXPIRED_DATE;
                        }
                        */

                        if (cacheControl)
                        {
                            util.setHeaderOnce(res, "Cache-Control", cacheControl);
                        }

                        if (expires)
                        {
                            util.setHeaderOnce(res, "Expires", expires);
                        }

                        // always remove pragma
                        util.removeHeader(res, "Pragma");

                        // if we found a key, then strip it out from the url going forward
                        // this adjusts req.url (provided by node http module) and also req.path (which express auto-populates)
                        if (key)
                        {
                            var z2 = req.url.indexOf(key);
                            if (z2 > -1)
                            {
                                req.url = req.url.substring(0, z2 - 1) + req.url.substring(z2 + key.length);
                            }
                        }
                    }
                }
            }

            next();
        });
    };

    /**
     * Supports development no-cache.
     *
     * @return {Function}
     */
    r.developmentPerformanceInterceptor = function()
    {
        return function(req, res, next)
        {
            // NOTE: if we're not in production mode, we don't do any of this
            if (process.env.CLOUDCMS_APPSERVER_MODE === "production" || TEST_MODE)
            {
                return next();
            }

            util.setHeaderOnce(res, "Cache-Control", "no-cache,no-store,max-age=0,s-maxage=0,must-revalidate");
            util.setHeaderOnce(res, "Expires", ALREADY_EXPIRED_DATE);

            // always remove pragma
            util.removeHeader(res, "Pragma");

            next();
        }
    };

    return r;
}();





