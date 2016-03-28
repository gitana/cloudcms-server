var path = require('path');
var fs = require('fs');
var http = require('http');

var util = require("../../util/util");

/**
 * Final middleware.
 *
 * If nothing else trips in the handler chain, we pass back a 404.
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
     * Hands back a 404 unless configured to redirect instead. ex.:
     * 
     *     "final": {
     *         "enabled": true,
     *         "redirectUrl": "/404.html",
     *         "includeUrlHash": true,
     *         "prefixList": ["/path1/", "/path2/"]
     *     }
     * 
     * @return {Function}
     */
    r.finalHandler = function()
    {
        var config = {"enabled": false};
        if (process.configuration.final)
        {
            config = process.configuration.final || {"enabled": false};
        }
        
        if (config.enabled)
        {
            var redirectUrl = config.redirectUrl || "/index.html";
            var prefixList = config.prefixList || ["/"];
            var includeUrlHash = !!config.includeUrlHash;
            
            return util.createHandler("final", function(req, res, next, stores, cache, configuration) {
                var targetUrl = redirectUrl;
                if (includeUrlHash)
                {
                    targetUrl += "/#" + req.path;
                }
                
                for(var i = 0; i < prefixList.length; i++)
                {
                    if (req.path.startsWith(prefixList[i]))
                    {
                        return res.redirect(targetUrl);
                    }
                }

                util.status(res, 404).end();
            });
        }
        
        return util.createHandler("final", function(req, res, next, stores, cache, configuration) {
            util.status(res, 404).end();
        });
    };

    return r;
}();





