/**
 * In-memory awareness.
 *
 * @type {*}
 */
exports = module.exports = function()
{
    var valueMap = null;
    var expirationTimeMap = null;

    var r = {};

    r.init = function(config, callback)
    {
        valueMap = {};
        expirationTimeMap = {};

        callback();
    };

    r.register = function(user, object, action, seconds, callback) 
    {
        var TTL = 10;
        if (typeof(seconds) == "undefined" || seconds <= -1)
        {
            seconds = TTL;
        }
        expirationTimeMap[key] = new Date().getTime() + (seconds * 1000);

        if (!user.id || !object.id || !action.id) {
            var msg = "user, object and action each should have an id."
            logger.error("register error. " + msg);
            return callback(msg);
        }

        var key = user.id + ":" + action.id + ":" + object.id;
        var value = {
            "user": user,
            "object": object,
            "action": action
        };

        valueMap[key] = value;

        callback(null, JSON.stringify(value));
    };

    r.discover = function(regexString, callback)
    {
        var regex = new RegExp(regexString);
        // find keys that match the regex
        var matchedKeys = [];

        for (var key in valueMap)
        {
            if (key.match(regex))
            {
                matchedKeys.push(key);
            }
        }

        // read value for all matched keys from memory
        var values = [];
        matchedKeys.forEach(function(key) {
            values.push(valueMap[key]);
        });

        callback(null, values);
    };

    return r;
}();