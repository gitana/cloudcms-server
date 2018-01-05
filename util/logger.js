var Logger = require("basic-logger");

// set the log level to info by default
// allow for override via environment variable
var logLevel = "info";
if (process.env.CLOUDCMS_LOG_LEVEL) {
    logLevel = (process.env.CLOUDCMS_LOG_LEVEL + "").toLowerCase()
}
Logger.setLevel(logLevel, true);

// factory function
var exports = module.exports = function(prefix)
{
    var logConfig = {
        showMillis: true,
        showTimestamp: true
    };

    if (prefix) {
        logConfig.prefix = prefix;
    }

    var log = new Logger(logConfig);

    var r = {};

    r.error = function(text) {
        log.error(text);
    };

    r.warn = function(text) {
        log.warn(text);
    };

    r.info = function(text) {
        log.info(text);
    };

    r.debug = function(text) {
        log.debug(text);
    };

    r.trace = function(text) {
        log.trace(text);
    };

    r.setLevel = function(level) {
        Logger.setLevel(level, true);
    };

    return r;
};

