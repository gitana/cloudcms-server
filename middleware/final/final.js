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
            var configTargetUrl = config.targetUrl || "/index.html";
            var prefixList = config.prefixList || ["/"];
            var includeUrlHash = !!config.includeUrlHash;
            var useRedirect = !!config.useRedirect;
            
            return util.createHandler("final", function(req, res, next, stores, cache, configuration) {
                var targetUrl = configTargetUrl;
                if (includeUrlHash)
                {
                    targetUrl += "/#" + req.path;
                }
                
                for(var i = 0; i < prefixList.length; i++)
                {
                    if (req.path.indexOf(prefixList[i]) === 0)
                    {
                        if (useRedirect) {
                            return res.redirect(targetUrl);
                        } else {
                            return res.sendFile(targetUrl, {root: './public/'});
                        }
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





