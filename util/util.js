var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var request = require("request");
var mime = require("mime");
var uuid = require("node-uuid");
var os = require("os");
var async = require("async");
var temp = require('temp');

var VALID_IP_ADDRESS_REGEX_STRING = "^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$";

exports = module.exports;

var shouldIgnore = function(filePath)
{
    var ignore = false;

    var filename = path.basename(filePath);

    if ("gitana.json" === filename)
    {
        ignore = true;
    }

    if (".git" === filename)
    {
        ignore = true;
    }

    if (".DS_STORE" === filename)
    {
        ignore = true;
    }

    return ignore;
};

var assertSafeToDelete = function(directoryPath)
{
    var b = true;

    if (!directoryPath || directoryPath.length < 4 || directoryPath === "" || directoryPath === "/" || directoryPath === "//") {
        b = false;
        throw new Error("Cannot delete null or root directory: " + directoryPath);
    }

    if (directoryPath == __dirname) {
        b = false;
        throw new Error("Unallowed to delete directory: " + directoryPath);
    }

    if (directoryPath.indexOf(__dirname) > -1) {
        b = false;
        throw new Error("Unallowed to delete directory: " + directoryPath);
    }

    return b;
};

var rmdirRecursiveSync = function(directoryOrFilePath)
{
    if (!assertSafeToDelete(directoryOrFilePath)) {
        return false;
    }

    if (!fs.existsSync(directoryOrFilePath))
    {
        return false;
    }

    // get stats about the things we're about to delete
    var isDirectory = false;
    var isFile = false;
    var isLink = false;
    try
    {
        var stat = fs.lstatSync(directoryOrFilePath);

        isDirectory = stat.isDirectory();
        isFile = stat.isFile();
        isLink = stat.isSymbolicLink();

    }
    catch (e)
    {
        console.log("Failed to get lstat for file: " + directoryOrFilePath);
        return false;
    }

    // check if the file is a symbolic link
    // if so, we just unlink it and save ourselves a lot of work
    if (isLink)
    {
        try
        {
            fs.unlinkSync(directoryOrFilePath);
        }
        catch (e)
        {
            console.log("Unable to unlink: " + directoryOrFilePath + ", err: " + JSON.stringify(e));
        }
    }
    else
    {
        // it is a physical directory or file...

        // if it is a directory, dive down into children first
        if (isDirectory)
        {
            var list = fs.readdirSync(directoryOrFilePath);
            for (var i = 0; i < list.length; i++)
            {
                if (list[i] == "." || list[i] == "..")
                {
                    // skip these files
                    continue;
                }

                var childPath = path.join(directoryOrFilePath, list[i]);

                rmdirRecursiveSync(childPath);
            }
        }

        // now delete the actual file or directory
        if (isFile)
        {
            try
            {
                fs.unlinkSync(directoryOrFilePath);
            }
            catch (e)
            {
                console.log("Unable to delete file: " + directoryOrFilePath + ", err: " + JSON.stringify(e));
            }
        }
        else if (isDirectory)
        {
            fs.rmdirSync(directoryOrFilePath);
        }
    }
};

var executeCommands = function(commands, logMethod, callback)
{
    var terminal = require('child_process').spawn('bash');

    logMethod("Running commands: " + JSON.stringify(commands));

    var text = "";

    terminal.stdout.on('data', function (data) {
        logMethod(" > " + data);
        text = text + data;
    });

    terminal.on('exit', function (code) {

        var err = null;
        if (code !== 0)
        {
            logMethod('child process exited with code ' + code + ' for commands: ' + commands);

            err = {
                "commands": commands,
                "message": text,
                "code": code
            };
        }

        callback(err, text);
    });

    setTimeout(function() {
        //console.log('Sending stdin to terminal');

        for (var i = 0; i < commands.length; i++)
        {
            var command = commands[i];
            terminal.stdin.write(command + "\n");
        }

        terminal.stdin.end();

    }, 1000);
};

var gitInit = function(directoryPath, logMethod, callback)
{
    var commands = [];
    commands.push("cd " + directoryPath);
    commands.push("git init");
    executeCommands(commands, logMethod, function(err) {
        callback(err);
    });
};

var gitPull = function(directoryPath, gitUrl, sourceType, logMethod, callback)
{
    var username = null;
    var password = null;
    if (sourceType == "github")
    {
        username = process.env.CLOUDCMS_NET_GITHUB_USERNAME;
        password = process.env.CLOUDCMS_NET_GITHUB_PASSWORD;
    }
    else if (sourceType == "bitbucket")
    {
        username = process.env.CLOUDCMS_NET_BITBUCKET_USERNAME;
        password = process.env.CLOUDCMS_NET_BITBUCKET_PASSWORD;
    }

    if (password)
    {
        password = escape(password).replace("@", "%40");
    }

    if (username)
    {
        var token = username;
        if (password)
        {
            token += ":" + password;
        }

        gitUrl = gitUrl.substring(0, 8) + token + "@" + gitUrl.substring(8);
    }

    var commands = [];
    commands.push("cd " + directoryPath);
    commands.push("git pull " + gitUrl);
    executeCommands(commands, logMethod, function(err) {
        callback(err);
    });
};

/**
 * Checks out the source code for an application to be deployed and copies it into the root store for a given host.
 *
 * @type {*}
 */
exports.gitCheckout = function(host, sourceType, gitUrl, relativePath, offsetPath, moveToPublic, logMethod, callback)
{
    // this gets a little confusing, so here is what we have:
    //
    //      /temp-1234                                                      (tempRootDirectoryPath)
    //          .git
    //          /website                                                    (tempWorkingDirectoryPath)
    //              /public                                                 (tempWorkingPublicDirectory)
    //              /public_build                                           (tempWorkingPublicBuildDirectory)
    //              /config                                                 (tempWorkingConfigDirectory)
    //              /gitana.json                                            (tempWorkingGitanaJsonFilePath)
    //
    //      <rootStore>
    //          /web
    //          /config
    //          /content


    //      /hosts
    //          /domain.cloudcms.net                                        (hostDirectoryPath)
    //              /public                                                 (hostPublicDirectoryPath)
    //              /public_build                                           (hostPublicBuildDirectoryPath)
    //              /config                                                 (hostConfigDirectoryPath)

    var storeService = require("../middleware/stores/stores");

    // create a "root" store for the host
    storeService.produce(host, function(err, stores) {

        if (err) {
            callback(err, host);
            return;
        }

        var rootStore = stores.root;

        // create tempRootDirectoryPath
        createTempDirectory(function (err, tempRootDirectoryPath) {

            if (err) {
                callback(err, host);
                return;
            }

            // initialize git in temp root directory
            gitInit(tempRootDirectoryPath, logMethod, function (err) {

                if (err) {
                    callback(err);
                    return;
                }

                // perform a git pull of the repository
                gitPull(tempRootDirectoryPath, gitUrl, sourceType, logMethod, function (err) {

                    if (err) {
                        callback(err);
                        return;
                    }

                    var tempRootDirectoryRelativePath = tempRootDirectoryPath;
                    if (relativePath && relativePath != "/")
                    {
                        tempRootDirectoryRelativePath = path.join(tempRootDirectoryRelativePath, relativePath);
                    }

                    if (moveToPublic)
                    {
                        // if there isn't a "public" and there isn't a "public_build" directory,
                        // then move files into public
                        var publicExists = fs.existsSync(path.join(tempRootDirectoryRelativePath, "public"));
                        var publicBuildExists = fs.existsSync(path.join(tempRootDirectoryRelativePath, "public_build"));
                        if (!publicExists && !publicBuildExists)
                        {
                            fs.mkdirSync(path.join(tempRootDirectoryRelativePath, "public"));

                            var filenames = fs.readdirSync(tempRootDirectoryRelativePath);
                            if (filenames && filenames.length > 0)
                            {
                                for (var i = 0; i < filenames.length; i++)
                                {
                                    if (!shouldIgnore(path.join(tempRootDirectoryRelativePath, filenames[i])))
                                    {
                                        if ("config" === filenames[i])
                                        {
                                            // skip this
                                        }
                                        else if ("gitana.json" === filenames[i])
                                        {
                                            // skip
                                        }
                                        else if ("descriptor.json" === filenames[i])
                                        {
                                            // skip
                                        }
                                        else if ("public" === filenames[i])
                                        {
                                            // skip
                                        }
                                        else if ("public_build" === filenames[i])
                                        {
                                            // skip
                                        }
                                        else
                                        {
                                            fs.renameSync(path.join(tempRootDirectoryRelativePath, filenames[i]), path.join(tempRootDirectoryRelativePath, "public", filenames[i]));
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // copy everything from temp dir into the store
                    copyToStore(tempRootDirectoryRelativePath, rootStore, offsetPath, function(err) {

                        // now remove temp directory
                        rmdir(tempRootDirectoryPath);

                        callback(err);

                    });

                });
            });
        });
    });
};

var copyToStore = exports.copyToStore = function(sourceDirectory, targetStore, offsetPath, callback)
{
    var f = function(filepath, fns) {

        var sourceFilePath = path.join(sourceDirectory, filepath);
        if (!shouldIgnore(sourceFilePath))
        {
            var sourceStats = fs.lstatSync(sourceFilePath);
            if (sourceStats) {
                if (sourceStats.isDirectory()) {

                    // list files
                    var filenames = fs.readdirSync(sourceFilePath);
                    if (filenames && filenames.length > 0) {
                        for (var i = 0; i < filenames.length; i++) {
                            f(path.join(filepath, filenames[i]), fns);
                        }
                    }

                }
                else if (sourceStats.isFile()) {

                    // STORE: CREATE_FILE
                    fns.push(function (sourceFilePath, filepath, targetStore) {
                        return function (done) {
                            //console.log("source: " + sourceFilePath);
                            fs.readFile(sourceFilePath, function (err, data) {

                                if (err) {
                                    done(err);
                                    return;
                                }

                                var targetFilePath = filepath;
                                if (offsetPath)
                                {
                                    targetFilePath = path.join(offsetPath, targetFilePath);
                                }

                                //console.log("target: " + targetFilePath);

                                targetStore.writeFile(targetFilePath, data, function (err) {
                                    done(err);
                                });
                            });
                        };
                    }(sourceFilePath, filepath, targetStore));
                }
            }
        }
    };

    var copyFunctions = [];

    var filenames = fs.readdirSync(sourceDirectory);
    for (var i = 0; i < filenames.length; i++)
    {
        f(filenames[i], copyFunctions);
    }

    // run all the copy functions
    async.series(copyFunctions, function (errors) {
        callback();
    });

};

var rmdir = exports.rmdir = function(directoryPath)
{
    if (!assertSafeToDelete(directoryPath)) {
        return false;
    }

    rmdirRecursiveSync(directoryPath);
};

var mkdirs = exports.mkdirs = function(directoryPath, callback)
{
    mkdirp(directoryPath, function(err) {
        callback(err);
    });
};

var copyFile = exports.copyFile = function(srcFile, destFile)
{
    var contents = fs.readFileSync(srcFile);
    fs.writeFileSync(destFile, contents);
};

/*
var copyChildrenToDirectory = function(sourceDirectoryPath, targetDirectoryPath)
{
    var filenames = fs.readdirSync(sourceDirectoryPath);
    for (var i = 0; i < filenames.length; i++)
    {
        var filenamePath = path.join(sourceDirectoryPath, filenames[i]);
        var stat = fs.lstatSync(filenamePath);

        var isDirectory = stat.isDirectory();
        var isFile = stat.isFile();
        //var isLink = stat.isSymbolicLink();

        if (isFile)
        {
            // make sure this isn't a file we should skip
            var skip = false;
            if (filenames[i] === "gitana.json")
            {
                skip = true;
            }

            if (!skip)
            {
                copyFile(filenamePath, path.join(targetDirectoryPath, filenames[i]));
            }
        }
        else if (isDirectory)
        {
            require("wrench").copyDirSyncRecursive(filenamePath, path.join(targetDirectoryPath, filenames[i]));
        }
    }
};
*/

var trim = exports.trim = function(text)
{
    return text.replace(/^\s+|\s+$/g,'');
};

var showHeaders = exports.showHeaders = function(req)
{
    for (var k in req.headers)
    {
        console.log("HEADER: " + k + " = " + req.headers[k]);
    }
};

/**
 * Helper function designed to automatically retry requests to a back end service over HTTP using authentication
 * credentials acquired from an existing Gitana driver.  If a request gets back an invalid_token, the Gitana
 * driver token state is automatically refreshed.
 *
 * @type {Function}
 */
var retryGitanaRequest = exports.retryGitanaRequest = function(logMethod, gitana, config, maxAttempts, callback)
{
    if (!logMethod)
    {
        logMethod = console.log;
    }

    var _retryHandler = function(gitana, config, currentAttempts, maxAttempts, previousError, cb)
    {
        logMethod("Heard invalid_token, attempting retry (" + currentAttempts + " / " + maxAttempts + ")");

        // tell gitana driver to refresh access token
        gitana.getDriver().refreshAuthentication(function(err) {

            if (err)
            {
                logMethod("Failed to refresh access_token: " + JSON.stringify(err));
            }

            // try again with attempt count + 1
            _handler(gitana, config, currentAttempts + 1, maxAttempts, previousError, cb)
        });
    };

    var _handler = function(gitana, config, currentAttempts, maxAttempts, previousError, cb)
    {
        if (currentAttempts === maxAttempts)
        {
            cb({
                "message": "Maximum number of connection attempts exceeded (" + maxAttempts + ")",
                "err": previousError
            });

            return;
        }

        // make sure we have a headers object
        if (!config.headers)
        {
            config.headers = {};
        }

        // add "authorization" header for OAuth2 bearer token
        var headers2 = gitana.getDriver().getHttpHeaders();
        config.headers["Authorization"] = headers2["Authorization"];

        // make the request
        request(config, function(err, response, body) {

            // ok case (just callback)
            if (response && response.statusCode === 200)
            {
                cb(err, response, body);
                return;
            }

            // look for the special "invalid_token" case
            var isInvalidToken = false;
            if (body)
            {
                try
                {
                    var json = body;
                    if (typeof(json) == "string")
                    {
                        // convert to json
                        json = JSON.parse(json);
                    }
                    if (json.error == "invalid_token")
                    {
                        isInvalidToken = true;
                    }
                }
                catch (e)
                {
                    console.log("ERR.88 " + JSON.stringify(e));
                }
            }

            if (isInvalidToken)
            {
                // we go through the retry handler
                _retryHandler(gitana, config, currentAttempts, maxAttempts, {
                    "message": "Unable to communicate from remote store: " + JSON.stringify(config, null, "  "),
                    "code": response.statusCode,
                    "body": body,
                    "err": err
                }, cb);

                return;
            }

            // otherwise, we just hand back some kind of error
            cb(err, response, body);
        });
    };

    _handler(gitana, config, 0, 2, null, callback);
};

var isIPAddress = exports.isIPAddress = function(text)
{
    var rx = new RegExp(VALID_IP_ADDRESS_REGEX_STRING);
    return rx.test(text);
};

var merge = exports.merge = function(source, target)
{
    for (var k in source)
    {
        if (typeof(source[k]) !== "undefined") {
            if (source[k].push) {
                if (!target[k]) {
                    target[k] = [];
                }

                // merge array
                for (var x = 0; x < source[k].length; x++) {
                    target[k].push(source[k][x]);
                }
            }
            else if ((typeof source[k]) === "object") {
                if (!target[k]) {
                    target[k] = {};
                }

                // merge keys/values
                merge(source[k], target[k]);
            }
            else {
                // overwrite a scalar
                target[k] = source[k];
            }
        }
    }
};

var createHandler = exports.createHandler = function(name, fn)
{
    return function(req, res, next) {

        req.configuration(name, function(err, handleConfiguration) {

            if (err) {
                next(err);
                return;
            }

            if (!handleConfiguration.enabled)
            {
                next();
                return;
            }

            fn(req, res, next, handleConfiguration, req.stores, req.cache);

        });
    };
};

var createInterceptor = exports.createInterceptor = function(name, fn)
{
    return function(req, res, next) {

        req.configuration(name, function(err, handleConfiguration) {

            if (err) {
                next(err);
                return;
            }

            if (!handleConfiguration.enabled)
            {
                next();
                return;
            }

            fn(req, res, next, handleConfiguration, req.stores, req.cache);
        });
    };
};

var replaceAll = exports.replaceAll = function(text, find, replace)
{
    var i = -1;
    do
    {
        i = text.indexOf(find);
        if (i > -1)
        {
            text = text.substring(0, i) + replace + text.substring(i + find.length);
        }
    } while (i > -1);

    return text;
};

var createTempDirectory = exports.createTempDirectory = function(callback)
{
    var tempDirectory = path.join(os.tmpdir(), "/tmp-" + uuid.v4());

    mkdirs(tempDirectory, function(err) {
        callback(err, tempDirectory);
    });
};

var generateTempFilePath = exports.generateTempFilePath = function(basedOnFilePath)
{
    var tempFilePath = null;

    var ext = null;
    if (basedOnFilePath) {
        ext = path.extname(basedOnFilePath);
    }

    if (ext)
    {
        tempFilePath = temp.path({suffix: ext})
    }
    else
    {
        tempFilePath = temp.path();
    }

    return tempFilePath;
};

var sendFile = exports.sendFile = function(res, stream, callback)
{
    res.on('finish', function() {

        if (callback) {
            callback();
        }

    });
    res.on("error", function(err) {

        if (callback) {
            callback(err);
        }

    });
    stream.pipe(res);
    //res.end();
};

var applyResponseContentType = exports.applyResponseContentType = function(response, cacheInfo, filePath)
{
    var contentType = null;

    var filename = path.basename(filePath);

    // do the response headers have anything to tell us
    if (cacheInfo)
    {
        // is there an explicit content type?
        contentType = cacheInfo.mimetype;
    }
    else if (filename)
    {
        var ext = path.extname(filename);
        if (ext) {
            //contentType = mime.lookup(ext);
            contentType = lookupMimeType(ext);
        }
    }

    if (contentType) {
        response.setHeader("Content-Type", contentType);
    }

    // if still nothing, what can we guess from the filename mime?
    if (!contentType && filename)
    {
        var ext = path.extname(filename);
        if (ext)
        {
            //contentType = mime.lookup(ext);
            contentType = lookupMimeType(ext);
        }
    }

    // TODO: should we look for ";charset=" and strip out?

    if (contentType)
    {
        try {
            response.setHeader("Content-Type", contentType);
        }
        catch (e) { }
    }

    return contentType;
};

//var MAXAGE_ONE_YEAR = 31536000;
//var MAXAGE_ONE_HOUR = 3600;
//var MAXAGE_ONE_WEEK = 604800;
var MAXAGE_THIRTY_MINUTES = 1800;

var applyDefaultContentTypeCaching = exports.applyDefaultContentTypeCaching = function(response, cacheInfo)
{
    if (!cacheInfo || !response)
    {
        return;
    }

    var mimetype = cacheInfo.mimetype;
    if (!mimetype)
    {
        return;
    }

    // assume no caching
    var cacheControl = "no-cache,no-store,max-age=0,s-maxage=0,must-revalidate,no-transform";
    var expires = "Mon, 7 Apr 2012, 16:00:00 GMT"; // some time in the past

    // if we're in production mode, we apply caching
    if (process.env.CLOUDCMS_APPSERVER_MODE === "production")
    {
        var isCSS = ("text/css" == mimetype);
        var isImage = (mimetype.indexOf("image/") > -1);
        var isJS = ("text/javascript" == mimetype) || ("application/javascript" == mimetype);
        var isHTML = ("text/html" == mimetype);

        var maxAge = -1;

        // html
        if (isHTML)
        {
            maxAge = MAXAGE_THIRTY_MINUTES;
        }

        // css, images and js get 1 year
        if (isCSS || isImage || isJS)
        {
            maxAge = MAXAGE_THIRTY_MINUTES;
        }

        cacheControl = "public,max-age=" + maxAge + ",s-maxage=" + maxAge + ",no-transform";
        expires = new Date(Date.now() + (maxAge * 1000)).toUTCString();
    }

    // overwrite the cache-control header
    setHeaderOnce(response, 'Cache-Control', cacheControl);

    // overwrite the expires header
    setHeaderOnce(response, 'Expires', expires);

    // remove pragma, this isn't used anymore
    removeHeader(response, "Pragma");
};

var handleSendFileError = exports.handleSendFileError = function(req, res, filePath, cacheInfo, logMethod, err)
{
    if (err)
    {
        if (err.doesNotExist)
        {
            var fallback = req.query["fallback"];
            if (!fallback) {
                try { util.status(res, 404); } catch (e) { }
                res.end();
            }
            else
            {
                res.redirect(fallback);
            }
        }
        else if (err.zeroSize)
        {
            try { util.status(res, 200); } catch (e) { }
            res.end();
        }
        else if (err.readFailed)
        {
            logMethod(JSON.stringify(err));
            try { util.status(res, 503); } catch (e) { }
            res.end();
        }
        else if (err.sendFailed)
        {
            logMethod(JSON.stringify(err));
            try { util.status(res, 503); } catch (e) { }
            res.end();
        }
    }
};

var createDirectory = exports.createDirectory = function(directoryPath, callback)
{
    mkdirp(directoryPath, function(err) {

        if (err) {
            callback(err);
            return;
        }

        callback(null, directoryPath);
    });
};

var setHeaderOnce = exports.setHeaderOnce = function(response, name, value)
{
    var existing = response.getHeader(name);
    if (typeof(existing) === "undefined")
    {
        setHeader(response, name, value);
    }
};

var setHeader = exports.setHeader = function(response, name, value)
{
    try { response.setHeader(name, value); } catch (e) { }
};

var removeHeader = exports.removeHeader = function(response, name)
{
    try { response.removeHeader(name); } catch (e) { }
};

var isInvalidateTrue = exports.isInvalidateTrue = function(request)
{
    return (request.query["invalidate"] == "true");
};

var hashcode = exports.hashcode = function(text)
{
    var hash = 0, i, chr, len;
    if (text.length == 0)
    {
        return hash;
    }
    for (i = 0, len = text.length; i < len; i++)
    {
        chr   = text.charCodeAt(i);
        hash  = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
};

var safeReadStream = exports.safeReadStream = function(contentStore, filePath, callback)
{
    contentStore.existsFile(filePath, function(exists) {

        if (!exists) {
            callback();
            return;
        }

        contentStore.fileStats(filePath, function (err, stats) {

            if (err) {
                callback();
                return;
            }

            if (stats.size === 0) {
                callback();
                return;
            }

            contentStore.readStream(filePath, function (err, readStream) {
                callback(err, readStream);
            });
        });
    });
};

var safeReadFile = exports.safeReadFile = function(contentStore, filePath, callback)
{
    contentStore.existsFile(filePath, function(exists) {

        if (!exists) {
            callback();
            return;
        }

        contentStore.fileStats(filePath, function (err, stats) {

            if (err) {
                callback();
                return;
            }

            if (stats.size === 0) {
                callback();
                return;
            }

            contentStore.readFile(filePath, function (err, data) {
                callback(err, data);
            });
        });
    });
};

/**
 * Finds whether the type of a variable is function.
 * @param {Any} obj The variable being evaluated.
 * @returns {Boolean} True if the variable is a function, false otherwise.
 */
var isFunction = exports.isFunction = function(obj) {
    return Object.prototype.toString.call(obj) === "[object Function]";
};

/**
 * Finds whether the type of a variable is string.
 * @param {Any} obj The variable being evaluated.
 * @returns {Boolean} True if the variable is a string, false otherwise.
 */
var isString = exports.isString = function(obj) {
    return (typeof obj === "string");
};

/**
 * Finds whether the type of a variable is object.
 * @param {Any} obj The variable being evaluated.
 * @returns {Boolean} True if the variable is an object, false otherwise.
 */
var isObject = exports.isObject = function(obj) {
    return !isUndefined(obj) && Object.prototype.toString.call(obj) === '[object Object]';
};

/**
 * Finds whether the type of a variable is number.
 * @param {Any} obj The variable being evaluated.
 * @returns {Boolean} True if the variable is a number, false otherwise.
 */
var isNumber = exports.isNumber = function(obj) {
    return (typeof obj === "number");
};

/**
 * Finds whether the type of a variable is array.
 * @param {Any} obj The variable being evaluated.
 * @returns {Boolean} True if the variable is an array, false otherwise.
 */
var isArray = exports.isArray = function(obj) {
    return obj instanceof Array;
};

/**
 * Finds whether the type of a variable is boolean.
 * @param {Any} obj The variable being evaluated.
 * @returns {Boolean} True if the variable is a boolean, false otherwise.
 */
var isBoolean = exports.isBoolean = function(obj) {
    return (typeof obj === "boolean");
};

/**
 * Finds whether the type of a variable is undefined.
 * @param {Any} obj The variable being evaluated.
 * @returns {Boolean} True if the variable is a undefined, false otherwise.
 */
var isUndefined = exports.isUndefined = function(obj) {
    return (typeof obj == "undefined");
};

/**
 * Looks up a mimetype for a given file extension.
 *
 * @type {Function}
 */
var lookupMimeType = exports.lookupMimeType = function(ext) {

    // rely on the mimetype library for base handling
    var mimetype = mime.lookup(ext);

    var extension = ext;
    if (extension && extension.indexOf(".") === 0)
    {
        extension = ext.substring(1);
    }

    // and then make some adjustments for things that it botches
    if ("ttf" === extension) {
        mimetype = "application/x-font-truetype";
    }
    else if ("otf" === extension) {
        mimetype = "application/x-font-opentype";
    }

    return mimetype;
};

/**
 * Generates a page cache key for a given wcm page descriptor.
 */
var generatePageCacheKey = exports.generatePageCacheKey = function(descriptor) {

    // sort params alphabetically
    var paramNames = [];
    for (var paramName in descriptor.params) {
        paramNames.push(paramName);
    }
    paramNames.sort();

    /*
    // sort headers alphabetically
    var headerNames = [];
    for (var headerName in descriptor.headers) {
        headerNames.push(headerName);
    }
    headerNames.sort();
    */

    var str = descriptor.url;

    // add in param names
    for (var i = 0; i < paramNames.length; i++)
    {
        var paramName = paramNames[i];
        var paramValue = descriptor.params[paramName];
        str += "&param_" + paramName + "=" + paramValue;
    }

    /*
    // add in header names
    for (var i = 0; i < headerNames.length; i++)
    {
        var headerName = headerNames[i];
        var headerValue = descriptor.headers[headerName];
        str += "&header_" + headerName + "=" + headerValue;
    }
    */

    // calculate a hashcode
    var hash = hashcode(str);

    var pageCacheKey = "p-" + hash;

    return pageCacheKey;
};

/**
 * Generates a cache key for fragments.
 */
var generateFragmentCacheKey = exports.generateFragmentCacheKey = function(fragmentId, requirements) {

    // sort params alphabetically
    var requirementKeys = [];
    for (var requirementKey in requirements) {
        requirementKeys.push(requirementKey);
    }
    requirementKeys.sort();

    var str = fragmentId;

    // add in requirement keys
    for (var i = 0; i < requirementKeys.length; i++)
    {
        var requirementKey = requirementKeys[i];
        var requirementValue = requirements[requirementKey];

        str += "&" + requirementKey + "=" + requirementValue;
    }

    // calculate a hashcode
    var hash = hashcode(str);

    var fragmentCacheKey = "f-" + hash;

    return fragmentCacheKey;
};

var enhanceNode = exports.enhanceNode = function(node)
{
    var attachments = {};

    for (var id in node.getSystemMetadata()["attachments"])
    {
        var attachment = node.getSystemMetadata()["attachments"][id];

        attachments[id] = JSON.parse(JSON.stringify(attachment));
        attachments[id]["url"] = "/static/node/" + node.getId() + "/" + id;
        attachments[id]["preview32"] = "/static/node/" + node.getId() + "/preview32/?attachment=" + id + "&size=32";
        attachments[id]["preview64"] = "/static/node/" + node.getId() + "/preview64/?attachment=" + id + "&size=64";
        attachments[id]["preview128"] = "/static/node/" + node.getId() + "/preview128/?attachment=" + id + "&size=128";
        attachments[id]["preview256/"] = "/static/node/" + node.getId() + "/preview256/?attachment=" + id + "&size=256";
    }

    node.attachments = attachments;
};

var status = exports.status = function(res, code)
{
    res.status(code);

    if (code >= 200 && code <= 204)
    {
        // ok
    }
    else
    {
        // don't include cache headers
        setHeader(res, "Cache-Control", "no-cache,no-store");
        setHeader(res, "Pragma", "no-cache");
        setHeader(res, "Expires", "Mon, 7 Apr 2012, 16:00:00 GMT"); // already expired
        //removeHeader(res, "Cache-Control");
        //removeHeader(res, "Pragma");
        //removeHeader(res, "Expires");
    }

    return res;
};

var maxFiles = exports.maxFiles = function(callback)
{
    var logMethod = function(txt) { };

    var commands = [];
    commands.push("ulimit -n");
    executeCommands(commands, logMethod, function(err, text) {

        if (err) {
            return callback(err);
        }

        var maxFiles = -1;
        try
        {
            maxFiles = parseInt(text, 10);
        }
        catch (e)
        {
            // swallow
        }

        callback(null, maxFiles);
    });
};

var countOpenHandles = exports.countOpenHandles = function(callback)
{
    fs.readdir('/proc/self/fd', function(err, list) {
        if (err) {
            return callback(err);
        }

        callback(null, list.length);
    });
};
