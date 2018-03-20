/**
 * In-memory awareness.
 *
 * @type {*}
 */
exports = module.exports = function()
{
    var valueMap = null;

    var r = {};

    r.init = function(config, callback)
    {
        valueMap = {};

        callback();
    };

    r.register = function(user, object, action, callback) 
    {
        if (!user.id || !object.id || !action.id) {
            var msg = "Each of user, object and action should have an id."
            return callback(msg);
        }

        var key = user.id + ":" + action.id + ":" + object.id;
        var value = {
            "user": user,
            "object": object,
            "action": action,
            "time": Date.now()
        };

        valueMap[key] = value;

        callback(null, JSON.stringify(value));
    };

    r.discover = function(reqObj, callback)
    {
        var values = [];
        
        if (reqObj.regex) 
        {
            var regexString = reqObj.regex;
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
    
            // read values for all matched keys from memory
            matchedKeys.forEach(function(key) {
                values.push(valueMap[key]);
            });    
        }

        callback(null, values);
    };

    r.checkOld = function(now, age, callback) 
    {
        // a set of room ids that are updated
        var rooms = new Set();

        // for each record, check time
        for (var key in valueMap)
        {
            var value = valueMap[key];
            var elapsed = now - value.time;
            if (elapsed > age) {
                var roomId = value.action.id + ":" + value.object.id;
                rooms.add(roomId);

                delete valueMap[key];
            }
        }

        callback(rooms);
    };

    r.checkNew = function(key, callback) 
    {
        if (valueMap.hasOwnProperty(key)) {
            callback(false);
        }
        else {
            callback(true);
        }
    };

    return r;
}();