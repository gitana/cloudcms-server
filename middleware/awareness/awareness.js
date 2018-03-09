var util = require("../../util/util");
var logFactory = require("../../util/logger");

/**
 * Awareness middleware.
 *
 * @type {Function}
 */
exports = module.exports = function()
{
    var logger = logFactory("AWARENESS");

    var provider = null;

    var r = {};
    var init = r.init = function(callback) {
        var type = process.configuration.awareness.type;
        if (!type) {
            type = "memory";    // default type to "memory"
        }

        var config = process.configuration.awareness.config;
        if (!config) {
            config = {};
        }

        provider = require("./providers/" + type);
        logger.info("Provider is required from: ./providers/" + type);
        provider.init(config, function(err){
            callback(err);
        });
    };

    /**
     * Provides handlers for awareness operations.
     *
     * @return {Function}
     */
    r.awarenessHandler = function()
    {
        return util.createHandler("awareness", function(req, res, next, stores, cache, configuration) {

            if (req.method.toLowerCase() === "post")
            {
                if (req.path.indexOf("/_awareness/register") === 0)
                {
                    var info = req.body;

                    var user = info.user;
                    var object = info.object;
                    var action = info.action;
                    var seconds = info.seconds;

                    return register(user, object, action, seconds, function(err, reply) {
                        res.json(reply);
                        res.status(200);
                        res.end();
                    });
                }
                if (req.path.indexOf("/_awareness/discover") === 0)
                {
                    var reqObj = req.body;                 

                    return discover(reqObj, function(err, reply) {
                        res.json(reply);
                        res.status(200);
                        res.end();
                    });
                }
            }

            next();

        });
    };

    var register = r.register = function(user, object, action, seconds, callback)
    {
        provider.register(user, object, action, seconds, function(err, value) {
            callback(err, value);
        });
    };

    var discover = r.discover = function(reqObj, callback)
    {        
        provider.discover(reqObj, function(err, value) {
            callback(err, value);
        });
    };

    return r;
}();