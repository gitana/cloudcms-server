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

        // registration info
        var form = req.body;

        // these come off the form (potentially)
        var strategyId = form.strategyId;
        delete form.strategyId;
        var providerUserId = form.providerUserId;
        delete form.providerUserId;
        var providerId = form.providerId;
        delete form.providerId;

        // successUrl
        var successUrl = req.query.successUrl;
        if (!successUrl) {
            successUrl = form.successUrl;
        }
        if (!successUrl) {
            successUrl = configuration.successUrl;
        }
        delete form.successUrl;

        // failureUrl
        var failureUrl = req.query.failureUrl;
        if (!failureUrl) {
            failureUrl = form.failureUrl;
        }
        if (!failureUrl) {
            failureUrl = configuration.failureUrl;
        }
        delete form.failureUrl;

        // these come off session (if available)
        var token = null;
        var refreshToken = null;
        if (req.session)
        {
            if (!strategyId) {
                strategyId = req.session.registration_strategy_id;
            }

            if (!providerUserId) {
                providerUserId = req.session.registration_user_identifier;
            }

            token = req.session.registration_token;
            refreshToken = req.session.registration_refresh_token;
        }

        // gitana instance
        var gitana = req.gitana;

        // domain
        var domain = req.gitana.datastore("principals");

        // validation functions
        var errors = [];
        var fns = [];

        if (configuration.validatePasswords)
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

        if (configuration.validateEmail)
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

        if (configuration.validateUsername)
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

            // copy in properties
            var userObject = {};
            for (var k in form) {
                userObject[k] = form[k];
            }

            if (errors && errors.length > 0)
            {
                if (req.session && req.flash)
                {
                    req.flash("errors", errors);
                }

                if (failureUrl)
                {
                    return res.redirect(failureUrl);
                }

                if (configuration.failureHandler)
                {
                    var info = {};
                    info.providerId = providerId;
                    info.providerUserId = providerUserId;

                    return configuration.failureHandler(req, res, next, errors, strategyId, userObject, info);
                }

                return res.status(200).type("application/json").send(JSON.stringify({
                    "ok": false,
                    "err": errors
                }));
            }

            if (strategyId)
            {
                process.authentication.buildStrategy(req, strategyId, function(err, result, strategyId, strategy, adapterId, adapter, providerId, provider, authenticatorId, authenticator) {

                    var providerId = result.providerId;

                    if (err)
                    {
                        if (failureUrl) {
                            return res.redirect(failureUrl);
                        }

                        return res.status(200).type("application/json").send(JSON.stringify({
                            "ok": false,
                            "err": err
                        }));
                    }

                    // create the user
                    auth.createUserForProvider(domain, providerId, providerUserId, token, refreshToken, userObject, function (err, gitanaUser) {

                        if (err) {
                            if (failureUrl) {
                                return res.redirect(failureUrl);
                            }

                            return res.status(200).type("application/json").send(JSON.stringify({
                                "ok": false,
                                "err": err
                            }));
                        }

                        if (successUrl) {
                            return res.redirect(successUrl);
                        }

                        return res.status(200).type("application/json").send(JSON.stringify({
                            "ok": true,
                            "userObject": userObject
                        }));
                    });
                });
            }
            else
            {
                Chain(domain).trap(function(err) {
                    if (failureUrl) {
                        res.redirect(failureUrl);
                    } else {
                        return res.status(200).type("application/json").send(JSON.stringify({
                            "ok": false,
                            "err": err
                        }));
                    }
                    return false;
                }).createUser(userObject).then(function() {
                    if (successUrl) {
                        res.redirect(successUrl);
                        return;
                    }

                    res.status(200).type("application/json").send(JSON.stringify({
                        "ok": true,
                        "userObject": userObject
                    }));
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
