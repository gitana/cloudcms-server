var AbstractAsyncProvider = require("./abstract-async");

class MemoryProvider extends AbstractAsyncProvider
{
    constructor(config)
    {
        super(config);

        // channel ID -> { "users": { userId: { user, lockTime } } }
        this.channelMap = {};

        // channel ID -> { lockTime, user }
        this.lockMap = {};
    }

    // IMPLEMENT ABSTRACT INTERFACE METHODS

    init(callback)
    {
        // nothing to do
        callback();
    }

    readOrCreateChannel(channelId, callback)
    {
        var self = this;

        var channel = self.channelMap[channelId];
        if (channel) {
            return callback(null, channel);
        }

        channel = self.channelMap[channelId] = {};

        callback(null, channel);
    }

    readChannel(channelId, callback)
    {
        var self = this;

        var channel = self.channelMap[channelId];
        if (!channel) {
            return callback();
        }

        callback(null, channel);
    }

    writeChannel(channelId, channel, callback)
    {
        var self = this;

        self.channelMap[channelId] = channel;

        callback();
    }

    listChannelIds(callback)
    {
        var self = this;

        var channelIds = [];

        for (var channelId in self.channelMap) {
            channelIds.push(channelId);
        }

        callback(null, channelIds);
    };

    readLock(lockId, callback)
    {
        var self = this;

        var lock = self.lockMap[lockId];

        callback(null, lock);
    }

    writeLock(lockId, lock, callback)
    {
        var self = this;

        self.lockMap[lockId] = lock;

        callback();
    }

    deleteLock(lockId, callback)
    {
        var self = this;

        delete self.lockMap[lockId];

        callback();
    }

    listLockIds(callback)
    {
        var self = this;

        var lockIds = [];

        for (var lockId in self.lockMap) {
            lockIds.push(lockId);
        }

        callback(null, lockIds);
    }
}

module.exports = MemoryProvider;