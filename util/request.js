var axios = require("axios");

// var http = require("http");
// var https = require("https");
//
// var FormData = require("form-data");

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
    requestConfig.headers = {};

    if (!config) {
        config = {};
    }
    if (!config.headers) {
        config.headers = {};
    }
    for (var k in config.headers)
    {
        var v = config.headers[k];
        if (v)
        {
            requestConfig.headers[k.trim().toLowerCase()] = v;
        }
    }
    // support for FormData headers
    // copy form data headers
    if (config.data && config.data.getHeaders)
    {
        var formDataHeaders = config.data.getHeaders();
        for (var k in formDataHeaders)
        {
            var v = formDataHeaders[k];
            requestConfig.headers[k] = v;
        }
    }
    
    if (config.qs) {
        requestConfig.params = config.qs;
    }

    if (config.json) {
        requestConfig.data = config.json;
        
        if (!requestConfig.headers["content-type"]) {
            requestConfig.headers["content-type"] = "application/json";
        }
    }

    if (config.data)
    {
        requestConfig.data = config.data;
    
        if (!requestConfig.headers["content-type"])
        {
            if (!requestConfig.data)
            {
                if (requestConfig.data.getHeaders)
                {
                    // assume this is a FormData and skip
                }
                else if (typeof(requestConfig.data) === "object")
                {
                    // send as json
                    requestConfig.headers["content-type"] = "application/json";
                }
            }
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