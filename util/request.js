var axios = require("axios");

var http = require("http");
var https = require("https");

/**
 * Incoming config:
 *
 * {
 *     "url": "",
 *     "method": "",
 *     "headers": {},
 *     "qs": {},
 *     "data": "" | {},
 *     "json": {}
 * }
 *
 * Callback is (err, response).
 *
 * Where response is the Axios response object.
 *
 * @param config
 * @param callback
 */
module.exports = function(config, callback)
{
    // request config - https://github.com/request/request#requestoptions-callback
    // axios config - https://www.npmjs.com/package/axios

    var requestConfig = {};
    requestConfig.url = config.uri || config.url;
    requestConfig.method = config.method || "get";

    if (!config.headers) {
        config.headers = {};
    }

    if (config.headers) {
        requestConfig.headers = config.headers;
    }

    if (config.qs) {
        requestConfig.params = config.qs;
    }

    if (config.json) {
        requestConfig.data = config.json;
        requestConfig.headers["content-type"] = "application/json";
    }

    if (config.data) {
        requestConfig.data = config.data;

        if (requestConfig.data !== null && typeof requestConfig.data === 'object')
        {
            requestConfig.headers["content-type"] = "application/json";
        }
    }

    if (config.responseType) {
        requestConfig.responseType = config.responseType;
    }


    /*
    if (requestConfig.url.toLowerCase().indexOf("https:") > -1)
    {
        requestConfig.httpsAgent = https.globalAgent;
    }
    else
    {
        requestConfig.httpAgent = http.globalAgent;
    }
    */

    axios.request(requestConfig).then(function(response) {
        callback(null, response, response.data);
    }, function(error) {
        callback(error);
    });
};