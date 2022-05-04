exports = module.exports;

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
    redisOptions.legacyMode = true;
    
    return redisOptions;
}
