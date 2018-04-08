var AbstractProvider = require("./abstract");

var async = require("async");

/**
 * Abstract class for an Awareness Provider that uses Asynchronous callbacks.
 *
 * This provides implementation methods for the AbstractProvider that call into smaller, abstract methods that are
 * easy to extend for a variety of cases.  This is the foundation class for the Memory and Redis Awareness Providers.
 */
class AbstractAsyncProvider extends AbstractProvider
{
    constructor(config)
    {
        super(config);
    }

    readOrCreateChannel(channelId, callback) {

        var self = this;

        self.readChannel(channelId, function(err, channel) {

            if (err) {
                return callback(err);
            }

            if (channel) {
                return callback(null, channel);
            }

            var channel = {};
            self.writeChannel(channelId, channel, function(err) {

                if (err) {
                    return callback(err);
                }

                callback(null, channel);
            });
        });
    }

    // IMPLEMENT ABSTRACT INTERFACE METHODS

    register(channelId, user, callback)
    {
        var self = this;

        self.readOrCreateChannel(channelId, function (err, channel) {

            if (err) {
                return callback(err);
            }

            if (!channel.users) {
                channel.users = {};
            }

            channel.users[user.id] = {
                "user": user,
                "time": new Date().getTime()
            };

            self.writeChannel(channelId, channel, function (err) {
                callback(err);
            });
        });
    }

    discover(channelId, callback)
    {
        var self = this;

        self.readChannel(channelId, function (err, channel) {

            if (err) {
                return callback(err);
            }

            if (!channel) {
                return callback(null, []);
            }

            var array = [];

            if (channel.users)
            {
                for (var userId in channel.users)
                {
                    var entry = channel.users[userId];
                    if (entry && entry.user)
                    {
                        array.push(entry.user);
                    }
                }
            }

            callback(null, array);

        });
    }

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

                            var updatedMembership = false;

                            if (channel.users)
                            {
                                // populate all of the user IDs that need to be removed
                                var userIdsToRemove = [];
                                for (var userId in channel.users)
                                {
                                    var entry = channel.users[userId];
                                    if (entry.time < beforeMs)
                                    {
                                        updatedMembership = true;
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
                            }

                            if (updatedMembership)
                            {
                                updatedMembershipChannelIds.push(channelId);
                            }

                            done();
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
    }

    checkRegistered(channelId, userId, callback)
    {
        var self = this;

        self.readChannel(channelId, function(err, channel) {

            if (err) {
                return callback(err);
            }

            if (!channel) {
                return callback(null, false);
            }

            if (!channel.users) {
                return callback(null, false);
            }

            if (channel.users[userId]) {
                return callback(null, true);
            }

            callback(null, false);

        });
    }

    acquireLock(channelId, user, callback)
    {
        var self = this;

        self.readLock(channelId, function(err, lock) {

            if (err) {
                return callback(err);
            }

            if (lock)
            {
                return callback({
                    "message": "The channel: " + channelId + " is already locked by: " + lock.user.id
                });
            }

            lock = {
                "user": user,
                "lockTime": Date.now()
            };

            self.writeLock(channelId, lock, function(err) {

                if (err) {
                    return callback(err);
                }

                // callback with true to indicate success
                callback(null, true);
            });
        });
    }

    releaseLock(channelId, userId, callback)
    {
        var self = this;

        self.readLock(channelId, function(err, lock) {

            if (err) {
                return callback(err);
            }

            if (!lock)
            {
                return callback({
                    "message": "A lock does not currently exist for channel: " + channelId
                });
            }

            if (lock.user.id !== userId)
            {
                return callback({
                    "message": "The channel: " + channelId + " has a lock but it is not owned by: " + userId
                });
            }

            self.deleteLock(channelId, function(err) {

                if (err) {
                    return callback(err);
                }

                // callback with true to indicate success
                callback(null, true);
            });

        });
    }

    lockInfo(channelId, callback)
    {
        var self = this;

        self.readLock(channelId, function(err, lock) {

            if (err)
            {
                return callback(err);
            }

            callback(null, lock);
        });
    }


    //////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // ABSTRACT METHODS
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////

    // ABSTRACT
    readChannel(channelId, callback)
    {
        throw new Error("readChannel() method is not implemented");
    }

    // ABSTRACT
    writeChannel(channelId, channel, callback)
    {
        throw new Error("writeChannel() method is not implemented");
    }

    // ABSTRACT
    listChannelIds(callback)
    {
        throw new Error("listChannelIds() method is not implemented");
    }

    // ABSTRACT
    readLock(lockId, callback)
    {
        throw new Error("readLock() method is not implemented");
    }

    // ABSTRACT
    writeLock(lockId, lock, callback)
    {
        throw new Error("writeLock() method is not implemented");
    }

    // ABSTRACT
    deleteLock(lockId, callback)
    {
        throw new Error("deleteLock() method is not implemented");
    }

    // ABSTRACT
    listLockIds(callback)
    {
        throw new Error("listLockIds() method is not implemented");
    }

}

module.exports = AbstractAsyncProvider;