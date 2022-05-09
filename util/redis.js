var redis = require("redis");
const logFactory = require("./logger");

exports = module.exports;

var redisLogger = exports.redisLogger = function(name, prefix, defaultLevel)
{
    if (!defaultLevel) {
        defaultLevel = "error";
    }
    
    var level = null;
    
    // allow for global redis default
    // allow for prefix specific
    if (typeof(process.env["CLOUDCMS_REDIS_DEBUG_LEVEL"]) !== "undefined") {
        level = "" + process.env["CLOUDCMS_REDIS_DEBUG_LEVEL"].toLowerCase();
    }
    
    if (!level && prefix)
    {
        if (typeof(process.env[prefix + "REDIS_DEBUG_LEVEL"]) !== "undefined") {
            level = "" + process.env[prefix + "REDIS_DEBUG_LEVEL"].toLowerCase();
        }
    }
    
    if (!level) {
        level = defaultLevel;
    }
    
    var logger = logFactory(name);
    logger.setLevel(level);
    
    return logger;
}

var redisOptions = exports.redisOptions = function(config, prefix)
{
    if (!config) {
        config = {};
    }
    
    // redis port
    var redisPort = config.port;
    if (prefix)
    {
        if (typeof(redisPort) === "undefined" || !redisPort)
        {
            // CLOUDCMS_LOCKS_REDIS_PORT;
            redisPort = process.env[prefix + "_REDIS_PORT"];
        }
    }
    if (typeof(redisPort) === "undefined" || !redisPort)
    {
        redisPort = process.env.CLOUDCMS_REDIS_PORT;
    }
    
    // redis host
    var redisEndpoint = config.endpoint;
    if (prefix)
    {
        if (typeof(redisEndpoint) === "undefined" || !redisEndpoint)
        {
            redisEndpoint = process.env[prefix + "_REDIS_ENDPOINT"];
        }
    }
    if (typeof(redisEndpoint) === "undefined" || !redisEndpoint)
    {
        redisEndpoint = process.env.CLOUDCMS_REDIS_ENDPOINT;
    }
    
    // redis url
    var redisUrl = config.url;
    if (prefix)
    {
        if (typeof(redisUrl) === "undefined" || !redisUrl)
        {
            redisUrl = process.env[prefix + "_REDIS_URL"];
        }
    }
    if (typeof(redisUrl) === "undefined" || !redisUrl)
    {
        redisUrl = process.env.CLOUDCMS_REDIS_URL;
    }
   
    // build redis URL from components if not otherwise provided
    if (!redisUrl)
    {
        redisUrl = "redis://" + redisEndpoint + ":" + redisPort;
    }
    
    var redisOptions = {};
    redisOptions.url = redisUrl;
    
    return redisOptions;
}

var createAndConnect = exports.createAndConnect = async function(redisOptions, callback)
{
    var client = redis.createClient(redisOptions);
    
    var connectErr = null;
    client.on('error', function(err) {
        console.log('Redis Client Error', err);
        connectErr = err;
    });
    
    // connect
    await client.connect();
    //console.log("Connected to redis, options: " + JSON.stringify(redisOptions, null, 2) + ", err: " + connectErr + ", client: " + client);

    return callback(connectErr, client);
}
