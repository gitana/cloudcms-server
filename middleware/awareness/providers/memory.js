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

        // session ID -> {}
        this.sessionMap = {};
    }

    // IMPLEMENT ABSTRACT INTERFACE METHODS

    init(callback)
    {
        // nothing to do
        callback();
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

    acquireSession(sessionId, callback)
    {
        var self = this;

        var session = self.sessionMap[sessionId];
        if (!session) {
            session = self.sessionMap[sessionId] = {};
        }

        callback(null, session);
    }

    updateSession(sessionId, session, callback)
    {
        var self = this;

        self.sessionMap[sessionId] = session;

        callback();
    }

    deleteSession(sessionId, callback)
    {
        var self = this;

        delete self.sessionMap[sessionId];

        callback();
    }
}

module.exports = MemoryProvider;