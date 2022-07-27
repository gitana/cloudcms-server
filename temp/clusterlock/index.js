/**
 * A simple cluster lock implementation.
 */

var path = require("path");
var cluster = require("cluster");

var ReadWriteLock = require("rwlock");

var releaseFunctions = {};

// MASTER

/**
 * This method should get called by the master process ahead of using cluster lock.
 */
var _setup = function() {

    if (cluster.isMaster)
    {
        var lock = new ReadWriteLock();

        var _claim = function(message)
        {
            var key = message.requestParams.key;

            var ticket = "ticket-" + message.id;

            lock.writeLock(key, function(releaseFn) {

                releaseFunctions[ticket] = releaseFn;

                message.responseParams = {
                    "ticket": ticket
                };

                _sendMessageToWorker(message);
            });

        };

        var _release = function(message)
        {
            var ticket = message.requestParams.ticket;

            var releaseFn = releaseFunctions[ticket];
            delete releaseFunctions[ticket];
            releaseFn(function() {

                message.responseParams = {
                };

                _sendMessageToWorker(message);

            });
        };

        var _masterIncomingMessagesHandler = function(message)
        {
            if (!message || message.channel !== 'clusterlock')
            {
                return false;
            }

            switch (message.type)
            {
                case 'claim':
                    _claim(message);
                    break;
                case 'release':
                    _release(message);
                    break;
                default:
                    console.warn('Received an invalid message type:', message.type);
            }
        };

        var _findWorkerByPid = function(workerPid)
        {
            var worker = null;

            var workerIds = Object.keys(cluster.workers);
            for (var i = 0; i < workerIds.length; i++)
            {
                if (cluster.workers[workerIds[i]].process.pid == workerPid)
                {
                    worker = cluster.workers[workerIds[i]];
                    break;
                }
            }

            return worker;
        };

        var _sendMessageToWorker = function(message)
        {
            var worker = _findWorkerByPid(message.workerPid);
            worker.send(message);
        };

        Object.keys(cluster.workers).forEach(function(workerId) {
            cluster.workers[workerId].on('message', _masterIncomingMessagesHandler);
        });
    }
};

// SLAVE

var messagesCounter = 0;
var activeMessages = {};

var _sendMessageToMaster = function(message)
{
    message.channel = 'clusterlock';
    message.workerPid = process.pid;
    message.id = process.pid + '::' + messagesCounter++;

    if (message.callback)
    {
        activeMessages[message.id] = message;
    }

    process.send(message);
};

var _getResultParamsValues = function(paramsObj)
{
    var result = [];
    var prop;

    if (paramsObj)
    {
        for (prop in paramsObj)
        {
            result.push(paramsObj[prop]);
        }
    }

    return result;
};

var _workerIncomingMessagesHandler  = function(message) {

    if (!message || message.channel !== 'clusterlock')
    {
        return false;
    }

    var pendingMessage = activeMessages[message.id];
    if (pendingMessage && pendingMessage.callback)
    {
        pendingMessage.callback.call(null, _getResultParamsValues(message.responseParams));
        delete activeMessages[message.id];
    }
};

process.on('message', _workerIncomingMessagesHandler);

var _lock = function(key, fn) {

    console.log("z1: " + key);
    // notify master that we have something waiting to run for this lock
    _sendMessageToMaster({
        "type": "claim",
        "requestParams": {
            "key": key
        },
        "callback": function(ticket) {
            console.log("z2: " + ticket);

            fn.call(null, function(afterReleaseCallback) {

                _sendMessageToMaster({
                    "type": "release",
                    "requestParams": {
                        "ticket": ticket
                    },
                    "callback": function() {

                        if (afterReleaseCallback)
                        {
                            afterReleaseCallback.call(null);
                        }
                    }
                });
            });

        }
    });

};

module.exports = {
    "lock": _lock,
    "setup": _setup
};
