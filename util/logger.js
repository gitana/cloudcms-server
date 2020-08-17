var winston = require('winston');

var cluster = require("cluster");
var util = require("./util");

const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, printf } = format;

// set the log level to info by default
// allow for override via environment variable
var logLevel = "info";
if (process.env.CLOUDCMS_LOG_LEVEL) {
    logLevel = (process.env.CLOUDCMS_LOG_LEVEL + "").toLowerCase()
}

// factory function
var exports = module.exports = function(name, options)
{
    if (!options) {
        options = {};
    }

    // assume we show worker ID
    if (typeof(options.wid) === "undefined") {
        options.wid = true;
    }

    var wid = "main";
    if (cluster && cluster.worker)
    {
        wid = cluster.worker.id;
    }

    const myFormat = printf(({ level, message, label, timestamp }) => {
        return `${timestamp} ${label} (${level}): ${message}`;
    });

    var transports = {
        "console": new winston.transports.Console({ level: 'info' })
    };

    var labelValue = "";
    if (name) {
        labelValue = "[" + name + ":" + wid + "]";
    } else {
        labelValue = "[" + wid + "]";
    }

    // logger configuration
    var loggerConfig = {};
    loggerConfig.level = "info";
    //logConfig.format = winston.format.simple();
    loggerConfig.transports = [
        transports.console
    ];
    loggerConfig.format = combine(
        label({
            "label": labelValue
        }),
        timestamp(),
        myFormat
    );

    // logger instance
    var logger = winston.createLogger(loggerConfig);

    var toArgs = function(_arguments)
    {
        var args = [];

        for (var i = 0; i < _arguments.length; i++)
        {
            var x = _arguments[i];

            if (x)
            {
                if (util.isObject(x) || util.isArray(x)) {
                    x = JSON.stringify(x, null, 2);
                }
            }

            if (x)
            {
                args.push(x);
            }
        }

        return args;
    };

    var toText = function(args)
    {
        return args.join(" ");
    };

    var r = {};

    r.error = function()
    {
        var args = toArgs(arguments);
        if (!args || args.length === 0) {
            return;
        }

        logger.error(toText(args));
    };

    r.warn = function()
    {
        var args = toArgs(arguments);
        if (!args || args.length === 0) {
            return;
        }

        logger.warn(toText(args));
    };

    r.info = function()
    {
        var args = toArgs(arguments);
        if (!args || args.length === 0) {
            return;
        }

        logger.info(toText(args));
    };

    r.debug = function()
    {
        var args = toArgs(arguments);
        if (!args || args.length === 0) {
            return;
        }

        logger.debug(toText(args));
    };

    r.trace = function()
    {
        var args = toArgs(arguments);
        if (!args || args.length === 0) {
            return;
        }

        logger.trace(toText(args));
    };

    r.log = function()
    {
        var args = toArgs(arguments);
        if (!args || args.length === 0)
        {
            return;
        }

        var level = "info";

        var z = args[args.length - 1];
        if (z === "info" || z === "debug" || z === "warn" || z === "error" || z === "trace")
        {
            level = z;
            args.pop(); // removes last element from array
        }

        // convert remaining arguments to string
        var text = toText(args);

        logger[level](text);
    };

    r.setLevel = function(level)
    {
        transports.console.level = level;
    };

    r.getLevel = function()
    {
        return transports.console.level;
    };

    return r;
};

