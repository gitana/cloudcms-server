/**
 * In-memory awareness.
 *
 * @type {*}
 */
exports = module.exports = function()
{
    /*
    valueMap = {
        "channelId1": {
            "user1": {user, time},
            "user2": {user, time}
        }
    };
    */
    var valueMap = null;    // key: channelId   value: userMap
    var lockMap = null;     // key: channelId   value: an object with lockTime and user

    var r = {};

    r.init = function(config, callback)
    {
        valueMap = {};
        lockMap = {};

        callback();
    };

    r.register = function(channelId, user, callback)
    {
        var userMap = valueMap[channelId];
        if (!userMap) {
            userMap = valueMap[channelId] = {};
        }

        var value = {
            "user": user,
            "time": Date.now()
        };

        userMap[user.id] = value;

        callback(JSON.stringify(value));
    };

    r.discover = function(channelId, callback) 
    {
        var userMap = valueMap[channelId];

        var array = [];
        for (var k in userMap) {
            array.push(userMap[k]);
        }

        callback(array);
    };

    r.checkOld = function(lifeTime, callback) 
    {
        // a set of channels that are updated
        var channels = new Set();

        for (var channelId in valueMap)
        {
            var userMap = valueMap[channelId];
            for (var user in userMap) {
                var value = userMap[user];
                var elapsed = Date.now() - value.time;
                if (elapsed > lifeTime) {
                    channels.add(channelId);
                    delete userMap[user];
                }    
            }
        }
        callback(channels);
    };

    r.checkNew = function(channelId, user, callback) 
    {
        var userMap = valueMap[channelId];
        if (!userMap) {
            callback(true);
        }
        else if (!userMap[user.id]) {
            callback(true);
        }
        else {
            callback(false);
        }
    };

    r.acquireLock = function(info, callback)
    {
        var channelId = info.action.id + ":" + info.object.id;

        if (!lockMap[channelId]) {
            lockMap[channelId] = {
                "lockTime": Date.now(),
                "user": info.user
            };
        }

        var res = {
            "acquireInfo": lockMap[channelId],
        };

        callback(res);
    };

    r.releaseLock = function(info, callback)
    {
        var channelId = info.channelId;
        var userId = info.userId;
        var lockInfo = lockMap[channelId];

        var releaseInfo = {};

        // the channel is locked and the releaser possesses the lock
        if (lockInfo && lockInfo.user.id == userId) 
        {
            lockMap[channelId] = undefined;
            releaseInfo.released = true;
        }
        else {
            releaseInfo.released = false;
            releaseInfo.lockStatus = lockInfo? "locked" : "unlocked";
        }

        var res = {
            "releaseInfo": releaseInfo
        };
        
        callback(res);
    };

    return r;
}();