exports = module.exports = {};

var util = require("../../../util/util");
var socketUtil = require("../../../util/socket");

var request = require("../../../util/request");

exports.bindSocket = function(socket, provider, io)
{
    socketUtil.bindGitana(socket, function() {

        socket.on("acquireEditorialWorkspace", function(sessionKey, repositoryId, branchId, type, force, callback) {
            acquireEditorialWorkspace(socket, provider, sessionKey, repositoryId, branchId, type, force, callback);
        });

        socket.on("releaseEditorialWorkspace", function(sessionKey, repositoryId, branchId, callback) {
            releaseEditorialWorkspace(socket, provider, sessionKey, repositoryId, branchId, callback);
        });

        socket.on("commitEditorialWorkspace", function(sessionKey, repositoryId, branchId, callback) {
            commitEditorialWorkspace(socket, provider, sessionKey, repositoryId, branchId, callback);
        });

        socket.on("touchEditorialWorkspace", function(sessionKey, repositoryId, branchId, callback) {
            touchEditorialWorkspace(socket, provider, sessionKey, repositoryId, branchId, callback);
        });

        socket.on("editorialWorkspaceInfo", function(sessionKey, repositoryId, branchId, callback) {
            editorialWorkspaceInfo(socket, provider, sessionKey, repositoryId, branchId, callback);
        });

        /**
         * Acquires an editorial workspace.  If a workspace doesn't already exists, it is created.
         * If a workspace already exists, it is reused unless `force` is set true.
         *
         * @param socket
         * @param provider
         * @param sessionKey
         * @param repositoryId
         * @param branchId
         * @param force
         * @param type (either "TEMPORARY" or "AUTOSAVE", assume "TEMPORARY" if not provided)
         * @param callback
         */
        var acquireEditorialWorkspace = function(socket, provider, sessionKey, repositoryId, branchId, type, force, callback)
        {
            // send an HTTP command to acquire an editorial workspace for this repository and branch
            var URL = util.asURL(process.env.GITANA_PROXY_SCHEME, process.env.GITANA_PROXY_HOST, process.env.GITANA_PROXY_PORT, process.env.GITANA_PROXY_PATH) + "/oneteam/editorial/workspace/acquire";

            var headers = {};
            //headers["Authorization"] = socket.gitana.platform().getDriver().getHttpHeaders()["Authorization"];
            var gitanaTicket = extractTicket(socket);
            if (gitanaTicket)
            {
                headers["GITANA_TICKET"] = gitanaTicket;
            }

            var json = {};
            json.repositoryId = repositoryId;
            json.branchId = branchId;
            json.key = sessionKey;
            json.type = type;

            if (!json.type) {
                json.type = "TEMPORARY";
            }

            var qs = {};
            if (force) {
                qs["force"] = true;
            }

            request({
                "method": "POST",
                "url": URL,
                "qs": {},
                "json": json,
                "headers": headers,
                "timeout": process.defaultHttpTimeoutMs
            }, function(err, response, json) {

                if (err || (json && json.error)) {
                    return callback(err);
                }

                callback(null, json._doc, json.branchId);
            });
        };
    });

    /**
     * Releases an editorial workspace, deleting the workspace branch and erasing any accumulated work.
     *
     * @param socket
     * @param provider
     * @param sessionKey
     * @param repositoryId
     * @param branchId
     * @param callback
     */
    var releaseEditorialWorkspace = function(socket, provider, sessionKey, repositoryId, branchId, callback)
    {
        // send an HTTP command to release the session
        var URL = util.asURL(process.env.GITANA_PROXY_SCHEME, process.env.GITANA_PROXY_HOST, process.env.GITANA_PROXY_PORT, process.env.GITANA_PROXY_PATH) + "/oneteam/editorial/workspace/release";

        var json = {};
        json.repositoryId = repositoryId;
        json.branchId = branchId;
        json.key = sessionKey;

        var headers = {};
        var gitanaTicket = extractTicket(socket);
        if (gitanaTicket)
        {
            headers["GITANA_TICKET"] = gitanaTicket;
        }

        request({
            "method": "POST",
            "url": URL,
            "qs": {},
            "json": json,
            "headers": headers,
            "timeout": process.defaultHttpTimeoutMs
        }, function(err, response, json) {

            if (err || (json && json.error)) {
                return callback(err);
            }

            callback();
        });
    };

    /**
     * Sends an HTTP request back to the API to commit the contents of an editorial workspace branch back to its
     * parent branch.
     *
     * @param socket
     * @param provider
     * @param sessionKey
     * @param repositoryId
     * @param branchId
     * @param callback
     */
    var commitEditorialWorkspace = function(socket, provider, sessionKey, repositoryId, branchId, callback)
    {
        var URL = util.asURL(process.env.GITANA_PROXY_SCHEME, process.env.GITANA_PROXY_HOST, process.env.GITANA_PROXY_PORT, process.env.GITANA_PROXY_PATH) + "/oneteam/editorial/workspace/commit";

        var json = {};
        json.repositoryId = repositoryId;
        json.branchId = branchId;
        json.key = sessionKey;

        var headers = {};
        var gitanaTicket = extractTicket(socket);
        if (gitanaTicket)
        {
            headers["GITANA_TICKET"] = gitanaTicket;
        }

        request({
            "method": "POST",
            "url": URL,
            "qs": {},
            "json": json,
            "headers": headers,
            "timeout": process.defaultHttpTimeoutMs
        }, function(err, response, json) {

            if (err || (json && json.error)) {
                return callback(err);
            }

            callback(null, json);
        });
    };

    /**
     * Sends an HTTP request back to the API to request information about an existing editorial workspace.
     *
     * @param socket
     * @param provider
     * @param sessionKey
     * @param repositoryId
     * @param branchId
     * @param callback
     */
    var editorialWorkspaceInfo = function(socket, provider, sessionKey, repositoryId, branchId, callback)
    {
        var URL = util.asURL(process.env.GITANA_PROXY_SCHEME, process.env.GITANA_PROXY_HOST, process.env.GITANA_PROXY_PORT, process.env.GITANA_PROXY_PATH) + "/oneteam/editorial/workspace/info";

        var json = {};
        json.repositoryId = repositoryId;
        json.branchId = branchId;
        json.key = sessionKey;

        var headers = {};
        var gitanaTicket = extractTicket(socket);
        if (gitanaTicket)
        {
            headers["GITANA_TICKET"] = gitanaTicket;
        }

        request({
            "method": "POST",
            "url": URL,
            "qs": {},
            "json": json,
            "headers": headers,
            "timeout": process.defaultHttpTimeoutMs
        }, function(err, response, json) {

            if (err || (json && json.error)) {
                return callback(err);
            }

            if (!json.exists) {
                return callback(null, false);
            }

            callback(null, true, json.workspace);
        });
    };

    /**
     * Touches an editorial workspace.
     *
     * This is a "keep alive" call to prevent a workspace from being cleaned up while it is being
     * worked on.
     *
     * @param socket
     * @param provider
     * @param sessionKey
     * @param repositoryId
     * @param branchId
     * @param callback
     */
    var touchEditorialWorkspace = function(socket, provider, sessionKey, repositoryId, branchId, callback)
    {
        var URL = util.asURL(process.env.GITANA_PROXY_SCHEME, process.env.GITANA_PROXY_HOST, process.env.GITANA_PROXY_PORT, process.env.GITANA_PROXY_PATH) + "/oneteam/editorial/workspace/touch";

        var json = {};
        json.repositoryId = repositoryId;
        json.branchId = branchId;
        json.key = sessionKey;

        var headers = {};
        var gitanaTicket = extractTicket(socket);
        if (gitanaTicket)
        {
            headers["GITANA_TICKET"] = gitanaTicket;
        }

        request({
            "method": "POST",
            "url": URL,
            "qs": {},
            "json": json,
            "headers": headers,
            "timeout": process.defaultHttpTimeoutMs
        }, function(err, response, json) {

            if (err || (json && json.error)) {
                return callback(err);
            }

            callback(null, json);
        });
    };

    var extractTicket = function(socket)
    {
        var ticket = null;

        if (socket.handshake && socket.handshake.headers)
        {
            var cookieValue = socket.handshake.headers.cookie;
            if (cookieValue)
            {
                var x1 = cookieValue.indexOf("GITANA_TICKET=");
                if (x1 > -1)
                {
                    ticket = cookieValue.substring(x1 + 14);
                    var x2 = ticket.indexOf(";");
                    if (x2 > -1)
                    {
                        ticket = ticket.substring(0, x2);
                    }
                }
            }
        }

        return ticket;
    }

};
