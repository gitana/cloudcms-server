var util = require("../../util/util");
var logFactory = require("../../util/logger");
var async = require("async");

/**
 * Awareness middleware.
 *
 * @type {Function}
 */
exports = module.exports = function()
{
    var logger = logFactory("AWARENESS");
    var provider = null;
    var REAP_FREQUENCY_MS = 3000; // three seconds
    var REAP_MAX_AGE_MS = 5000; // five seconds

    var pluginPaths = ["./plugins/editorial"];
    var plugins = {};

    // ensure reaper only initializes once
    var reaperInitialized = false;

    // ensure socket IO only initializes once
    var socketIOInitialized = false;

    var _LOCK = function(channelId, workFunction)
    {
        var lockKey = "awareness_channel_" + channelId;

        process.locks.lock(lockKey, workFunction);
    };

    var r = {};

    /**
     * This gets called early and should be used to set defaults and instantiate the provider.
     *
     * @type {Function}
     */
    var init = r.init = function(callback) {

        // set up defaults
        if (!process.env.CLOUDCMS_AWARENESS_TYPE)
        {
            process.env.CLOUDCMS_AWARENESS_TYPE = "memory";
    
            // auto-configure for redis if possible
            if (process.env.CLOUDCMS_LAUNCHPAD_SETUP === "redis")
            {
                process.env.CLOUDCMS_AWARENESS_TYPE = "redis";
            }
        }

        if (!process.configuration.awareness) {
            process.configuration.awareness = {};
        }

        if (!process.configuration.awareness.type) {
            process.configuration.awareness.type = process.env.CLOUDCMS_AWARENESS_TYPE;
        }

        if (!process.configuration.awareness.config) {
            process.configuration.awareness.config = {};
        }
    
        // init any plugins?
        if (!process.configuration.awareness.plugins) {
            process.configuration.awareness.plugins = [];
        }
    
        var type = process.configuration.awareness.type;
        var config = process.configuration.awareness.config;
        
        var providerFactory = require("./providers/" + type);
        provider = new providerFactory(config);

        // initialize the provider
        provider.init(function(err){

            if (err) {
                return callback(err);
            }

            var fns = [];
            for (var i = 0; i < pluginPaths.length; i++)
            {
                var fn = function(awareness, pluginPath) {
                    return function(done) {

                        try
                        {
                            var plugin = require(pluginPath);

                            process.log("Registering Awareness plugin: " + pluginPath);

                            awareness.registerPlugin(pluginPath, plugin);
                        }
                        catch (e)
                        {
                            process.log("Failed to instantiate awareness plugin: " + e);
                            process.log(e);
                        }

                        done();
                    }
                }(r, pluginPaths[i]);
                fns.push(fn);
            }

            async.series(fns, function() {
                callback();
            });
        });
    };

    /**
     * This gets called whenever a new socket is connected to the Cloud CMS server.
     *
     * @param io
     * @param callback
     *
     * @type {Function}
     */
    var initSocketIO = r.initSocketIO = function(io, callback) {
    
        // initialize socket IO event handlers so that awareness binds to any new, incoming sockets
        socketInit(io);

        // ensure the reaper is initialized
        reaperInit(io, REAP_FREQUENCY_MS, REAP_MAX_AGE_MS, function(err) {
            callback(err);
        });
    };

    var socketInit = function(io)
    {
        if (socketIOInitialized)
        {
            return;
        }

        socketIOInitialized = true;

        var pluginProxy = function(plugins) {

            var r = {};

            // allow plugins to bind on("connection") handlers
            r.bindOnSocketConnection = function(socket, provider, callback)
            {
                var fns = [];
                for (var pluginPath in plugins)
                {
                    var plugin = plugins[pluginPath];

                    var fn = function(pluginPath, plugin, socket) {
                        return function(done) {

                            plugin.bindSocket(socket, provider);

                            done();
                        }
                    }(pluginPath, plugin, socket);
                    fns.push(fn);
                }

                async.series(fns, function(err) {
                    callback(err);
                });
            };

            return r;

        }(plugins);

        // when a socket.io connection is established, we set up some default listeners for events that the client
        // may emit to us
        io.on("connection", function(socket) {
            
            // "register" -> indicates that a user is in a channel
            socket.on("register", function(channelId, user, dirty, callback) {

                checkRegistered(channelId, user.id, function(err, alreadyRegistered) {

                    if (err) {
                        return callback(err);
                    }

                    // attach socket ID to user
                    user.socketId = socket.id;

                    // this will either create a new entry or update the old one
                    // so that the TTL is updated
                    register(channelId, user, function(err) {

                        if (err) {
                            return callback(err);
                        }

                        // // if we were already registered, just callback
                        // // however, if "dirty" is set, then we always hand back membership
                        // if (!dirty && alreadyRegistered)
                        // {
                        //     logger.info("Already registered, not dirty - channelId: " + channelId + ",userId=" + user.id + " (" + user.name + ")");
                        //
                        //     return callback();
                        // }
                        //
                        // if (!alreadyRegistered)
                        // {
                        //     logger.info("New registration - channelId: " + channelId + ",userId=" + user.id + " (" + user.name + ")");
    
                            //logger.info("Register - channelId: " + channelId + ", userId=" + user.id + " (" + user.name + ")");
                            socket.join(channelId);
                        //}

                        discover(channelId, function(err, userArray) {

                            if (err)
                            {
                                logger.info("Discover - channelId: " + channelId + ", err: " + JSON.stringify(err));
                            }
                            else
                            {
                                //logger.info("Discover - channelId: " + channelId + ", userId=" + user.id + " (" + user.name + ") handing back: " + userArray.length);
                                io.sockets.in(channelId).emit("membershipChanged", channelId, userArray);
                            }

                            callback();
                        });
                    });
                });
            });

            // "discover" -> hand back the users who are in a channel
            socket.on("discover", function(channelId, callback) {
                discover(channelId, callback);
            });

            // "acquireLock"
            socket.on("acquireLock", function(channelId, user, callback) {

                // attach socket ID to user
                user.socketId = socket.id;

                // make an attempt to acquire the lock
                acquireLock(channelId, user, function(err, success) {

                    // if we got an error, then we didn't acquire the lock
                    if (err) {
                        return callback(err);
                    }

                    if (!success)
                    {
                        // we didn't acquire the lock, so bail
                        return callback(null, false);
                    }

                    // we got the lock

                    // notify everyone in the channel (except us) that someone else acquired the lock
                    socket.to(channelId).emit("lockAcquired", channelId, user);

                    // fire callback to let the socket called know they succeeded
                    callback(null, true);
                });
            });

            // "releaseLock"
            socket.on("releaseLock", function(channelId, userId, callback) {

                // make an attempt to release the lock
                releaseLock(channelId, userId, function(err, success) {

                    // if we got an error, then we didn't release the lock
                    if (err) {
                        return callback(err, false);
                    }

                    if (!success)
                    {
                        // we didn't release the lock, so bail
                        return callback(null, false);
                    }

                    // we released the lock

                    // notify everyone in the channel (except us) that someone else acquired the lock
                    socket.to(channelId).emit("lockReleased", channelId, userId);

                    // fire callback to let the socket called know they succeeded
                    callback(null, true);

                });
            });

            // "lockInfo" -> requests info about a lock
            socket.on("lockInfo", function(channelId, callback) {
                lockInfo(channelId, callback);
            });

            // "notifyLockOwner" -> notifies the lock owner with a message
            socket.on("notifyLockOwner", function(channelId, user, message, callback) {
                notifyLockOwner(socket, channelId, user, message, callback);
            });

            // allow plugins to register more on() handlers if they wish
            pluginProxy.bindOnSocketConnection(socket, provider, function() {
                // done
            });

        });
    };

    /**
     * Starts up a reaper "thread" that wakes up periodically and looks for users in channels whose registrations
     * have expired.  When expired registrations are found, they are noted.
     *
     * Upon completing, any channel members who are in a channel whose membership has changed will be notified.
     * In addition, any locks held by members who are expired will be released and channel listeners will be notified.
     *
     * @param {*} callback 
     */
    var reaperInit = function(io, frequencyMs, maxAgeMs, callback) {

        if (reaperInitialized) {
            return callback();
        }

        reaperInitialized = true;

        var reap = function() {

            // reap anything before a calculated time in the past
            var beforeMs = new Date().getTime() - maxAgeMs;

            // run expirations
            expire(beforeMs, function(err, updatedMembershipChannelIds, expiredUserIdsByChannelId) {

                // functions
                var fns = [];

                // for any channels whose membership changed, we notify everyone listening to the channel
                // of the new membership list
                if (!err && updatedMembershipChannelIds)
                {
                    for (var i = 0; i < updatedMembershipChannelIds.length; i++)
                    {
                        var fn = function (channelId) {
                            return function (done) {

                                discover(channelId, function (err, userArray) {

                                    if (!err)
                                    {
                                        io.sockets.in(channelId).emit("membershipChanged", channelId, userArray);
                                    }

                                    done();
                                });
                            }
                        }(updatedMembershipChannelIds[i]);
                        fns.push(fn);
                    }
                }

                // for any users who were expired, we attempt to release locks
                // if a lock was released, we notify everyone in the channel room
                if (!err && expiredUserIdsByChannelId)
                {
                    for (var channelId in expiredUserIdsByChannelId)
                    {
                        var expiredUserIds = expiredUserIdsByChannelId[channelId];
                        if (expiredUserIds)
                        {
                            for (var i = 0; i < expiredUserIds.length; i++)
                            {
                                var fn = function(channelId, userId) {
                                    return function(done) {
                                        releaseLock(channelId, userId, function(err, success) {

                                            if (!err && success)
                                            {
                                                io.sockets.in(channelId).emit("lockReleased", channelId, userId);
                                            }

                                            done();
                                        });
                                    };
                                }(channelId, expiredUserIds[i]);
                                fns.push(fn);
                            }
                        }
                    }
                }

                async.parallel(fns, function(err) {

                    // run reap again after some period of time
                    setTimeout(function() {
                        reap();
                    }, frequencyMs);

                });
            });
        };

        reap();

        callback();
    };

    /**
     * Registers a user into a channel.  This can be called multiple times.
     *
     * If a user isn't registered in a channel, they are added along with a timestamp indicating when they registered.
     * If they are already registered, the entry is re-creted so that the timestamp updates.
     *
     * The register() call should be called periodically from any front-end apps to signal that that the front-end
     * user is "still there" and "still in the channel".
     *
     * @type {Function}
     */
    var register = r.register = function(channelId, user, callback)
    {
        //console.log("Awareness - heard register, channel: " + channelId + ", user: " + user.id);
        
        provider.register(channelId, user, callback);
    };

    /**
     * Retrieves and hands back the users who are in a channel.
     *
     * @type {Function}
     */
    var discover = r.discover = function(channelId, callback)
    {        
        provider.discover(channelId, callback);
    };

    /**
     * Checks whether a user is registered in a channel.
     *
     * @type {Function}
     */
    var checkRegistered = r.checkRegistered = function(channelId, userId, callback)
    {
        provider.checkRegistered(channelId, userId, callback);
    };

    /**
     * Runs expiration across all channels and users.  Any users who were added before the given timestmap
     * will be expired.
     *
     * @type {Function}
     */
    var expire = r.expire = function(beforeMs, callback)
    {
        provider.expire(beforeMs, callback);
    };

    /**
     * Acquires a lock for the given user against the channel.  Only one user may have the lock at a given time.
     * Locks are released when the reaper thread finds TTL expirations (or when they are explicitly released).
     *
     * @param channelId
     * @param user
     * @param callback
     */
    var acquireLock = r.acquireLock = function(channelId, user, callback)
    {
        // take out a cluster-wide lock on the "channelId"
        // so that two "threads" can't acquire/release at the same time for a given channel
        _LOCK(channelId, function (err, releaseLockFn) {
            
            if (err) {
                return callback(err);
            }
            
            provider.acquireLock(channelId, user, function(err, success) {
                releaseLockFn();
                callback(err, success);
            });
        });
    };

    /**
     * Explicitly releases a lock for a user within a channel.
     *
     * @param channelId
     * @param userId
     * @param callback
     */
    var releaseLock = r.releaseLock = function(channelId, userId, callback)
    {
        // take out a cluster-wide lock on the "channelId"
        // so that two "threads" can't acquire/release at the same time for a given channel
        _LOCK(channelId, function (err, releaseLockFn) {
            
            if (err) {
                return callback(err);
            }
            
            provider.releaseLock(channelId, userId, function(err, success) {
                releaseLockFn();
                callback(err, success);
            });
        });
    };

    /**
     * Acquires information about the lock on a given channel.
     * If no lock exists, null will be handed back.
     *
     * @type {Function}
     */
    var lockInfo = r.lockInfo = function(channelId, callback)
    {
        provider.lockInfo(channelId, callback);
    };

    var notifyLockOwner = r.notifyLockOwner = function(socket, channelId, user, message, callback)
    {
        if (!callback) {
            callback = function(err) { };
        }

        provider.lockInfo(channelId, function(err, lock) {

            if (err) {
                return callback(err);
            }

            if (!lock) {
                return callback({
                    "message": "Could not find lock for channel: " + channelId
                });
            }

            // process.log("LOCK USER: " + JSON.stringify(lock.user, null, 2));

            var socketId = lock.user.socketId;
            if (!socketId)
            {
                return callback({
                    "message": "Could not find socket ID for lock user for channel: " + channelId
                });
            }

            socket.to(socketId).emit("lockOwnerNotify", {
                "fromUser": user,
                "toUser": lock.user,
                "channelId": channelId,
                "message": message
            });

        });
    };

    // /**
    //  * Handles awareness commands.
    //  *
    //  * @return {Function}
    //  */
    r.handler = function()
    {
        return util.createHandler("awareness", function(req, res, next, stores, cache, configuration) {

            var handled = false;

            if (req.method.toLowerCase() === "post" || req.method.toLowerCase() === "get") {

                // take a look at what provider's up to
                if (req.url.indexOf("/_awareness/diagnose") === 0)
                {
                    if (configuration.type === "memory") {

                        res.json({
                            "provider": "memory",
                            "channelMap": provider.channelMap,
                            "lockMap": provider.lockMap
                        });
                        res.end();

                    }
                    else if (configuration.type === "redis") {

                        provider.listChannelIds(function(err, channelIds) {

                            var channelMap = {};
                            var fns = [];

                            channelIds.forEach(function(cid) {

                                var fn = function(provider, cid, channelMap) {
                                    return function(done) {
                                        provider.readChannel(cid, function(err, channel) {
                                            channelMap[cid] = channel;

                                            done();
                                        });
                                    };
                                }(provider, cid, channelMap);

                                fns.push(fn);

                            });

                            async.series(fns, function(err) {

                                res.json({
                                    "provider": "redis",
                                    "channelMap": channelMap
                                });
                                res.end();

                            });
                        });
                    }

                    handled = true;
                }
            }

            if (!handled)
            {
                next();
            }
        });
    };

    r.registerPlugin = function(path, plugin)
    {
        plugins[path] = plugin;
    };

    return r;
}();