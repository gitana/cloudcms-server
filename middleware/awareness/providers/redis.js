var AbstractAsyncProvider = require("./abstract-async");

var redis = require("redis");

var logFactory = require("../../../util/logger");

class RedisProvider extends AbstractAsyncProvider
{
    constructor(config)
    {
        super(config);

        this.logger = logFactory("REDIS CACHE");

        // allow for global redis default
        // allow for redis broadcast specific
        // otherwise default to error
        if (typeof(process.env.CLOUDCMS_REDIS_DEBUG_LEVEL) !== "undefined") {
            this.logger.setLevel(("" + process.env.CLOUDCMS_REDIS_DEBUG_LEVEL).toLowerCase(), true);
        }
        else if (typeof(process.env.CLOUDCMS_AWARENESS_REDIS_DEBUG_LEVEL) !== "undefined") {
            this.logger.setLevel(("" + process.env.CLOUDCMS_AWARENESS_REDIS_DEBUG_LEVEL).toLowerCase(), true);
        }
        else {
            this.logger.setLevel("error");
        }
    }

    init(callback)
    {
        var self = this;

        var redisPort = this.config.port;
        if (typeof(redisPort) === "undefined" || !redisPort)
        {
            redisPort = process.env.CLOUDCMS_CACHE_REDIS_PORT;
        }
        if (typeof(redisPort) === "undefined" || !redisPort)
        {
            redisPort = process.env.CLOUDCMS_REDIS_PORT;
        }

        var redisHost = this.config.host;
        if (typeof(redisHost) === "undefined" || !redisHost)
        {
            redisHost = process.env.CLOUDCMS_CACHE_REDIS_ENDPOINT;
        }
        if (typeof(redisHost) === "undefined" || !redisHost)
        {
            redisHost = process.env.CLOUDCMS_REDIS_ENDPOINT;
        }

        var redisOptions = {};

        this.client = redis.createClient(redisPort, redisHost, redisOptions);

        callback();
    }

    readOrCreateChannel(channelId, callback)
    {
        var self = this;

        self.client.get("channel-" + channelId, function(err, channelJsonText) {

            if (err) {
                return callback(err);
            }

            if (channelJsonText)
            {
                var channel = JSON.parse("" + channelJsonText);
                return callback(null, channel);
            }

            var channel = {};
            self.client.set("channel-" + channelId, JSON.stringify(channel), function(err) {

                if (err) {
                    return callback(err);
                }

                callback(null, channel);
            });
        });
    };

    readChannel(channelId, callback)
    {
        var self = this;

        self.client.get("channel-" + channelId, function(err, channelJsonText) {

            if (err) {
                return callback(err);
            }

            if (channelJsonText)
            {
                var channel = JSON.parse("" + channelJsonText);
                return callback(null, channel);
            }

            callback();
        });
    };

    writeChannel(channelId, channel, callback)
    {
        var self = this;

        self.client.set("channel-" + channelId, JSON.stringify(channel), function(err) {

            if (err) {
                return callback(err);
            }

            callback();
        });
    };

    listChannelIds(callback)
    {
        var self = this;

        // fetch all keys for channels
        self.client.keys("channel-*", function(err, channelKeys) {

            if (err)
            {
                return callback(err);
            }

            if (!channelKeys || channelKeys.length === 0)
            {
                return callback(null, []);
            }

            var channelIds = [];
            for (var i = 0; i < channelKeys.length; i++)
            {
                var channelId = channelKeys[i].substring(channelKeys[i].indexOf("-") + 1);
                channelIds.push(channelId);
            }

            callback(null, channelIds);
        });
    };

    readLock(lockId, callback)
    {
        var self = this;

        self.client.get("lock-" + lockId, function(err, lockJsonText) {

            if (err) {
                return callback(err);
            }

            if (lockJsonText)
            {
                var lock = JSON.parse("" + lockJsonText);
                return callback(null, lock);
            }

            callback();
        });
    };

    writeLock(lockId, lock, callback)
    {
        var self = this;

        self.client.set("lock-" + lockId, JSON.stringify(lock), function(err) {

            if (err) {
                return callback(err);
            }

            callback();
        });
    };

    deleteLock(lockId, callback)
    {
        var self = this;

        self.client.del("lock-" + lockId, function(err) {

            if (err) {
                return callback(err);
            }

            callback();
        });
    };

    listLockIds(callback)
    {
        var self = this;

        // fetch all keys for locks
        self.client.keys("lock-*", function(err, lockKeys) {

            if (err)
            {
                return callback(err);
            }

            if (!lockKeys || lockKeys.length === 0)
            {
                return callback(null, []);
            }

            var lockIds = [];
            for (var i = 0; i < lockKeys.length; i++)
            {
                var lockId = lockKeys[i].substring(0, lockKeys[i].indexOf("-"));
                lockIds.push(lockId);
            }

            callback(null, lockIds);
        });
    };
}

module.exports = RedisProvider;