/**
 * Abstract class for an Awareness Provider.
 *
 * This class provides an interface or base functions that any implementation class must implement in order to
 * work with the Awareness Service.  Any methods that
 *
 */
class AbstractProvider
{
    constructor(config)
    {
        this.config = config || {};
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // ABSTRACT METHODS
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////

    init(callback)
    {
        throw new Error("init() method is not implemented");
    }

    register(channelId, user, callback)
    {
        throw new Error("register() method is not implemented");
    }

    discover(channelId, callback)
    {
        throw new Error("discover() method is not implemented");
    }

    expire(beforeMs, callback)
    {
        throw new Error("expire() method is not implemented");
    }

    checkRegistered(channelId, userId, callback)
    {
        throw new Error("checkRegistered() method is not implemented");
    }

    acquireLock(lockId, user, callback)
    {
        throw new Error("acquireLock() method is not implemented");
    }

    releaseLock(lockId, userId, callback)
    {
        throw new Error("releaseLock() method is not implemented");
    }

    lockInfo(lockId, callback)
    {
        throw new Error("lockInfo() method is not implemented");
    }

    acquireSession(sessionId, callback)
    {
        throw new Error("acquireSession() method is not implemented");
    }

    updateSession(sessionId, session, callback)
    {
        throw new Error("updateSession() method is not implemented");
    }

    deleteSession(sessionId, callback)
    {
        throw new Error("deleteSession() method is not implemented");
    }
}

module.exports = AbstractProvider;