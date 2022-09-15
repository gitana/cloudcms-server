var AbstractAsyncProvider = require("./abstract-async");

var redisClientFactory = require("../../../clients/redis");
const redisHelper = require("../../../util/redis");

class RedisProvider extends AbstractAsyncProvider
{
    constructor(config)
    {
        super(config);
    
        this.logger = redisHelper.redisLogger("REDIS_AWARENESS", "CLOUDCMS_AWARENESS_", "error")
    }

    init(callback)
    {
        var self = this;
    
        redisClientFactory.create(self.config, function(err, _client) {
    
            if (err) {
                return callback(err);
            }
    
            self.client = _client;
    
            return callback();
    
        });
    }

    readChannel(channelId, callback)
    {
        var self = this;
    
        (async function() {
    
            try
            {
                var channel = null;
                
                var channelJsonText = await self.client.get("channel-" + channelId);
                if (channelJsonText)
                {
                    channel = JSON.parse("" + channelJsonText);
                }
    
                callback(null, channel);
            }
            catch (err)
            {
                return callback(err);
            }
            
        })();
    };

    writeChannel(channelId, channel, callback)
    {
        var self = this;
    
        (async function() {
    
            try
            {
                await self.client.set("channel-" + channelId, JSON.stringify(channel));
                
                callback();
            }
            catch (err)
            {
                return callback(err);
            }
            
        })();
    };

    listChannelIds(callback)
    {
        var self = this;
    
        (async function() {

            try
            {
                var channelKeys = await self.client.keys("channel-*");
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
            }
            catch (err)
            {
                callback(err);
            }
            
        })();
    };

    readLock(lockId, callback)
    {
        var self = this;
    
        (async function() {

            try
            {
                var lock = null;
                
                var lockJsonText = await self.client.get("lock-" + lockId);
                if (lockJsonText)
                {
                    lock = JSON.parse("" + lockJsonText);
                }
    
                callback(null, lock);
            }
            catch (err)
            {
                callback(err);
            }
            
        })();
    };

    writeLock(lockId, lock, callback)
    {
        var self = this;
        
        (async function() {
    
            try
            {
                await self.client.set("lock-" + lockId, JSON.stringify(lock));
                
                callback();
            }
            catch (err)
            {
                callback(err);
            }
            
        })();
    };

    deleteLock(lockId, callback)
    {
        var self = this;
    
        (async function() {
    
            try
            {
                await self.client.del("lock-" + lockId);

                callback();
            }
            catch (err)
            {
                callback(err);
            }
            
        })();
    };

    listLockIds(callback)
    {
        var self = this;
    
        (async function() {
            
            try
            {
                var lockKeys = await self.client.keys("lock-*");
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
            }
            catch (err)
            {
                callback(err);
            }
            
        })();
    };

    acquireSession(sessionId, callback)
    {
        var self = this;
    
        (async function() {
            
            var session = null;
            
            try
            {
                var sessionJsonText = await self.client.get("session-" + sessionId);
                if (sessionJsonText)
                {
                    session = JSON.parse("" + sessionJsonText);
                }
                
                if (session)
                {
                    return callback(null, session);
                }
    
                // create a new session
                session = {};
                await self.client.set("session-" + sessionId, JSON.stringify(session));
    
                callback(null, session);
            }
            catch (err)
            {
                callback(err);
            }
            
        })();
    }

    updateSession(sessionId, session, callback)
    {
        var self = this;
    
        if (!session) {
            session = {};
        }
    
        (async function() {
    
            try
            {
                await self.client.set("session-" + sessionId, JSON.stringify(session));
    
                callback(null, session);
            }
            catch (err)
            {
                callback(err);
            }
            
        })();
    }

    deleteSession(sessionId, callback)
    {
        var self = this;
        
        (async function() {
    
            try
            {
                await self.client.del("session-" + sessionId);
    
                callback();
            }
            catch (err)
            {
                callback(err);
            }
            
        })();
    }

}

module.exports = RedisProvider;