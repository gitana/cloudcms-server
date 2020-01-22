window.GenerateForm = function(json)
{
    var helper = json.helper;
    var config = JSON.parse(JSON.stringify(json));

    var action = helper.action;
    action += "?a=1";
    if (helper.list)
    {
        action += "&list=" + helper.list;
    }
    /*
    if (helper.successUrl)
    {
        action += "&successUrl=" + helper.successUrl;
    }
    if (helper.errorUrl)
    {
        action += "&errorUrl=" + helper.errorUrl;
    }
    */

    config.options.renderForm = true;
    config.options.form = {
        "attributes": {
            "method": helper.method,
            "action": action
        },
        "buttons": {
            "submit": {
                "title": helper.submitTitle || "Submit",
                "click": function(e) {
                    e.preventDefault();

                    var data = this.getValue();
                    if (typeof(grecaptcha) !== "undefined") {
                        data.grecaptchaResponse = grecaptcha.getResponse();
                    }
                    var promise = this.ajaxSubmit({
                        "dataType": "json",
                        "data": JSON.stringify(data),
                        "contentType": 'application/json; charset=UTF-8'
                    });
                    promise.done(function(data, textStatus, jqXHR) {
                        if (helper.successUrl)
                        {
                            window.location.href = helper.successUrl;
                        }
                    });
                    promise.fail(function(jqXHR, textStatus, errorThrown) {
                        if (helper.errorUrl)
                        {
                            window.location.href = helper.errorUrl;
                        }
                    });
                }
            }
        }
    };

    return config;
};