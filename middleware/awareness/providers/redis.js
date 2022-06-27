var AbstractAsyncProvider = require("./abstract-async");

//var redis = require("redis");
var async = require("async");

var logFactory = require("../../../util/logger");
//var redisHelper = require("../../../util/redis");

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
        
        redisClientFactory.create(config, function(err, _client) {
            
            if (err) {
                return callback(err);
            }
            
            self.client = _client;
            
            return callback();
            
        });
        
        (async function() {
            var redisOptions = redisHelper.redisOptions(this.config, "CLOUDCMS_AWARENESS");
            await redisHelper.createAndConnect(redisOptions, function(err, _client) {
            
            });
        })();
    }
    
    readOrCreateChannel(channelId, callback)
    {
        var self = this;
        
        (async function() {
            
            await self.client.get("channel-" + channelId, function(err, channelJsonText) {
                
                if (err) {
                    return callback(err);
                }
                
                if (channelJsonText)
                {
                    var channel = JSON.parse("" + channelJsonText);
                    return callback(null, channel);
                }
                
                (async function() {
                    var channel = {};
                    await self.client.set("channel-" + channelId, JSON.stringify(channel), function (err) {
                        
                        if (err) {
                            return callback(err);
                        }
                        
                        callback(null, channel);
                    });
                })();
            });
            
        })();
    };
    
    readChannel(channelId, callback)
    {
        var self = this;
        
        (async function() {
            
            await self.client.get("channel-" + channelId, function(err, channelJsonText) {
                
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
            
        })();
    };
    
    writeChannel(channelId, channel, callback)
    {
        var self = this;
        
        (async function() {
            
            await self.client.set("channel-" + channelId, JSON.stringify(channel), function(err) {
                
                if (err) {
                    return callback(err);
                }
                
                callback();
            });
            
        })();
    };
    
    listChannelIds(callback)
    {
        var self = this;
        
        (async function() {
            
            // fetch all keys for channels
            await self.client.keys("channel-*", function(err, channelKeys) {
                
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
        })();
    };
    
    /**
     * @override
     */
    expire(beforeMs, callback)
    {
        var self = this;
        
        self.listChannelIds(function(err, channelIds) {
            
            if (err) {
                return callback(err);
            }
            
            if (!channelIds || channelIds.length === 0) {
                return callback(null, [], {});
            }
            
            // a list of channel IDs whose memberships were updated
            var updatedMembershipChannelIds = [];
            var expiredUserIdsByChannelId = {};
            
            var fns = [];
            
            for (var i = 0; i < channelIds.length; i++)
            {
                var channelId = channelIds[i];
                
                var fn = function (channelId, updatedMembershipChannelIds, expiredUserIdsByChannelId, beforeMs) {
                    return function (done) {
                        
                        self.readChannel(channelId, function(err, channel) {
                            
                            if (err) {
                                return done(err);
                            }
                            
                            if (!channel) {
                                return done();
                            }
                            
                            if (channel.users)
                            {
                                // populate all of the user IDs that need to be removed
                                var userIdsToRemove = [];
                                for (var userId in channel.users)
                                {
                                    var entry = channel.users[userId];
                                    if (entry.time < beforeMs)
                                    {
                                        updatedMembershipChannelIds.push(channelId);
                                        userIdsToRemove.push(userId);
                                        
                                        var expiredUserIds = expiredUserIdsByChannelId[channelId]
                                        if (!expiredUserIds) {
                                            expiredUserIds = expiredUserIdsByChannelId[channelId] = [];
                                        }
                                        
                                        expiredUserIds.push(userId);
                                    }
                                }
                                
                                // remove the user IDs
                                for (var i = 0; i < userIdsToRemove.length; i++)
                                {
                                    delete channel.users[userIdsToRemove[i]];
                                }
                                
                                self.writeChannel(channelId, channel, function() {
                                    done();
                                });
                            }
                            
                        });
                    };
                }(channelId, updatedMembershipChannelIds, expiredUserIdsByChannelId, beforeMs);
                fns.push(fn);
            }
            
            async.parallel(fns, function(err) {
                
                if (err) {
                    return callback(err);
                }
                
                callback(null, updatedMembershipChannelIds, expiredUserIdsByChannelId);
            });
        });
    };
    
    readLock(lockId, callback)
    {
        var self = this;
        
        (async function() {
            
            await self.client.get("lock-" + lockId, function(err, lockJsonText) {
                
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
        })();
    };
    
    writeLock(lockId, lock, callback)
    {
        var self = this;
        
        (async function() {
            
            await self.client.set("lock-" + lockId, JSON.stringify(lock), function(err) {
                
                if (err) {
                    return callback(err);
                }
                
                callback();
            });
            
        })();
    };
    
    deleteLock(lockId, callback)
    {
        var self = this;
        
        (async function() {
            
            await self.client.del("lock-" + lockId, function(err) {
                
                if (err) {
                    return callback(err);
                }
                
                callback();
            });
            
        })();
    };
    
    listLockIds(callback)
    {
        var self = this;
        
        (async function() {
            
            // fetch all keys for locks
            await self.client.keys("lock-*", function(err, lockKeys) {
                
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
            
        })();
    };
    
    acquireSession(sessionId, callback)
    {
        var self = this;
        
        (async function() {
            
            await self.client.get("session-" + sessionId, function(err, sessionJsonText) {
                
                if (err) {
                    return callback(err);
                }
                
                if (sessionJsonText)
                {
                    var session = JSON.parse("" + sessionJsonText);
                    return callback(null, session);
                }
                
                // create a new session
                (async function() {
                    var session = {};
                    await self.client.set("session-" + sessionId, JSON.stringify(session), function(err) {
                        
                        if (err) {
                            return callback(err);
                        }
                        
                        callback(null, session);
                    });
                })();
            });
        })();
    }
    
    updateSession(sessionId, session, callback)
    {
        var self = this;
        
        if (!session) {
            session = {};
        }
        
        (async function() {
            
            // create a new session
            await self.client.set("session-" + sessionId, JSON.stringify(session), function (err) {
                
                if (err) {
                    return callback(err);
                }
                
                callback(null, session);
            });
        })();
    }
    
    deleteSession(sessionId, callback)
    {
        var self = this;
        
        (async function() {
            await self.client.del("session-" + sessionId, function (err) {
                
                if (err) {
                    return callback(err);
                }
                
                callback();
            });
        })();
    }
    
}

module.exports = RedisProvider;