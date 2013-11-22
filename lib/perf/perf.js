var path = require('path');
var fs = require('fs');
var http = require('http');

var mime = require("mime");

exports = module.exports = function(config)
{
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var MAXAGE_ONE_YEAR = 31536000;
    var MAXAGE_ONE_HOUR = 3600;
    var MAXAGE_ONE_WEEK = 604800;

    var r = {};

    /**
     * Supports virtual hosts for locally deployed/published assets.
     * Files are served from:
     *
     *   /hosts
     *     /abc.cloudcms.net
     *       /public
     *
     * @return {Function}
     */
    r.cacheHeaderInterceptor = function()
    {
        return function(req, res, next)
        {
            var test = false;

            // if the performance cache is enabled
            if (config && config.perf && config.perf.enabled)
            {
                // NOTE: if we're not in production mode, we don't do any of this
                if (process.env.CLOUDCMS_APPSERVER_MODE == "production" || test)
                {
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
                            // does the filename look like: <originalFilename>-CMS<key>.<ext>?
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
                            x = car.indexOf("-CMS");
                            if (x > -1)
                            {
                                originalFilename = car.substring(0,x);
                                key = car.substring(x+4);
                            }
                            else
                            {
                                originalFilename = car;
                                key = null;
                            }

                            // if we have a cache key, then we set headers to ALWAYS cache
                            var cacheControl = null;
                            if (key)
                            {
                                //res.setHeader('Cache-Control', 'public, max-age=' + (this._maxage / 1000));
                                //res.setHeader("Cache-Control", "no-cache");
                                //res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
                                cacheControl = "public, max-age=2592000"; // 30 days
                            }
                            else if (extension)
                            {
                                var ext = path.extname(filename);
                                if (ext)
                                {
                                    var mimetype = mime.lookup(ext);
                                    if (mimetype)
                                    {
                                        var isCSS = ("text/css" == mimetype);
                                        var isImage = (mimetype.indexOf("image/") > -1);
                                        var isJS = ("text/javascript" == mimetype) || ("application/javascript" == mimetype);
                                        var isHTML = ("text/html" == mimetype);

                                        // html
                                        if (isHTML)
                                        {
                                            cacheControl = "public, max-age=" + MAXAGE_ONE_HOUR;
                                        }

                                        // css, images and js get 1 year
                                        if (isCSS || isImage || isJS)
                                        {
                                            cacheControl = "public, max-age=" + MAXAGE_ONE_YEAR;
                                        }
                                    }
                                }
                            }

                            if (!cacheControl)
                            {
                                // set to no-cache
                                cacheControl = "no-cache";
                            }

                            //res.setHeader("Cache-Control", cacheControl);
                            res.header('Cache-Control', cacheControl);

                            // set new url
                            var newUrl = path.join(dir, originalFilename);
                            if (extension) {
                                newUrl += "." + extension
                            }
                            if (queryString) {
                                newUrl += "?" + queryString;
                            }
                            req.url = newUrl;
                        }
                    }
                }
            }

            next();
        };
    };

    return r;
};





