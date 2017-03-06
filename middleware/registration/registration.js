var path = require('path');
var fs = require('fs');
var http = require('http');
var util = require("../../util/util");
var Gitana = require("gitana");
var duster = require("../../duster/index");
var async = require("async");
var auth = require("../../util/auth");

/**
 * Registration middleware.
 *
 * @type {Function}
 */
exports = module.exports = function()
{
    var acquireProperty = function(obj, propertyNames)
    {
        var value = null;

        for (var i = 0; i < propertyNames.length; i++)
        {
            value = obj[propertyNames[i]];
            if (value)
            {
                break;
            }
        }

        return value;
    };

    var handleRegistration = function(req, res, next, configuration)
    {
        if (!configuration) {
            configuration = {};
        }

        var successUrl = acquireProperty(req.query, ["success", "successUrl", "successURL", "successRedirect"]);
        var failureUrl = acquireProperty(req.query, ["failure", "failureUrl", "failureURL", "failureRedirect"]);

        // from session
        var providerId = req.session.registration_provider_id;
        var userObject = req.session.registration_user_object;
        var providerUserId = req.session.registration_user_identifier;
        var token = req.session.registration_token;
        var refreshToken = req.session.registration_refresh_token;

        var options = configuration.options;
        if (!options) {
            options = {};
        }

        // var platform = req.gitana.platform();

        // registration info
        var form = req.body;

        // gitana instance
        var gitana = req.gitana;

        // domain
        var domain = req.gitana.datastore("principals");

        // validation functions
        var errors = [];
        var fns = [];

        if (options.passwords)
        {
            fns.push(function(gitana, form, errors) {
                return function (done) {

                    // ensure we have a "password" field
                    if (!form.password)
                    {
                        errors.push({
                            "field": "password",
                            "error": "Field 'password' is missing"
                        });
                    }

                    // ensure we have a "passwordVerify" field
                    if (!form.passwordVerify)
                    {
                        errors.push({
                            "field": "passwordVerify",
                            "error": "Field 'passwordVerify' is missing"
                        });
                    }

                    // check that passwords match
                    if (form.password !== form.passwordVerify)
                    {
                        errors.push({
                            "field": "password",
                            "error": "The passwords do not match."
                        });
                    }

                    done();
                }
            }(gitana, form, errors));
        }

        if (options.email)
        {
            fns.push(function(gitana, form, errors) {

                return function(done) {

                    // check email provided
                    if (!form.email)
                    {
                        errors.push({
                            "field": "email",
                            "error": "Field 'email' is missing"
                        });
                    }

                    // check for email validity
                    if (form.email)
                    {
                        var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
                        if (!re.test(form.email))
                        {
                            errors.push({
                                "field": "email",
                                "error": "The provided email is not valid"
                            });
                        }
                    }

                    done();
                };
            }(gitana, form, errors));
        }

        if (options.username)
        {
            fns.push(function(gitana, form, errors) {

                return function(done) {

                    // check username
                    if (!form.username)
                    {
                        errors.push({
                            "field": "username",
                            "error": "Field 'username' is missing"
                        });
                    }

                    done();
                }
            }(gitana, form, errors));

            fns.push(function(gitana, form, errors, domain) {

                return function(done) {

                    // check if a user already exists with this username
                    Chain(domain).trap(function () {
                        done();
                        return false;
                    }).readPrincipal(form.username).then(function () {

                        // found
                        errors.push({
                            "field": "username",
                            "error": "A user already exists for this username."
                        });

                        done();
                    });
                }
            }(gitana, form, errors, domain));
        }

        async.series(fns, function() {

            if (errors && errors.length > 0)
            {
                if (req.flash)
                {
                    req.flash("errors", errors);
                }

                if (failureUrl)
                {
                    return res.redirect(failureUrl);
                }

                return res.status(200).type("application/json").send(JSON.stringify({
                    "ok": false,
                    "err": errors
                }));
            }

            // copy in properties
            for (var k in form) {
                userObject[k] = form[k];
            }

            if (providerId)
            {
                process.authentication.buildProvider(req, providerId, function(err, provider, providerType, providerConfig) {

                    if (err) {
                        return res.redirect(failureUrl);
                    }

                    // create the user
                    auth.createUserForProvider(domain, providerId, providerUserId, token, refreshToken, userObject, function (err, gitanaUser) {

                        if (err) {
                            return res.redirect(failureUrl);
                        }

                        res.redirect(successUrl);
                    });
                });
            }
            else
            {
                Chain(domain).trap(function(e) {
                    res.redirect(failureUrl);
                    return false;
                }).createUser(userObject).then(function() {
                    res.redirect(successUrl);
                });

            }
        });
    };

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    /**
     * Handles registration.
     *
     * @return {Function}
     */
    r.handler = function()
    {
        return util.createHandler("registration", function(req, res, next, stores, cache, configuration) {

            var handled = false;

            if (req.method.toLowerCase() === "post") {

                if (req.url.indexOf("/register") === 0)
                {
                    handleRegistration(req, res, next, configuration);
                    handled = true;
                }
            }

            if (!handled)
            {
                next();
            }
        });
    };

    return r;
}();
