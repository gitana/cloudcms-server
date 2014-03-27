/*
Gitana JavaScript Driver - Version 1.0.82

Copyright 2013 Gitana Software, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.

You may obtain a copy of the License at
	http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software 
distributed under the License is distributed on an "AS IS" BASIS, 
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. 
See the License for the specific language governing permissions and 
limitations under the License. 

For more information, please contact Gitana Software, Inc. at this
address:

  info@gitanasoftware.com
*/
/**
 * UMD wrapper for compatibility with browser, Node and AMD.
 *
 * Based on:
 *   https://github.com/umdjs/umd/blob/master/returnExports.js
 */
(function (root, factory)
{
    if (typeof exports === 'object')
    {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        //module.exports = factory(require('b'));
        module.exports = factory();
    }
    else if (typeof define === 'function' && define.amd)
    {
        // AMD. Register as an anonymous module.
        //define(['b'], factory);
        define('gitana', [], factory);
    }
    else
    {
        // Browser globals
        //root.returnExports = factory(root.b);
        root["Gitana"] = factory();
    }

}(this, function () {

    //use b in some fashion.

    // Just return a value to define the module export.
    // This example returns an object, but the module
    // can return a function as the exported value.
    //return {};

    /**
 * This gets added into the Gitana Driver to ensure compilation time compatibility with
 * the Appcelerator Titanium framework.
 */
/* jQuery Sizzle - these are to fool the Ti compiler into not reporting errors! */

/**
 * The driver assumes a globally-scoped "window" variable which is a legacy of browser-compatibility.
 * Frameworks such as Titanium do not have a window root-scoped variable, so we fake one.
 *
 * At minimum, the window variable must have a setTimeout variable.
 */
if (typeof window === "undefined")
{
    window = {
        "setTimeout": function(func, seconds)
        {
            setTimeout(func, seconds);
        }
    };
}
/*
 Based on Base.js 1.1a (c) 2006-2010, Dean Edwards
 Updated to pass JSHint and converted into a module by Kenneth Powers
 License: http://www.opensource.org/licenses/mit-license.php

 GitHub: https://github.com/KenPowers/Base.js-Module
 */
/*global define:true module:true*/
/*jshint eqeqeq:true*/
(function (name, global, definition) {
//    if (typeof module !== 'undefined') {
//        module.exports = definition();
//    } else if (typeof define !== 'undefined' && typeof define.amd === 'object') {
//        define(definition);
//    } else {
        global[name] = definition();
//    }
})('Base', this, function () {
    // Base Object
    var Base = function () {};

    // Implementation
    Base.extend = function (_instance, _static) { // subclass
        var extend = Base.prototype.extend;
        // build the prototype
        Base._prototyping = true;
        var proto = new this();
        extend.call(proto, _instance);
        proto.base = function () {
            // call this method from any other method to invoke that method's ancestor
        };
        delete Base._prototyping;
        // create the wrapper for the constructor function
        //var constructor = proto.constructor.valueOf(); //-dean
        var constructor = proto.constructor;
        var klass = proto.constructor = function () {
            if (!Base._prototyping) {
                if (this._constructing || this.constructor === klass) { // instantiation
                    this._constructing = true;
                    constructor.apply(this, arguments);
                    delete this._constructing;
                } else if (arguments[0] !== null) { // casting
                    return (arguments[0].extend || extend).call(arguments[0], proto);
                }
            }
        };
        // build the class interface
        klass.ancestor = this;
        klass.extend = this.extend;
        klass.forEach = this.forEach;
        klass.implement = this.implement;
        klass.prototype = proto;
        klass.toString = this.toString;
        klass.valueOf = function (type) {
            return (type === 'object') ? klass : constructor.valueOf();
        };
        extend.call(klass, _static);
        // class initialization
        if (typeof klass.init === 'function') klass.init();
        return klass;
    };

    Base.prototype = {
        extend: function (source, value) {
            if (arguments.length > 1) { // extending with a name/value pair
                var ancestor = this[source];
                if (ancestor && (typeof value === 'function') && // overriding a method?
                    // the valueOf() comparison is to avoid circular references
                    (!ancestor.valueOf || ancestor.valueOf() !== value.valueOf()) && /\bbase\b/.test(value)) {
                    // get the underlying method
                    var method = value.valueOf();
                    // override
                    value = function () {
                        var previous = this.base || Base.prototype.base;
                        this.base = ancestor;
                        var returnValue = method.apply(this, arguments);
                        this.base = previous;
                        return returnValue;
                    };
                    // point to the underlying method
                    value.valueOf = function (type) {
                        return (type === 'object') ? value : method;
                    };
                    value.toString = Base.toString;
                }
                this[source] = value;
            } else if (source) { // extending with an object literal
                var extend = Base.prototype.extend;
                // if this object has a customized extend method then use it
                if (!Base._prototyping && typeof this !== 'function') {
                    extend = this.extend || extend;
                }
                var proto = {
                    toSource: null
                };
                // do the "toString" and other methods manually
                var hidden = ['constructor', 'toString', 'valueOf'];
                // if we are prototyping then include the constructor
                for (var i = Base._prototyping ? 0 : 1; i < hidden.length; i++) {
                    var h = hidden[i];
                    if (source[h] !== proto[h])
                        extend.call(this, h, source[h]);
                }
                // copy each of the source object's properties to this object
                for (var key in source) {
                    if (!proto[key]) extend.call(this, key, source[key]);
                }
            }
            return this;
        }
    };

    // initialize
    Base = Base.extend({
        constructor: function () {
            this.extend(arguments[0]);
        }
    }, {
        ancestor: Object,
        version: '1.1',
        forEach: function (object, block, context) {
            for (var key in object) {
                if (this.prototype[key] === undefined) {
                    block.call(context, object[key], key, object);
                }
            }
        },
        implement: function () {
            for (var i = 0; i < arguments.length; i++) {
                if (typeof arguments[i] === 'function') {
                    // if it's a function, call it
                    arguments[i](this.prototype);
                } else {
                    // add the interface using the extend method
                    this.prototype.extend(arguments[i]);
                }
            }
            return this;
        },
        toString: function () {
            return String(this.valueOf());
        }
    });

    // Return Base implementation
    return Base;
});/*
 json2.js
 2012-10-08

 Public Domain.

 NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.

 See http://www.JSON.org/js.html


 This code should be minified before deployment.
 See http://javascript.crockford.com/jsmin.html

 USE YOUR OWN COPY. IT IS EXTREMELY UNWISE TO LOAD CODE FROM SERVERS YOU DO
 NOT CONTROL.


 This file creates a global JSON object containing two methods: stringify
 and parse.

 JSON.stringify(value, replacer, space)
 value       any JavaScript value, usually an object or array.

 replacer    an optional parameter that determines how object
 values are stringified for objects. It can be a
 function or an array of strings.

 space       an optional parameter that specifies the indentation
 of nested structures. If it is omitted, the text will
 be packed without extra whitespace. If it is a number,
 it will specify the number of spaces to indent at each
 level. If it is a string (such as '\t' or '&nbsp;'),
 it contains the characters used to indent at each level.

 This method produces a JSON text from a JavaScript value.

 When an object value is found, if the object contains a toJSON
 method, its toJSON method will be called and the result will be
 stringified. A toJSON method does not serialize: it returns the
 value represented by the name/value pair that should be serialized,
 or undefined if nothing should be serialized. The toJSON method
 will be passed the key associated with the value, and this will be
 bound to the value

 For example, this would serialize Dates as ISO strings.

 Date.prototype.toJSON = function (key) {
 function f(n) {
 // Format integers to have at least two digits.
 return n < 10 ? '0' + n : n;
 }

 return this.getUTCFullYear()   + '-' +
 f(this.getUTCMonth() + 1) + '-' +
 f(this.getUTCDate())      + 'T' +
 f(this.getUTCHours())     + ':' +
 f(this.getUTCMinutes())   + ':' +
 f(this.getUTCSeconds())   + 'Z';
 };

 You can provide an optional replacer method. It will be passed the
 key and value of each member, with this bound to the containing
 object. The value that is returned from your method will be
 serialized. If your method returns undefined, then the member will
 be excluded from the serialization.

 If the replacer parameter is an array of strings, then it will be
 used to select the members to be serialized. It filters the results
 such that only members with keys listed in the replacer array are
 stringified.

 Values that do not have JSON representations, such as undefined or
 functions, will not be serialized. Such values in objects will be
 dropped; in arrays they will be replaced with null. You can use
 a replacer function to replace those with JSON values.
 JSON.stringify(undefined) returns undefined.

 The optional space parameter produces a stringification of the
 value that is filled with line breaks and indentation to make it
 easier to read.

 If the space parameter is a non-empty string, then that string will
 be used for indentation. If the space parameter is a number, then
 the indentation will be that many spaces.

 Example:

 text = JSON.stringify(['e', {pluribus: 'unum'}]);
 // text is '["e",{"pluribus":"unum"}]'


 text = JSON.stringify(['e', {pluribus: 'unum'}], null, '\t');
 // text is '[\n\t"e",\n\t{\n\t\t"pluribus": "unum"\n\t}\n]'

 text = JSON.stringify([new Date()], function (key, value) {
 return this[key] instanceof Date ?
 'Date(' + this[key] + ')' : value;
 });
 // text is '["Date(---current time---)"]'


 JSON.parse(text, reviver)
 This method parses a JSON text to produce an object or array.
 It can throw a SyntaxError exception.

 The optional reviver parameter is a function that can filter and
 transform the results. It receives each of the keys and values,
 and its return value is used instead of the original value.
 If it returns what it received, then the structure is not modified.
 If it returns undefined then the member is deleted.

 Example:

 // Parse the text. Values that look like ISO date strings will
 // be converted to Date objects.

 myData = JSON.parse(text, function (key, value) {
 var a;
 if (typeof value === 'string') {
 a =
 /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/.exec(value);
 if (a) {
 return new Date(Date.UTC(+a[1], +a[2] - 1, +a[3], +a[4],
 +a[5], +a[6]));
 }
 }
 return value;
 });

 myData = JSON.parse('["Date(09/09/2001)"]', function (key, value) {
 var d;
 if (typeof value === 'string' &&
 value.slice(0, 5) === 'Date(' &&
 value.slice(-1) === ')') {
 d = new Date(value.slice(5, -1));
 if (d) {
 return d;
 }
 }
 return value;
 });


 This is a reference implementation. You are free to copy, modify, or
 redistribute.
 */

/*jslint evil: true, regexp: true */

/*members "", "\b", "\t", "\n", "\f", "\r", "\"", JSON, "\\", apply,
 call, charCodeAt, getUTCDate, getUTCFullYear, getUTCHours,
 getUTCMinutes, getUTCMonth, getUTCSeconds, hasOwnProperty, join,
 lastIndex, length, parse, prototype, push, replace, slice, stringify,
 test, toJSON, toString, valueOf
 */


// Create a JSON object only if one does not already exist. We create the
// methods in a closure to avoid creating global variables.

if (typeof JSON !== 'object') {
    JSON = {};
}

(function () {
    'use strict';

    function f(n) {
        // Format integers to have at least two digits.
        return n < 10 ? '0' + n : n;
    }

    if (typeof Date.prototype.toJSON !== 'function') {

        Date.prototype.toJSON = function (key) {

            return isFinite(this.valueOf())
                ? this.getUTCFullYear()     + '-' +
                f(this.getUTCMonth() + 1) + '-' +
                f(this.getUTCDate())      + 'T' +
                f(this.getUTCHours())     + ':' +
                f(this.getUTCMinutes())   + ':' +
                f(this.getUTCSeconds())   + 'Z'
                : null;
        };

        String.prototype.toJSON      =
            Number.prototype.toJSON  =
                Boolean.prototype.toJSON = function (key) {
                    return this.valueOf();
                };
    }

    var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        gap,
        indent,
        meta = {    // table of character substitutions
            '\b': '\\b',
            '\t': '\\t',
            '\n': '\\n',
            '\f': '\\f',
            '\r': '\\r',
            '"' : '\\"',
            '\\': '\\\\'
        },
        rep;


    function quote(string) {

// If the string contains no control characters, no quote characters, and no
// backslash characters, then we can safely slap some quotes around it.
// Otherwise we must also replace the offending characters with safe escape
// sequences.

        escapable.lastIndex = 0;
        return escapable.test(string) ? '"' + string.replace(escapable, function (a) {
            var c = meta[a];
            return typeof c === 'string'
                ? c
                : '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
        }) + '"' : '"' + string + '"';
    }


    function str(key, holder) {

// Produce a string from holder[key].

        var i,          // The loop counter.
            k,          // The member key.
            v,          // The member value.
            length,
            mind = gap,
            partial,
            value = holder[key];

// If the value has a toJSON method, call it to obtain a replacement value.

        if (value && typeof value === 'object' &&
            typeof value.toJSON === 'function') {
            value = value.toJSON(key);
        }

// If we were called with a replacer function, then call the replacer to
// obtain a replacement value.

        if (typeof rep === 'function') {
            value = rep.call(holder, key, value);
        }

// What happens next depends on the value's type.

        switch (typeof value) {
            case 'string':
                return quote(value);

            case 'number':

// JSON numbers must be finite. Encode non-finite numbers as null.

                return isFinite(value) ? String(value) : 'null';

            case 'boolean':
            case 'null':

// If the value is a boolean or null, convert it to a string. Note:
// typeof null does not produce 'null'. The case is included here in
// the remote chance that this gets fixed someday.

                return String(value);

// If the type is 'object', we might be dealing with an object or an array or
// null.

            case 'object':

// Due to a specification blunder in ECMAScript, typeof null is 'object',
// so watch out for that case.

                if (!value) {
                    return 'null';
                }

// Make an array to hold the partial results of stringifying this object value.

                gap += indent;
                partial = [];

// Is the value an array?

                if (Object.prototype.toString.apply(value) === '[object Array]') {

// The value is an array. Stringify every element. Use null as a placeholder
// for non-JSON values.

                    length = value.length;
                    for (i = 0; i < length; i += 1) {
                        partial[i] = str(i, value) || 'null';
                    }

// Join all of the elements together, separated with commas, and wrap them in
// brackets.

                    v = partial.length === 0
                        ? '[]'
                        : gap
                        ? '[\n' + gap + partial.join(',\n' + gap) + '\n' + mind + ']'
                        : '[' + partial.join(',') + ']';
                    gap = mind;
                    return v;
                }

// If the replacer is an array, use it to select the members to be stringified.

                if (rep && typeof rep === 'object') {
                    length = rep.length;
                    for (i = 0; i < length; i += 1) {
                        if (typeof rep[i] === 'string') {
                            k = rep[i];
                            v = str(k, value);
                            if (v) {
                                partial.push(quote(k) + (gap ? ': ' : ':') + v);
                            }
                        }
                    }
                } else {

// Otherwise, iterate through all of the keys in the object.

                    for (k in value) {
                        if (Object.prototype.hasOwnProperty.call(value, k)) {
                            v = str(k, value);
                            if (v) {
                                partial.push(quote(k) + (gap ? ': ' : ':') + v);
                            }
                        }
                    }
                }

// Join all of the member texts together, separated with commas,
// and wrap them in braces.

                v = partial.length === 0
                    ? '{}'
                    : gap
                    ? '{\n' + gap + partial.join(',\n' + gap) + '\n' + mind + '}'
                    : '{' + partial.join(',') + '}';
                gap = mind;
                return v;
        }
    }

// If the JSON object does not yet have a stringify method, give it one.

    if (typeof JSON.stringify !== 'function') {
        JSON.stringify = function (value, replacer, space) {

// The stringify method takes a value and an optional replacer, and an optional
// space parameter, and returns a JSON text. The replacer can be a function
// that can replace values, or an array of strings that will select the keys.
// A default replacer method can be provided. Use of the space parameter can
// produce text that is more easily readable.

            var i;
            gap = '';
            indent = '';

// If the space parameter is a number, make an indent string containing that
// many spaces.

            if (typeof space === 'number') {
                for (i = 0; i < space; i += 1) {
                    indent += ' ';
                }

// If the space parameter is a string, it will be used as the indent string.

            } else if (typeof space === 'string') {
                indent = space;
            }

// If there is a replacer, it must be a function or an array.
// Otherwise, throw an error.

            rep = replacer;
            if (replacer && typeof replacer !== 'function' &&
                (typeof replacer !== 'object' ||
                    typeof replacer.length !== 'number')) {
                throw new Error('JSON.stringify');
            }

// Make a fake root object containing our value under the key of ''.
// Return the result of stringifying the value.

            return str('', {'': value});
        };
    }


// If the JSON object does not yet have a parse method, give it one.

    if (typeof JSON.parse !== 'function') {
        JSON.parse = function (text, reviver) {

// The parse method takes a text and an optional reviver function, and returns
// a JavaScript value if the text is a valid JSON text.

            var j;

            function walk(holder, key) {

// The walk method is used to recursively walk the resulting structure so
// that modifications can be made.

                var k, v, value = holder[key];
                if (value && typeof value === 'object') {
                    for (k in value) {
                        if (Object.prototype.hasOwnProperty.call(value, k)) {
                            v = walk(value, k);
                            if (v !== undefined) {
                                value[k] = v;
                            } else {
                                delete value[k];
                            }
                        }
                    }
                }
                return reviver.call(holder, key, value);
            }


// Parsing happens in four stages. In the first stage, we replace certain
// Unicode characters with escape sequences. JavaScript handles many characters
// incorrectly, either silently deleting them, or treating them as line endings.

            text = String(text);
            cx.lastIndex = 0;
            if (cx.test(text)) {
                text = text.replace(cx, function (a) {
                    return '\\u' +
                        ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
                });
            }

// In the second stage, we run the text against regular expressions that look
// for non-JSON patterns. We are especially concerned with '()' and 'new'
// because they can cause invocation, and '=' because it can cause mutation.
// But just to be safe, we want to reject all unexpected forms.

// We split the second stage into 4 regexp operations in order to work around
// crippling inefficiencies in IE's and Safari's regexp engines. First we
// replace the JSON backslash pairs with '@' (a non-JSON character). Second, we
// replace all simple value tokens with ']' characters. Third, we delete all
// open brackets that follow a colon or comma or that begin the text. Finally,
// we look to see that the remaining characters are only whitespace or ']' or
// ',' or ':' or '{' or '}'. If that is so, then the text is safe for eval.

            if (/^[\],:{}\s]*$/
                .test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@')
                .replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']')
                .replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {

// In the third stage we use the eval function to compile the text into a
// JavaScript structure. The '{' operator is subject to a syntactic ambiguity
// in JavaScript: it can begin a block or an object literal. We wrap the text
// in parens to eliminate the ambiguity.

                j = eval('(' + text + ')');

// In the optional fourth stage, we recursively walk the new structure, passing
// each name/value pair to a reviver function for possible transformation.

                return typeof reviver === 'function'
                    ? walk({'': j}, '')
                    : j;
            }

// If the text is not JSON parseable, then a SyntaxError is thrown.

            throw new SyntaxError('JSON.parse');
        };
    }
}());(function(window)
{
    Gitana = Base.extend(
    /** @lends Gitana.prototype */
    {
        /**
         * @constructs
         *
         * @class Gitana
         *
         * Configuration options should look like:
         *
         * {
         *    "clientKey": {String} the oauth2 client id,
         *    "clientSecret": [String] the oauth2 client secret,
         *    "baseURL": [String] the relative URI path of the base URL (assumed to be "/proxy"),
         *    "locale": [String] optional locale (assumed to be en_US),
         *    "storage": [String|Object] Gitana.OAuth2.Storage implementation or a string identifying where to store
         *       Gitana OAuth2 tokens ("local", "session", "memory") or empty for memory-only storage
         * }
         */
        constructor: function(settings)
        {
            var self = this;

            if (!settings)
            {
                settings = {};
            }

            if (settings.host)
            {
                settings.baseURL = settings.host + "/proxy";
            }

            this.applicationInfo = {};
            this.stackInfo = {};

            // build config
            var config = {
                "clientKey": null,
                "clientSecret": null,
                "baseURL": "/proxy",
                "locale": null,
                "application": null,
                "loadAppHelper": true,
                "storage": null
            };
            Gitana.copyKeepers(config, Gitana.loadDefaultConfig());
            Gitana.copyKeepers(config, settings);


            //////////////////////////////////////////////////////////////////////////
            //
            // APPLY CONFIGURATION SETTINGS
            //

            // baseURL
            this.baseURL = config.baseURL;

            // locale
            this.locale = config.locale;




            //////////////////////////////////////////////////////////////////////////
            //
            // APPLY OAUTH2 SETTINGS
            //

            // set up our oAuth2 connection
            var options = {};
            if (config.clientKey) {
                options.clientKey = config.clientKey;
            }
            if (config.clientSecret) {
                options.clientSecret = config.clientSecret;
            }
            if (this.baseURL)
            {
                options.baseURL = this.baseURL;
                options.tokenURL = "/oauth/token";
            }
            // the driver requires the "api" scope to be granted
            options.requestedScope = "api";



            //////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //

            this.updateOptions = function(o)
            {
                if (o)
                {
                    Gitana.copyInto(options, o);
                }
            };

            this.resetHttp = function(config)
            {
                var o = {};
                Gitana.copyInto(o, options);

                if (config)
                {
                    Gitana.copyInto(o, config);
                }

                if (!o.storage)
                {
                    o.storage = this.getOriginalConfiguration().storage;
                }

                self.http = new Gitana.OAuth2Http(o, o.storage);
            };

            this.setAuthInfo = function(authInfo)
            {
                this.authInfo = authInfo;
            };

            this.setStackInfo = function(stackInfo)
            {
                this.stackInfo = stackInfo;
            };

            this.setApplicationInfo = function(applicationInfo)
            {
                this.applicationInfo = applicationInfo;
            };

            this.getOriginalConfiguration = function()
            {
                return config;
            };

            this.getHttpHeaders = function()
            {
                var self = this;

                var headers = {};

                if (self.http && self.http.getBearerAuthorizationHeader())
                {
                    headers["Authorization"] = self.http.getBearerAuthorizationHeader();
                }

                return headers;
            };
        },

        /**
         * Sets the authentication info
         */
        getAuthInfo: function()
        {
            return this.authInfo;
        },

        getStackInfo: function()
        {
            return this.stackInfo;
        },

        getApplicationInfo: function()
        {
            return this.applicationInfo;
        },

        /**
         * Sets the default locale for interactions with the Gitana server by this driver.
         *
         * @public
         *
         * @param {String} locale locale string
         */
        setLocale: function(locale)
        {
            this.locale = locale;
        },

        /**
         * Retrieves the default locale being used by this driver.
         *
         * @returns {String} locale string
         */
        getLocale: function()
        {
            return this.locale;
        },

        /**
         * Default AJAX failure callback
         *
         * @public
         */
        defaultFailureCallback: function(http)
        {
            // if we're in debug mode, log a bunch of good stuff out to console
            if (this.debug)
            {
                if (typeof console != "undefined")
                {
                    var message = "Received bad http state (" + http.status + ")";
                    var stacktrace = null;

                    var json = null;

                    var responseText = http.responseText;
                    if (responseText)
                    {
                        json = JSON.parse(responseText);
                        if (json && json.message)
                        {
                            message = message + ": " + json.message;
                        }
                    }

                    if (json && json["stacktrace"])
                    {
                        stacktrace = json["stacktrace"];
                    }

                    console.log(message);
                    if (stacktrace)
                    {
                        console.log(stacktrace);
                    }
                }
            }
        },


        /**
         * Performs Ajax communication with the Gitana server.
         *
         * NOTE: For the most part, you shouldn't have to use this function since most of the things you'd want
         * to do with the Gitana server are wrapped by helper functions.
         *
         * @see Gitana.Driver#gitanaGet
         * @see Gitana.Driver#gitanaPost
         * @see Gitana.Driver#gitanaPut
         * @see Gitana.Driver#gitanaDel
         * @see Gitana.Driver#gitanaRequest
         *
         * @public
         *
         * @param {String} method The kind of method to invoke - "get", "post", "put", or "del"
         * @param {String} url The full URL to the resource being requested (i.e. "http://server:port/uri"}
         * @param {String} [contentType] In the case of a payload carrying request (i.e. not GET), the content type being sent.
         * @param {Object} [data] In the case of a payload carrying request (i.e. not GET), the data to plug into the payload.
         * @param {Object} [headers] A key/value map of headers to place into the request.
         * @param {Function} [successCallback] The function to call if the operation succeeds.
         * @param {Function} [failureCallback] The function to call if the operation fails.  If none provided, the default driver callback is used.
         */
        ajax: function(method, url, contentType, data, headers, successCallback, failureCallback)
        {
            var _this = this;

            // ensure headers
            if (!headers)
            {
                headers = {};
            }

            // treat the method
            if (method == null) {
                method = "GET";
            }
            method = method.toUpperCase();

            // flags
            var json = false;
            if (contentType == "application/json")
            {
                json = true;
            }

            // error checking
            if ( (method == "POST" || method == "PUT") )
            {
                headers["Content-Type"] = contentType;
                if (!contentType)
                {
                    Gitana.debug("Performing method: " + method + " but missing content type");
                    return;
                }
            }

            var toSend = data;

            // special handling for json
            if (json)
            {
                // if empty payload for payload-bearing methods, populate with {}
                if (method == "PUT" || method == "POST")
                {
                    if (!data)
                    {
                        data = {};
                    }
                }

                if (!Gitana.isString(data))
                {
                    // stringify
                    toSend = Gitana.stringify(data);
                }
            }

            //
            // if the URL is relative and we're running in a browser, then we can pad the URL
            // based on the URL of the browser
            //
            // otherwise, we can't handle relative URLs
            //
            if (url.substring(0,1) == "/")
            {
                // if window.location exists, then we're running on a browser
                if (!Gitana.isUndefined(window.location))
                {
                    var u = window.location.protocol + "//" + window.location.host;
                    if (window.location.host.indexOf(":") == -1)
                    {
                        if (window.location.port) {
                            u += ":" + window.location.port;
                        }
                    }
                    url = u + url;
                }
                else
                {
                    // relative urls are not supported outside of the browser
                    throw new Error("Relative URL not supported outside of the browser: " + url);
                }
            }

            var config = {
                "method": method,
                "url": url,
                "data": toSend,
                "headers": headers,
                "success": successCallback,
                "failure": failureCallback
            };

            Gitana.requestCount++;
            this.http.request(config);

            return this;
        },

        /**
         * Send an HTTP request via AJAX to the Gitana Server.
         *
         * This method will additionally make sure of the following:
         *
         *   1) That the Gitana Driver authentication ticket is plugged onto the request.
         *   2) That the Gitana Driver locale is plugged onto the request.
         *   3) That full object data is returned (including metadata).
         *
         * @public
         *
         * @param {String} method The kind of method to invoke - "get", "post", "put", or "del"
         * @param {String} url Either a full URL (i.e. "http://server:port/uri") or a URI against the driver's server URL (i.e. /repositories/...)
         * @param {Object} params parameter map
         * @param [String] contentType If the case of a payload carrying request (i.e. not GET), the content type being sent.
         * @param {Object} data In the case of a payload carrying request (i.e. not GET), the JSON to plug into the payload.
         * @param {Function} [successCallback] The function to call if the operation succeeds.
         * @param {Function} [failureCallback] The function to call if the operation fails.
         */
        gitanaRequest: function(method, url, params, contentType, data, headers, successCallback, failureCallback)
        {
            // make sure we compute the real url
            if (Gitana.startsWith(url, "/")) {
                url = this.baseURL + url;
            }

            if (!failureCallback)
            {
                failureCallback = this.defaultFailureCallback;
            }

            if (!headers)
            {
                headers = {};
            }

            /**
             * Primary success callback handler for oAuth call to server.
             *
             * @param responseObject
             * @param xhr
             */
            var onSuccess = function(responseObject, xhr)
            {
                if (successCallback)
                {
                    // call back with just the response text (or json)

                    var arg = responseObject.text;
                    if (contentType == "application/json")
                    {
                        arg = new Gitana.Response(JSON.parse(arg));
                    }

                    successCallback(arg);
                }
            };

            /**
             * Primary failure callback handler for oAuth call to server.
             *
             * @param responseObject
             * @param xhr
             */
            var onFailure = function(responseObject, xhr)
            {
                if (failureCallback)
                {
                    var httpError = {};

                    httpError["statusText"] = xhr.statusText;
                    httpError["status"] = xhr.status;

                    var message = null;
                    var stacktrace = null;

                    var arg = responseObject.text;
                    if (contentType == "application/json")
                    {
                        try
                        {
                            var obj = new Gitana.Response(JSON.parse(arg));
                            if (obj.message)
                            {
                                message = obj.message;
                            }
                            if (obj.stacktrace)
                            {
                                stacktrace = obj.stacktrace;
                            }
                        }
                        catch (e) { }
                    }
                    if (message)
                    {
                        httpError.message = message;
                    }
                    if (stacktrace)
                    {
                        httpError.stacktrace = stacktrace;
                    }

                    failureCallback(httpError);
                }
            };

            if (this.locale) {
                headers["accept-language"] = this.locale;
            }

            // ensure we have some params
            if (!params)
            {
                params = {};
            }

            // adjust url to include "full" as well as "metadata" if not included
            if (Gitana.isEmpty(params["metadata"]))
            {
                params["metadata"] = true;
            }
            if (Gitana.isEmpty(params["full"]))
            {
                params["full"] = true;
            }

            // cache buster
            var cacheBuster = new Date().getTime();
            params["cb"] = cacheBuster;

            // update URL to include params
            for (var paramKey in params)
            {
                var paramValue = params[paramKey];
                if (Gitana.isFunction(paramValue))
                {
                    paramValue = paramValue.call();
                }
                else if (Gitana.isString(paramValue))
                {
                    // NOTHING TO DO
                }
                else if (Gitana.isNumber(paramValue))
                {
                    // NOTHING TO DO
                }
                else
                {
                    paramValue = escape(Gitana.stringify(paramValue, false));
                }

                // apply
                if (url.indexOf("?") > -1)
                {
                    url = url + "&" + paramKey + "=" + paramValue;
                }
                else
                {
                    url = url + "?" + paramKey + "=" + paramValue;
                }
            }

            return this.ajax(method, url, contentType, data, headers, onSuccess, onFailure);
        },

        /**
         * Sends an HTTP GET request to the Gitana server.
         *
         * @public
         *
         * @param {String} url Either a full URL (i.e. "http://server:port/uri") or a URI against the driver's server URL (i.e. /repositories/...)
         * @param {Object} params request parameters
         * @param {Object} headers request headers
         * @param {Function} [successCallback] The function to call if the operation succeeds.
         * @param {Function} [failureCallback] The function to call if the operation fails.
         */
        gitanaGet: function(url, params, headers, successCallback, failureCallback)
        {
            return this.gitanaRequest("GET", url, params, "application/json", null, headers, successCallback, failureCallback);
        },

        /**
         * Sends an HTTP GET request to the Gitana server.
         *
         * @public
         *
         * @param {String} url Either a full URL (i.e. "http://server:port/uri") or a URI against the driver's server URL (i.e. /repositories/...)
         * @param {Object} params request parameters
         * @param {Function} [successCallback] The function to call if the operation succeeds.
         * @param {Function} [failureCallback] The function to call if the operation fails.
         */
        gitanaDownload: function(url, params, successCallback, failureCallback)
        {
            return this.gitanaRequest("GET", url, params, null, null, {}, successCallback, failureCallback);
        },

        /**
         * Sends an HTTP POST request to the Gitana server.
         *
         * @public
         *
         * @param {String} url Either a full URL (i.e. "http://server:port/uri") or a URI against the driver's server URL (i.e. /repositories/...)
         * @param {Object} params request parameters
         * @param {Object} [jsonData] The JSON to plug into the payload.
         * @param {Function} [successCallback] The function to call if the operation succeeds.
         * @param {Function} [failureCallback] The function to call if the operation fails.
         */
        gitanaPost: function(url, params, jsonData, successCallback, failureCallback)
        {
            return this.gitanaRequest("POST", url, params, "application/json", jsonData, {}, successCallback, failureCallback);
        },

        /**
         * Sends an HTTP POST request to the Gitana server.
         *
         * @public
         *
         * @param {String} url Either a full URL (i.e. "http://server:port/uri") or a URI against the driver's server URL (i.e. /repositories/...)
         * @param {Object} params request parameters
         * @param {String} contentType content type being sent
         * @param {Object} [jsonData] The JSON to plug into the payload.
         * @param {Function} [successCallback] The function to call if the operation succeeds.
         * @param {Function} [failureCallback] The function to call if the operation fails.
         */
        gitanaUpload: function(url, params, contentType, data, successCallback, failureCallback)
        {
            return this.gitanaRequest("POST", url, params, contentType, data, {}, successCallback, failureCallback);
        },

        /**
         * Sends an HTTP PUT request to the Gitana server.
         *
         * @public
         *
         * @param {String} url Either a full URL (i.e. "http://server:port/uri") or a URI against the driver's server URL (i.e. /repositories/...)
         * @param {Object} params request parameters
         * @param {Object} [jsonData] The JSON to plug into the payload.
         * @param {Function} [successCallback] The function to call if the operation succeeds.
         * @param {Function} [failureCallback] The function to call if the operation fails.
         */
        gitanaPut: function(url, params, jsonData, successCallback, failureCallback)
        {
            return this.gitanaRequest("PUT", url, params, "application/json", jsonData, {}, successCallback, failureCallback);
        },

        /**
         * Sends an HTTP DELETE request to the Gitana server.
         *
         * @public
         *
         * @param {String} url Either a full URL (i.e. "http://server:port/uri") or a URI against the driver's server URL (i.e. /repositories/...)
         * @param {Object} params request parameters
         * @param {Function} [successCallback] The function to call if the operation succeeds.
         * @param {Function} [failureCallback] The function to call if the operation fails.
         */
        gitanaDelete: function(url, params, successCallback, failureCallback)
        {
            return this.gitanaRequest("DELETE", url, params, "application/json", null, {}, successCallback, failureCallback);
        },

        getFactory: function()
        {
            return new Gitana.ObjectFactory();
        },


        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // CHAINING METHODS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Authenticates as the supplied user.
         *
         * A user can either be authenticated using username/password credentials or via an authentication code.
         *
         * Authorization Code flow:
         *
         *   {
         *     "code": "<code>",
         *     "redirectUri": "<redirectUri>"
         *   }

         * Username/password flow:
         *
         *   {
         *     "username": "<username>",
         *     "password": "<password>"
         *   }
         *
         * Implicit flow:
         *
         *   {
         *     "accessToken": "<accessToken>",
         *     "redirectUri": "<redirectUri>"
         *   }
         *
         * Using Gitana Ticket from a cookie:
         *
         *   {
         *     "cookie": true
         *   }
         *
         * Using Gitana Ticket (explicitly provided):
         *
         *   {
         *     "ticket": "<ticket>"
         *   }
         *
         * An authentication failure handler can be passed as the final argument
         *
         * @chained platform
         *
         * @param {Object} settings
         * @param [Function] authentication failure handler
         */
        authenticate: function(settings, authFailureHandler)
        {
            var driver = this;

            // build config
            var config = {
                "code": null,
                "redirectUri": null,
                "username": null,
                "password": null,
                "accessToken": null,
                "ticket": null,
                "cookie": null,
                "ticketMaxAge": null
            };
            Gitana.copyKeepers(config, Gitana.loadDefaultConfig());
            Gitana.copyKeepers(config, settings);

            // platform config (for cache key determination)
            var platformConfig = {
                "key": null,
                "ticket": null,
                "username": null,
                "clientKey": null
            };
            Gitana.copyKeepers(platformConfig, this.getOriginalConfiguration());
            Gitana.copyKeepers(platformConfig, settings);
            var platformCacheKey = platformConfig.key;
            if (!platformCacheKey)
            {
                platformCacheKey = Gitana.determinePlatformCacheKey(platformConfig, true);
            }
            if (platformCacheKey)
            {
                this.platformCacheKey = platformCacheKey;
            }

            // build a cluster instance
            var cluster = new Gitana.Cluster(this, {});

            var applyPlatformCache = function(driver, platform)
            {
                var platformCacheKey = driver.platformCacheKey;
                if (platformCacheKey)
                {
                    Gitana.PLATFORM_CACHE(platformCacheKey, platform);
                }

                // always cache on ticket as well
                var ticket = driver.getAuthInfo().getTicket();
                if (ticket) {
                    Gitana.PLATFORM_CACHE(ticket, platform);
                }
            };

            // run with this = platform
            var doAuthenticate = function()
            {
                var platform = this;

                // params to /auth/info
                var authInfoParams = {};
                if (config.ticketMaxAge) {
                    authInfoParams.ticketMaxAge = config.ticketMaxAge;
                }

                // we provide a fallback if no flow type is specified, using "password" flow with guest/guest
                if (!config.code && !config.username && !config.accessToken && !config.cookie && !config.ticket)
                {
                    config.username = "guest";
                    config.password = "guest";
                }

                //
                // authenticate via the authentication flow
                //
                if (config.code)
                {
                    // clear existing cookie and ticket
                    config.authorizationFlow = Gitana.OAuth2Http.AUTHORIZATION_CODE;
                    driver.resetHttp(config);
                    Gitana.deleteCookie("GITANA_TICKET", "/");

                    // fetch the auth info
                    driver.gitanaGet("/auth/info", authInfoParams, {}, function(response) {

                        var authInfo = new Gitana.AuthInfo(response);
                        driver.setAuthInfo(authInfo);

                        // TODO: fix this
                        // kill the JSESSIONID cookie which comes back from the proxy and ties us to a session
                        // on the Gitana server
                        Gitana.deleteCookie("JSESSIONID", "/");

                        // apply platform cache
                        applyPlatformCache(driver, platform);

                        // now continue the platform chain after we reload
                        platform.reload();
                        platform.next();

                    }, function(http) {

                        // if authentication fails, respond to custom auth failure handler
                        if (authFailureHandler)
                        {
                            authFailureHandler.call(platform, http);
                        }

                    });
                }

                //
                // authenticate via password flow
                //
                else if (config.username)
                {
                    // clear existing cookie and ticket
                    config.authorizationFlow = Gitana.OAuth2Http.PASSWORD;
                    driver.resetHttp(config);
                    Gitana.deleteCookie("GITANA_TICKET", "/");

                    // retrieve auth info and plug into the driver
                    driver.gitanaGet("/auth/info", authInfoParams, {}, function(response) {
                        var authInfo = new Gitana.AuthInfo(response);
                        driver.setAuthInfo(authInfo);

                        // TODO: fix this
                        // kill the JSESSIONID cookie which comes back from the proxy and ties us to a session
                        // on the Gitana server
                        Gitana.deleteCookie("JSESSIONID", "/");

                        // apply platform cache
                        applyPlatformCache(driver, platform);

                        // now continue the platform chain after we reload
                        platform.reload();
                        platform.next();

                    }, function(http) {

                        // if authentication fails, respond to custom auth failure handler
                        if (authFailureHandler)
                        {
                            authFailureHandler.call(platform, http);
                        }

                    });
                }

                //
                // authenticate via implicit "token" flow
                //
                else if (config.accessToken)
                {
                    // clear existing cookie and ticket
                    config.authorizationFlow = Gitana.OAuth2Http.TOKEN;
                    driver.resetHttp(config);
                    Gitana.deleteCookie("GITANA_TICKET", "/");

                    // fetch the auth info
                    driver.gitanaGet("/auth/info", authInfoParams, {}, function(response) {

                        var authInfo = new Gitana.AuthInfo(response);
                        driver.setAuthInfo(authInfo);

                        // TODO: fix this
                        // kill the JSESSIONID cookie which comes back from the proxy and ties us to a session
                        // on the Gitana server
                        Gitana.deleteCookie("JSESSIONID", "/");

                        // apply platform cache
                        applyPlatformCache(driver, platform);

                        // now continue the platform chain after we reload
                        platform.reload();
                        platform.next();

                    }, function(http) {

                        // if authentication fails, respond to custom auth failure handler
                        if (authFailureHandler)
                        {
                            authFailureHandler.call(platform, http);
                        }

                    });
                }

                //
                // authenticate using an existing cookie
                //
                else if (config.cookie)
                {
                    // reuse an existing cookie (token flow)
                    config.authorizationFlow = Gitana.OAuth2Http.COOKIE;
                    driver.resetHttp(config);

                    // fetch the auth info
                    driver.gitanaGet("/auth/info", authInfoParams, {}, function(response) {

                        var authInfo = new Gitana.AuthInfo(response);
                        driver.setAuthInfo(authInfo);

                        // TODO: fix this
                        // kill the JSESSIONID cookie which comes back from the proxy and ties us to a session
                        // on the Gitana server
                        Gitana.deleteCookie("JSESSIONID", "/");

                        // apply platform cache
                        applyPlatformCache(driver, platform);

                        // now continue the platform chain after we reload
                        platform.reload();
                        platform.next();

                    }, function(http) {

                        // if authentication fails, respond to custom auth failure handler
                        if (authFailureHandler)
                        {
                            authFailureHandler.call(platform, http);
                        }

                    });

                }

                //
                // authenticate using an explicit gitana ticket
                //
                else if (config.ticket)
                {
                    // reuse an existing cookie (token flow)
                    config.authorizationFlow = Gitana.OAuth2Http.TICKET;
                    driver.resetHttp(config);

                    var headers = {
                        "GITANA_TICKET": config.ticket
                    };

                    // fetch the auth info
                    driver.gitanaGet("/auth/info", authInfoParams, headers, function(response) {

                        var authInfo = new Gitana.AuthInfo(response);
                        driver.setAuthInfo(authInfo);

                        // TODO: fix this
                        // kill the JSESSIONID cookie which comes back from the proxy and ties us to a session
                        // on the Gitana server
                        Gitana.deleteCookie("JSESSIONID", "/");

                        // apply platform cache
                        applyPlatformCache(driver, platform);

                        // now continue the platform chain after we reload
                        platform.reload();
                        platform.next();

                    }, function(http) {

                        // if authentication fails, respond to custom auth failure handler
                        if (authFailureHandler)
                        {
                            authFailureHandler.call(platform, http);
                        }

                    });

                }
                else
                {
                    var message = "Unsupported authentication flow - you must provide either a username, authorization code, access token or select cookie-based authentication";

                    if (authFailureHandler)
                    {
                        authFailureHandler.call(platform, {
                            "message": message
                        });
                    }
                    else
                    {
                        throw new Error(message);
                    }
                }
            };

            // run with this = platform
            var doAutoConfig = function(uri, callback)
            {
                var platform = this;

                // call over to gitana and request auto configuration
                new Gitana.Http().request({
                    "url": "/proxy/pub/driver?uri=" + Gitana.Http.URLEncode(uri),
                    "success": function(response)
                    {
                        var config = JSON.parse(response.text);
                        if (config.clientKey)
                        {
                            var options = {
                                "clientKey": config.clientKey
                            };
                            platform.getDriver().updateOptions(options);

                            var stackInfo = {};
                            if (config.stackId)
                            {
                                stackInfo.id = config.stackId;
                            }
                            if (config.stackDataStores)
                            {
                                stackInfo.datastores = config.stackDataStores;
                            }
                            platform.getDriver().setStackInfo(stackInfo);

                            var applicationInfo = {};
                            if (config.applicationId)
                            {
                                applicationInfo.id = config.applicationId;
                            }
                            platform.getDriver().setApplicationInfo(applicationInfo);
                        }

                        if (callback)
                        {
                            callback.call(platform);
                        }
                    }
                });
            };

            var result = this.getFactory().platform(cluster);
            return Chain(result).then(function() {

                // NOTE: this = platform
                var platform = this;

                if (Gitana.autoConfigUri)
                {
                    doAutoConfig.call(platform, Gitana.autoConfigUri, function() {
                        doAuthenticate.call(platform);
                    });
                }
                else
                {
                    doAuthenticate.call(platform);
                }

                // tell the chain that we'll manually handle calling next()
                return false;
            });
        },

        /**
         * Clears any authentication for the driver.
         */
        clearAuthentication: function()
        {
            if (this.http.clearStorage)
            {
                this.http.clearStorage();
            }

            this.resetHttp();
            Gitana.deleteCookie("GITANA_TICKET", "/");
        },

        /**
         * Refreshes the authentication access token.
         *
         * @param callback
         */
        refreshAuthentication: function(callback)
        {
            this.http.refresh(function(err) {
                callback(err);
            });
        },

        /**
         * Destructor function, called at the end of the driver instance's lifecycle
         */
        destroy: function()
        {
            this.clearAuthentication();
        }

    });


    //
    // STATICS
    // Special Groups

    Gitana.EVERYONE = {
        "name": "everyone",
        "type": "GROUP"
    };

    // temporary location for this code
    Gitana.toCopyDependencyChain = function(typedID)
    {
        var array = [];

        if (typedID.getType() == "node")
        {
            array = array.concat(Gitana.toCopyDependencyChain(typedID.getBranch()));
        }
        if (typedID.getType() == "association")
        {
            array = array.concat(Gitana.toCopyDependencyChain(typedID.getBranch()));
        }
        else if (typedID.getType() == "branch")
        {
            array = array.concat(Gitana.toCopyDependencyChain(typedID.getRepository()));
        }
        else if (typedID.getType() == "platform")
        {
            // nothing to do here
        }
        else if (typedID.getType() == "stack")
        {
            array = array.concat(Gitana.toCopyDependencyChain(typedID.getPlatform()));
        }
        else if (typedID.getType() == "project")
        {
            array = array.concat(Gitana.toCopyDependencyChain(typedID.getPlatform()));
        }
        else
        {
            array = array.concat(Gitana.toCopyDependencyChain(typedID.getPlatform()));
        }

        array.push(Gitana.toDependencyObject(typedID));

        return array;
    };

    Gitana.toDependencyObject = function(typedID)
    {
        return {
            "typeId": typedID.getType(),
            "id": typedID.getId()
        };
    };

    Gitana.TypedIDConstants = {};
    Gitana.TypedIDConstants.TYPE_APPLICATION = "application";
    Gitana.TypedIDConstants.TYPE_EMAIL = "email";
    Gitana.TypedIDConstants.TYPE_EMAIL_PROVIDER = "emailprovider";
    Gitana.TypedIDConstants.TYPE_REGISTRATION = "registration";
    Gitana.TypedIDConstants.TYPE_SETTINGS = "settings";

    // cluster
    Gitana.TypedIDConstants.TYPE_CLUSTER = "cluster";
    Gitana.TypedIDConstants.TYPE_JOB = "job";
    Gitana.TypedIDConstants.TYPE_LOG_ENTRY = "logEntry";

    // directory
    Gitana.TypedIDConstants.TYPE_DIRECTORY = "directory";
    Gitana.TypedIDConstants.TYPE_IDENTITY = "identity";
    Gitana.TypedIDConstants.TYPE_CONNECTION = "connection";

    // domain
    Gitana.TypedIDConstants.TYPE_DOMAIN = "domain";
    Gitana.TypedIDConstants.TYPE_DOMAIN_GROUP = "group";
    Gitana.TypedIDConstants.TYPE_DOMAIN_USER = "user";

    // platform
    Gitana.TypedIDConstants.TYPE_PLATFORM = "platform";
    Gitana.TypedIDConstants.TYPE_AUTHENTICATION_GRANT = "authenticationGrant";
    Gitana.TypedIDConstants.TYPE_BILLING_PROVIDERS_CONFIGURATION = "billingProviderConfiguration";
    Gitana.TypedIDConstants.TYPE_CLIENT = "client";
    Gitana.TypedIDConstants.TYPE_STACK = "stack";
    Gitana.TypedIDConstants.TYPE_PROJECT = "project";

    // registrar
    Gitana.TypedIDConstants.TYPE_REGISTRAR = "registrar";
    Gitana.TypedIDConstants.TYPE_METER = "meter";
    Gitana.TypedIDConstants.TYPE_PLAN = "plan";
    Gitana.TypedIDConstants.TYPE_TENANT = "tenant";

    // repository
    Gitana.TypedIDConstants.TYPE_REPOSITORY = "repository";
    Gitana.TypedIDConstants.TYPE_ASSOCIATION = "association";
    Gitana.TypedIDConstants.TYPE_BRANCH = "branch";
    Gitana.TypedIDConstants.TYPE_CHANGESET = "changeset";
    Gitana.TypedIDConstants.TYPE_NODE = "node";

    // vault
    Gitana.TypedIDConstants.TYPE_VAULT = "vault";
    Gitana.TypedIDConstants.TYPE_ARCHIVE = "archive";

    // warehouse
    Gitana.TypedIDConstants.TYPE_WAREHOUSE = "warehouse";
    Gitana.TypedIDConstants.TYPE_INTERACTION = "interaction";
    Gitana.TypedIDConstants.TYPE_INTERACTION_APPLICATION = "interactionApplication";
    Gitana.TypedIDConstants.TYPE_INTERACTION_NODE = "interactionNode";
    Gitana.TypedIDConstants.TYPE_INTERACTION_PAGE = "interactionPage";
    Gitana.TypedIDConstants.TYPE_INTERACTION_REPORT = "interactionReport";
    Gitana.TypedIDConstants.TYPE_INTERACTION_REPORT_ENTRY = "interactionReportEntry";
    Gitana.TypedIDConstants.TYPE_INTERACTION_SESSION = "interactionSession";
    Gitana.TypedIDConstants.TYPE_INTERACTION_USER = "interactionUser";

    Gitana.TypedIDConstants.TYPE_INTERACTION_CONTINENT = "interactionContinent";
    Gitana.TypedIDConstants.TYPE_INTERACTION_COUNTRY = "interactionCountry";
    Gitana.TypedIDConstants.TYPE_INTERACTION_CITY = "interactionCity";
    Gitana.TypedIDConstants.TYPE_INTERACTION_REGION = "interactionRegion";
    Gitana.TypedIDConstants.TYPE_INTERACTION_POSTALCODE = "interactionPostalCode";
    Gitana.TypedIDConstants.TYPE_INTERACTION_USERAGENT = "interactionUserAgent";
    Gitana.TypedIDConstants.TYPE_INTERACTION_OPERATINGSYSTEM = "interactionOperatingSystem";
    Gitana.TypedIDConstants.TYPE_INTERACTION_DEVICE = "interactionDevice";

    // web host
    Gitana.TypedIDConstants.TYPE_WEB_HOST = "webhost";
    Gitana.TypedIDConstants.TYPE_AUTO_CLIENT_MAPPING = "autoClientMapping";
    Gitana.TypedIDConstants.TYPE_TRUSTED_DOMAIN_MAPPING = "trustedDomainMapping";
    Gitana.TypedIDConstants.TYPE_DEPLOYED_APPLICATION = "deployedApplication";

    Gitana.handleJobCompletion = function(chain, cluster, jobId, synchronous)
    {
        var jobFinalizer = function() {

            return Chain(cluster).readJob(jobId).then(function() {

                if (!synchronous || (synchronous && (this.getState() == "FINISHED" || this.getState() == "ERROR")))
                {
                    chain.loadFrom(this);
                    chain.next();
                }
                else
                {
                    // reset timeout
                    window.setTimeout(jobFinalizer, 250);
                }

            });
        };

        // set timeout
        window.setTimeout(jobFinalizer, 250);
    };

    /** Extension point for loading default config for server-side containers **/
    Gitana.loadDefaultConfig = function()
    {
    };

    /**
     * Simple in-memory cache implementation for use by-default by the driver.
     *
     * @return {Function}
     * @constructor
     */
    Gitana.MemoryCache = function()
    {
        var cache = {};

        return function(k, v)
        {
            if (!Gitana.isUndefined(v)) {
                if (v) {
                    cache[k] = v;
                }
                else {
                    delete cache[k];
                }
            }

            // support for "clear" method - removes everything from cache
            if (k == "clear")
            {
                var za = [];
                for (var z in cache)
                {
                    za.push(z);
                }
                for (var i = 0; i < za.length; i++)
                {
                    delete cache[za[i]];
                }
            }

            return cache[k];
        };
    };


    /////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // PLATFORM CACHE
    //
    //

    // extension point - override with other implementations
    Gitana.PLATFORM_CACHE = Gitana.MemoryCache();

    Gitana.determinePlatformCacheKey = function(config, fallbackToDefault)
    {
        var cacheKey = null;

        // "ticket" authentication - key = ticket
        if (config.ticket) {
            cacheKey = config.ticket;
        }
        else if (config.clientKey && config.username) {
            cacheKey = config.clientKey + ":" + config.username;
        }
        else if (fallbackToDefault)
        {
            // if no config provided, use "default" key
            cacheKey = "default";
        }

        return cacheKey;
    };

    /**
     * Connects to a Gitana platform.
     *
     * @param config
     * @param [callback] optional callback function that gets called once the server has been connected to.  If no
     *                   "application" config parameter is present, then the callback function is called with the this
     *                   context set to the platform.  If an "application" config parameter is present, then the stack
     *                   for the application is loaded and references are resolved and the this context will be the
     *                   app helper instance.  This callback also acts as an error handler for any authentication issues.
     *                   If an auth error happens, the err is passed to the callback as the first and only argument.
     *
     * @return {*}
     */
    Gitana.connect = function(config, callback)
    {
        // allow for no config, callback-only
        if (Gitana.isFunction(config)) {
            callback = config;
            config = null;
        }

        var missingConfig = false;

        if (!config) {
            config = {};
            missingConfig = true;
        }

        if (Gitana.isString(config)) {
            config = {"key": config};
        }

        // by default, set invalidatePlatformCache to false
        if (typeof(config.invalidatePlatformCache) == "undefined")
        {
            config.invalidatePlatformCache = false;
        }

        // if no config key specified, we can generate one...
        if (!config.key)
        {
            config.key = Gitana.determinePlatformCacheKey(config, missingConfig);
        }

        // default to load app helper if not defined
        if (typeof(config.loadAppHelper) == "undefined")
        {
            config.loadAppHelper = true;
        }

        // this gets called once the platform is drawn from cache or created
        // fires the callback and passes in the platform or the app helper
        var setupContext = function(platformCacheKey)
        {
            // NOTE: this == platform

            // if their configuration contains the "application" setting, then auto-load the app() context
            // note that config.application could be undefined (we require explicit NULL here for copyKeepers)
            if (config.loadAppHelper)
            {
                var appConfig = {
                    "application": (config.application ? config.application: null)
                };
                Gitana.copyKeepers(appConfig, Gitana.loadDefaultConfig());
                Gitana.copyKeepers(appConfig, this.getDriver().getOriginalConfiguration());
                if (appConfig.application) {

                    var appSettings = {
                        "application": appConfig.application
                    };
                    if (platformCacheKey) {
                        appSettings.appCacheKey = platformCacheKey + "_" + appConfig.application;
                    }
                    this.app(appSettings, function(err) {
                        if (callback) {
                            // NOTE: this == app helper
                            callback.call(this, err);
                        }
                    });
                }
                else {
                    if (callback) {
                        callback.call(this);
                    }
                }
            }
            else
            {
                if (callback) {
                    callback.call(this);
                }
            }
        };

        // support for invalidatePlatformCache
        if (config.key && config.invalidatePlatformCache)
        {
            Gitana.disconnect(config.key);
        }

        // either retrieve platform from cache or authenticate
        var platform = null;
        if (config.key) {
            platform = Gitana.PLATFORM_CACHE(config.key);
        }
        if (platform)
        {
            // platform already loaded

            // spawn off a new copy for thread safety
            platform = Chain(new Gitana.Platform(platform.getCluster(), platform));
            setupContext.call(platform, config.key);
            return platform;
        }

        // if they didn't provide a config and made it this far, then lets assume a cookie based config?
        if (missingConfig)
        {
            config["cookie"] = true;
        }

        // load it up
        return new Gitana(config).authenticate(config, function(err) {

            if (callback) {
                callback.call(this, err);
            }

        }).then(function() {

            // NOTE: this == platform

            setupContext.call(this, config.key);

        });
    };

    /**
     * Disconnects a platform from the cache.
     *
     * @param key
     */
    Gitana.disconnect = function(key)
    {
        if (!key) {
            key = "default";
        }

        var platform = Gitana.PLATFORM_CACHE(key);
        if (platform)
        {
            var badKeys = [];
            for (var k in Gitana.APPS)
            {
                if (k.indexOf(key + "_") == 0)
                {
                    badKeys.push(k);
                }
            }
            for (var i = 0; i < badKeys.length; i++)
            {
                delete Gitana.APPS[badKeys[i]];
            }

            var ticket = platform.getDriver().getAuthInfo().getTicket();
            if (ticket)
            {
                Gitana.PLATFORM_CACHE(ticket, null);
            }

            Gitana.PLATFORM_CACHE(key, null);

            platform.getDriver().destroy();
        }
    };

    // holds a total count of Ajax requests originated from the driver
    Gitana.requestCount = 0;

    // version of the driver
    Gitana.VERSION = "1.0.82";

    // allow for optional global assignment
    // TODO: until we clean up the "window" variable reliance, we have to always set onto window again
    // TODO: to support loading within NodeJS
    //if (window && !window.Gitana) {
    if (window) {
        window.Gitana = Gitana;
    }

    /**
     * Resets the driver (used for test purposes).
     */
    Gitana.reset = function()
    {
        Gitana.PLATFORM_CACHE("clear");
        Gitana.deleteCookie("GITANA_TICKET");
    };

    // insertion point for on-load adjustments (cloudcms-net server)
    Gitana.__INSERT_MARKER = null;

})(window);(function(global) {
    Gitana.Error = function () {};
    Gitana.Error.prototype = new Error();
    Gitana.Error.prototype.constructor = Gitana.Error;
}(this));(function(global)
{
    Gitana.Http = Base.extend(
    /** @lends Gitana.Http.prototype */
    {
        /**
         * @constructs
         *
         * @class Gitana.Http
         */
        constructor: function()
        {
            ///////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEDGED METHODS
            //

            this.invoke = function(options)
            {
                var method = options.method || 'GET';
                var url = options.url;
                //var data = options.data || {};
                var data = options.data;
                var headers = options.headers || {};
                var success = options.success || function () {};
                var failure = options.failure || function () {};

                // make sure that all responses come back as JSON if they can (instead of XML)
                //headers["Accept"] = "application/json,*/*;q=0.8";
                headers["Accept"] = "application/json";

                var xhr = Gitana.Http.Request();
                xhr.onreadystatechange = function ()
                {
                    if (xhr.readyState === 4)
                    {
                        var regex = /^(.*?):\s*(.*?)\r?$/mg,
                            requestHeaders = headers,
                            responseHeaders = {},
                            responseHeadersString = '',
                            match;

                        if (!!xhr.getAllResponseHeaders)
                        {
                            responseHeadersString = xhr.getAllResponseHeaders();
                            while((match = regex.exec(responseHeadersString)))
                            {
                                responseHeaders[match[1]] = match[2];
                            }
                        }
                        else if(!!xhr.getResponseHeaders)
                        {
                            responseHeadersString = xhr.getResponseHeaders();
                            for (var i = 0, len = responseHeadersString.length; i < len; ++i)
                            {
                                responseHeaders[responseHeadersString[i][0]] = responseHeadersString[i][1];
                            }
                        }

                        var includeXML = false;
                        if ('Content-Type' in responseHeaders)
                        {
                            if (responseHeaders['Content-Type'] == 'text/xml')
                            {
                                includeXML = true;
                            }

                        }
                        var responseObject = {
                            text: xhr.responseText,
                            xml: (includeXML ? xhr.responseXML : ''),
                            requestHeaders: requestHeaders,
                            responseHeaders: responseHeaders
                        };

                        // handle the response
                        if ((xhr.status >= 200 && xhr.status <= 226) || xhr.status == 304 || xhr.status === 0)
                        {
                            // ok
                            success(responseObject, xhr);
                        }
                        else if (xhr.status >= 400 && xhr.status !== 0)
                        {
                            // everything what is 400 and above is a failure code
                            failure(responseObject, xhr);
                        }
                        else if (xhr.status >= 300 && xhr.status <= 303)
                        {
                            // some kind of redirect, probably to a login server
                            // indicates missing access token?
                            failure(responseObject, xhr);
                        }
                    }
                };

                xhr.open(method, url, true);
                xhr.timeout = 120000; // long, 2 minutes

                xhr.setRequestHeader('X-Requested-With','XMLHttpRequest');
                for (var header in headers)
                {
                    xhr.setRequestHeader(header, headers[header]);
                }

                try
                {
                    xhr.send(data);
                }
                catch (e)
                {
                    console.log(e);
                }
            };
        },

        /**
         * Performs an HTTP call.
         *
         * @param options
         */
        request: function(options)
        {
            return this.invoke(options);
        }
    });

    Gitana.Http.Request = function()
    {
        var XHR;

        if (typeof global.Titanium !== 'undefined' && typeof global.Titanium.Network.createHTTPClient != 'undefined')
        {
            XHR = global.Titanium.Network.createHTTPClient();
        }
        else if (typeof require !== 'undefined')
        {
            // CommonJS require
            try
            {
                var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
                XHR = new XMLHttpRequest();
            }
            catch (e)
            {
               XHR = new global.XMLHttpRequest();
            }
        }
        else
        {
            // W3C
            XHR = new global.XMLHttpRequest();
        }

        return XHR;
    };

    var Hash = function() {};
    Hash.prototype =
    {
        join: function(string)
        {
            string = string || '';
            return this.values().join(string);
        },

        keys: function()
        {
            var i, arr = [], self = this;
            for (i in self) {
                if (self.hasOwnProperty(i)) {
                    arr.push(i);
                }
            }

            return arr;
        },

        values: function()
        {
            var i, arr = [], self = this;
            for (i in self) {
                if (self.hasOwnProperty(i)) {
                    arr.push(self[i]);
                }
            }

            return arr;
        },
        shift: function(){throw 'not implemented';},
        unshift: function(){throw 'not implemented';},
        push: function(){throw 'not implemented';},
        pop: function(){throw 'not implemented';},
        sort: function(){throw 'not implemented';},

        ksort: function(func){
            var self = this, keys = self.keys(), i, value, key;

            if (func == undefined) {
                keys.sort();
            } else {
                keys.sort(func);
            }

            for (i = 0; i  < keys.length; i++) {
                key = keys[i];
                value = self[key];
                delete self[key];
                self[key] = value;
            }

            return self;
        },
        toObject: function () {
            var obj = {}, i, self = this;
            for (i in self) {
                if (self.hasOwnProperty(i)) {
                    obj[i] = self[i];
                }
            }

            return obj;
        }
    };

    var Collection = function(obj)
    {
        var args = arguments, args_callee = args.callee, args_length = args.length,
            i, collection = this;

        if (!(this instanceof args_callee)) {
            return new args_callee(obj);
        }

        for(i in obj) {
            if (obj.hasOwnProperty(i)) {
                collection[i] = obj[i];
            }
        }

        return collection;
    };
    Collection.prototype = new Hash();

    Gitana.Http.URI = function(url)
    {
        var args = arguments, args_callee = args.callee,
            parsed_uri, scheme, host, port, path, query, anchor,
            parser = /^([^:\/?#]+?:\/\/)*([^\/:?#]*)?(:[^\/?#]*)*([^?#]*)(\?[^#]*)?(#(.*))*/,
            uri = this;

        if (!(this instanceof args_callee))
        {
            return new args_callee(url);
        }

        uri.scheme = '';
        uri.host = '';
        uri.port = '';
        uri.path = '';
        uri.query = new Gitana.Http.QueryString();
        uri.anchor = '';

        if (url !== null)
        {
            parsed_uri = url.match(parser);

            scheme = parsed_uri[1];
            host = parsed_uri[2];
            port = parsed_uri[3];
            path = parsed_uri[4];
            query = parsed_uri[5];
            anchor = parsed_uri[6];

            scheme = (scheme !== undefined) ? scheme.replace('://', '').toLowerCase() : 'http';
            port = (port ? port.replace(':', '') : (scheme === 'https' ? '443' : '80'));
            // correct the scheme based on port number
            scheme = (scheme == 'http' && port === '443' ? 'https' : scheme);
            query = query ? query.replace('?', '') : '';
            anchor = anchor ? anchor.replace('#', '') : '';


            // Fix the host name to include port if non-standard ports were given
            if ((scheme === 'https' && port !== '443') || (scheme === 'http' && port !== '80')) {
                host = host + ':' + port;
            }

            uri.scheme = scheme;
            uri.host = host;
            uri.port = port;
            uri.path = path || '/';
            uri.query.setQueryParams(query);
            uri.anchor = anchor || '';
        }
    };

    Gitana.Http.URI.prototype = {
        scheme: '',
        host: '',
        port: '',
        path: '',
        query: '',
        anchor: '',
        toString: function () {
            var self = this, query = self.query + '';
            return self.scheme + '://' + self.host + self.path + (query != '' ? '?' + query : '') + (self.anchor !== '' ? '#' + self.anchor : '');
        }
    };

    Gitana.Http.QueryString = function(obj)
    {
        var args = arguments, args_callee = args.callee, args_length = args.length,
            i, querystring = this;

        if (!(this instanceof args_callee)) {
            return new args_callee(obj);
        }

        if (obj != undefined) {
            for (i in obj) {
                if (obj.hasOwnProperty(i)) {
                    querystring[i] = obj[i];
                }
            }
        }

        return querystring;
    };

    // QueryString is a type of collection So inherit
    Gitana.Http.QueryString.prototype = new Collection();

    Gitana.Http.QueryString.prototype.toString = function ()
    {
        var i, self = this, q_arr = [], ret = '',
            val = '', encode = Gitana.Http.URLEncode;
        self.ksort(); // lexicographical byte value ordering of the keys

        for (i in self) {
            if (self.hasOwnProperty(i)) {
                if (i != undefined && self[i] != undefined) {
                    val = encode(i) + '=' + encode(self[i]);
                    q_arr.push(val);
                }
            }
        }

        if (q_arr.length > 0) {
            ret = q_arr.join('&');
        }

        return ret;
    };

    Gitana.Http.QueryString.prototype.setQueryParams = function (query)
    {
        var args = arguments, args_length = args.length, i, query_array,
            query_array_length, querystring = this, key_value;

        if (args_length == 1) {
            if (typeof query === 'object') {
                // iterate
                for (i in query) {
                    if (query.hasOwnProperty(i)) {
                        querystring[i] = query[i];
                    }
                }
            } else if (typeof query === 'string') {
                // split string on '&'
                query_array = query.split('&');
                // iterate over each of the array items
                for (i = 0, query_array_length = query_array.length; i < query_array_length; i++) {
                    // split on '=' to get key, value
                    key_value = query_array[i].split('=');
                    querystring[key_value[0]] = key_value[1];
                }
            }
        } else {
            for (i = 0; i < arg_length; i += 2) {
                // treat each arg as key, then value
                querystring[args[i]] = args[i+1];
            }
        }
    };

    Gitana.Http.URLEncode = function(string)
    {
        function hex(code) {
            var hex = code.toString(16).toUpperCase();
            if (hex.length < 2) {
                hex = 0 + hex;
            }
            return '%' + hex;
        }

        if (!string) {
            return '';
        }

        string = string + '';
        var reserved_chars = /[ \r\n!*"'();:@&=+$,\/?%#\[\]<>{}|`^\\\u0080-\uffff]/,
            str_len = string.length, i, string_arr = string.split(''), c;

        for (i = 0; i < str_len; i++)
        {
            c = string_arr[i].match(reserved_chars);
            if (c)
            {
                c = c[0].charCodeAt(0);

                if (c < 128) {
                    string_arr[i] = hex(c);
                } else if (c < 2048) {
                    string_arr[i] = hex(192+(c>>6)) + hex(128+(c&63));
                } else if (c < 65536) {
                    string_arr[i] = hex(224+(c>>12)) + hex(128+((c>>6)&63)) + hex(128+(c&63));
                } else if (c < 2097152) {
                    string_arr[i] = hex(240+(c>>18)) + hex(128+((c>>12)&63)) + hex(128+((c>>6)&63)) + hex(128+(c&63));
                }
            }
        }

        return string_arr.join('');
    };

    Gitana.Http.URLDecode = function (string)
    {
        if (!string)
        {
            return '';
        }

        return string.replace(/%[a-fA-F0-9]{2}/ig, function (match) {
            return String.fromCharCode(parseInt(match.replace('%', ''), 16));
        });
    };

}(this));
(function(global)
{
    Gitana.OAuth2Http = Gitana.Http.extend(
    /** @lends Gitana.OAuth2Http.prototype */
    {
        /**
         * @constructs
         *
         * @class Gitana.OAuth2Http
         */
        constructor: function(options, storage)
        {
            var self = this;

            // storage for OAuth credentials
            // this can either be a string ("local", "session", "memory") or a storage instance or empty
            // if empty, memory-based storage is assumed
            if (storage === null || typeof(storage) === "string")
            {
                storage = new Gitana.OAuth2Http.Storage(storage);
            }

            // cookie mode
            this.cookieMode = null;

            // ticket mode
            this.ticketMode = null;

            // preset the error state
            this.error = null;
            this.errorDescription = null;
            this.errorUri = null;

            // gitana urls
            var tokenURL = "/oauth/token";
            if (options.tokenURL)
            {
                tokenURL = options.tokenURL;
            }

            // base URL?
            var baseURL = null;
            if (options.baseURL)
            {
                baseURL = options.baseURL;
            }

            // client
            var clientKey = options.clientKey;
            var clientSecret = options.clientSecret;

            // authorization flow
            // if none specified, assume CODE
            this.authorizationFlow = options.authorizationFlow || Gitana.OAuth2Http.AUTHORIZATION_CODE;

            // optional
            if (options.requestedScope)
            {
                this.requestedScope = options.requestedScope;
            }

            if (this.authorizationFlow == Gitana.OAuth2Http.AUTHORIZATION_CODE)
            {
                this.code = options.code;
                this.redirectUri = options.redirectUri;
            }

            if (this.authorizationFlow == Gitana.OAuth2Http.PASSWORD)
            {
                this.username = options.username;

                if (options.password)
                {
                    this.password = options.password;
                }
                else
                {
                    this.password = "";
                }
            }

            if (this.authorizationFlow == Gitana.OAuth2Http.COOKIE)
            {
                this.cookieMode = true;
            }

            if (this.authorizationFlow == Gitana.OAuth2Http.TICKET)
            {
                this.ticketMode = options.ticket;
            }


            ////////////////////////////////////////////////////////////////////////////////////////////////
            //
            // ACCESSORS
            //
            ////////////////////////////////////////////////////////////////////////////////////////////////

            /**
             * Clears persisted storage of auth data
             */
            this.clearStorage = function()
            {
                storage.clear();
            };

            /**
             * Gets or saves the access token
             *
             * @param value [String] optional value
             */
            this.accessToken = function(value)
            {
                return storage.poke("accessToken", value);
            };

            /**
             * Gets or saves the refresh token
             *
             * @param value [String] optional value
             */
            this.refreshToken = function(value)
            {
                return storage.poke("refreshToken", value);
            };

            /**
             * Gets or saves the granted scope
             *
             * @param value [String] optional value
             */
            this.grantedScope = function(value)
            {
                return storage.poke("grantedScope", value);
            };

            /**
             * Gets or saves the expires in value
             *
             * @param value [String] optional value
             */
            this.expiresIn = function(value)
            {
                return storage.poke("expiresIn", value);
            };

            /**
             * Gets or saves the grant time
             *
             * @param value [String] optional value
             */
            this.grantTime = function(value)
            {
                return storage.poke("grantTime", value);
            };

            this.getClientAuthorizationHeader = function() {

                var basicString = clientKey + ":";
                if (clientSecret)
                {
                    basicString += clientSecret;
                }
                return "Basic " + Gitana.btoa(basicString);
            };

            this.getBearerAuthorizationHeader = function()
            {
                return "Bearer " + self.accessToken();
            };

            this.getPrefixedTokenURL = function()
            {
                return this.getPrefixedURL(tokenURL);
            };

            this.getPrefixedURL = function(url)
            {
                var rebasedURL = url;
                if (baseURL && Gitana.startsWith(url, "/"))
                {
                    rebasedURL = baseURL + url;
                }

                return rebasedURL;
            };


            // if they initiatialized with an access token, clear and write into persisted state
            // unless they're continuing an existing token
            if (this.authorizationFlow == Gitana.OAuth2Http.TOKEN)
            {
                var existingAccessToken = this.accessToken();
                if (existingAccessToken != options.accessToken)
                {
                    storage.clear();
                }

                this.accessToken(existingAccessToken);
            }

            this.base();
        },

        /**
         * Performs an HTTP call using OAuth2.
         *
         * @param options
         */
        request: function(options)
        {
            var self = this;

            /**
             * Call over to Gitana and acquires an access token using flow authorization.
             *
             * @param success
             * @param failure
             */
            var doGetAccessToken = function(success, failure)
            {
                var onSuccess = function(response)
                {
                    var object = JSON.parse(response.text);
                    if (response["error"])
                    {
                        self.error = object["error"];
                        self.errorDescription = object["error_description"];
                        self.errorUri = object["error_uri"];
                    }
                    else
                    {
                        var _accessToken = object["access_token"];
                        var _refreshToken = object["refresh_token"];
                        var _expiresIn = object["expires_in"];
                        var _grantedScope = object["scope"];
                        var _grantTime = new Date().getTime();

                        // store into persistent storage
                        self.clearStorage();
                        self.accessToken(_accessToken);
                        self.refreshToken(_refreshToken);
                        self.expiresIn(_expiresIn);
                        self.grantedScope(_grantedScope);
                        self.grantTime(_grantTime);
                    }

                    success();
                };

                var o = {
                    success: onSuccess,
                    failure: failure,
                    headers: {
                        "Authorization": self.getClientAuthorizationHeader()
                    },
                    url: self.getPrefixedTokenURL()
                };

                var queryString = "grant_type=" + Gitana.Http.URLEncode(self.authorizationFlow);
                if (self.requestedScope)
                {
                    queryString += "&scope=" + Gitana.Http.URLEncode(self.requestedScope);
                }

                // separate configurations per flow
                if (self.authorizationFlow == Gitana.OAuth2Http.AUTHORIZATION_CODE)
                {
                    queryString += "&code=" + Gitana.Http.URLEncode(self.code);
                    if (self.redirectUri)
                    {
                        queryString += "&redirect_uri=" + Gitana.Http.URLEncode(self.redirectUri);
                    }
                }
                else if (self.authorizationFlow == Gitana.OAuth2Http.PASSWORD)
                {
                    queryString += "&username=" + Gitana.Http.URLEncode(self.username);
                    if (self.password)
                    {
                        queryString += "&password=" + Gitana.Http.URLEncode(self.password);
                    }
                }

                // append into query string
                if (o.url.indexOf("?") > -1)
                {
                    o.url = o.url + "&" + queryString;
                }
                else
                {
                    o.url = o.url + "?" + queryString;
                }

                self.invoke(o);
            };

            /**
             * Calls over to Gitana and acquires an access token using an existing refresh token.
             *
             * @param success
             * @param failure
             */
            var doRefreshAccessToken = function(success, failure)
            {
                var onSuccess = function(response)
                {
                    var object = JSON.parse(response.text);
                    if (response["error"])
                    {
                        self.error = object["error"];
                        self.errorDescription = object["error_description"];
                        self.errorUri = object["error_uri"];
                    }
                    else
                    {
                        var _accessToken = object["access_token"];
                        var _refreshToken = object["refresh_token"];
                        var _expiresIn = object["expires_in"];
                        //self.grantedScope = object["scope"]; // this doesn't come back on refresh, assumed the same
                        var _grantTime = new Date().getTime();
                        var _grantedScope = self.grantedScope();

                        // store into persistent storage
                        self.clearStorage();
                        self.accessToken(_accessToken);
                        self.refreshToken(_refreshToken);
                        self.expiresIn(_expiresIn);
                        self.grantedScope(_grantedScope);
                        self.grantTime(_grantTime);
                    }

                    success();
                };

                var o = {
                    success: onSuccess,
                    failure: failure,
                    headers: {
                        "Authorization": self.getClientAuthorizationHeader()
                    },
                    url: self.getPrefixedTokenURL()
                };

                var queryString = "grant_type=refresh_token&refresh_token=" + self.refreshToken();
                if (self.requestedScope)
                {
                    queryString += "&scope=" + Gitana.Http.URLEncode(self.requestedScope);
                }

                // append into query string
                if (o.url.indexOf("?") > -1)
                {
                    o.url = o.url + "&" + queryString;
                }
                else
                {
                    o.url = o.url + "?" + queryString;
                }

                self.invoke(o);
            };

            var doCall = function(autoAttemptRefresh)
            {
                var successHandler = function(response)
                {
                    options.success(response);
                };

                var failureHandler = function(http, xhr)
                {
                    if (autoAttemptRefresh)
                    {
                        // there are a few good reasons why this might naturally fail
                        //
                        // 1.  our access token is invalid, has expired or has been forcefully invalidated on the Cloud CMS server
                        //     in this case, we get back a 200 and something like http.text =
                        //     {"error":"invalid_token","error_description":"Invalid access token: blahblahblah"}
                        //
                        // 2.  the access token no longer permits access to the resource
                        //     in this case, we get back a 401
                        //     it might not make much sense to re-request a new access token, but we do just in case.

                        var isInvalidToken = false;
                        if (http.text) {
                            var responseData = JSON.parse(http.text);
                            if (responseData.error)
                            {
                                if (responseData.error == "invalid_token")
                                {
                                    isInvalidToken = true;
                                }
                            }
                        }
                        var is401 = (http.code == 401);
                        var is400 = (http.code == 400);
                        var is403 = (http.code == 403);

                        // handle both cases
                        if (is401 || is400 || is403 || isInvalidToken)
                        {
                            if (self.refreshToken())
                            {
                                // use the refresh token to acquire a new access token
                                doRefreshAccessToken(function() {

                                    // success, got a new access token

                                    doCall(false);

                                }, function() {

                                    // failure, nothing else we can do
                                    // call into intended failure handler with the original failure http object
                                    options.failure(http, xhr);
                                });
                            }
                            else
                            {
                                // fail case - nothing we can do
                                options.failure(http, xhr);
                            }
                        }
                        else
                        {
                            // some other kind of error
                            options.failure(http, xhr);
                        }
                    }
                    else
                    {
                        // we aren't allowed to automatically attempt to get a new token via refresh token
                        options.failure(http, xhr);
                    }
                };

                // call through to the protected resource (with custom success/failure handling)
                var o = {};
                Gitana.copyInto(o, options);
                o.success = successHandler;
                o.failure = failureHandler;
                if (!o.headers)
                {
                    o.headers = {};
                }
                if (!self.cookieMode && !self.ticketMode)
                {
                    o.headers["Authorization"] = self.getBearerAuthorizationHeader();
                }
                if (self.ticketMode)
                {
                    o.headers["GITANA_TICKET"] = encodeURIComponent(self.ticketMode);
                }
                o.url = self.getPrefixedURL(o.url);

                // make the call
                self.invoke(o);
            };


            // if no access token, request one
            if (!self.accessToken() && !this.cookieMode && !this.ticketMode)
            {
                if (!self.refreshToken())
                {
                    // no refresh token, do an authorization call
                    doGetAccessToken(function() {

                        // got an access token, so proceed
                        doCall(true);

                    }, function(http, xhr) {

                        // access denied
                        options.failure(http, xhr);

                    });
                }
                else
                {
                    // we have a refresh token, so do a refresh call
                    doRefreshAccessToken(function() {

                        // got an access token, so proceed
                        doCall(true);

                    }, function(http, xhr) {

                        // unable to get an access token
                        options.failure(http, xhr);

                    });
                }
            }
            else
            {
                // we already have an access token
                doCall(true);
            }
        },

        /**
         * Refreshes the OAuth2 access token.
         */
        refresh: function(callback)
        {
            var self = this;

            var onSuccess = function(response)
            {
                var object = JSON.parse(response.text);
                if (response["error"])
                {
                    self.error = object["error"];
                    self.errorDescription = object["error_description"];
                    self.errorUri = object["error_uri"];

                    callback({
                        "error": self.error,
                        "message": self.errorDescription
                    });
                }
                else
                {
                    var _accessToken = object["access_token"];
                    var _refreshToken = object["refresh_token"];
                    var _expiresIn = object["expires_in"];
                    //self.grantedScope = object["scope"]; // this doesn't come back on refresh, assumed the same
                    var _grantTime = new Date().getTime();
                    var _grantedScope = self.grantedScope();

                    // store into persistent storage
                    self.clearStorage();
                    self.accessToken(_accessToken);
                    self.refreshToken(_refreshToken);
                    self.expiresIn(_expiresIn);
                    self.grantedScope(_grantedScope);
                    self.grantTime(_grantTime);

                    callback();
                }
            };

            var onFailure = function(http, xhr)
            {
                callback({
                    "message": "Unable to refresh access token"
                });
            };

            var o = {
                success: onSuccess,
                failure: onFailure,
                headers: {
                    "Authorization": self.getClientAuthorizationHeader()
                },
                url: self.getPrefixedTokenURL()
            };

            var queryString = "grant_type=refresh_token&refresh_token=" + self.refreshToken();
            if (self.requestedScope)
            {
                queryString += "&scope=" + Gitana.Http.URLEncode(self.requestedScope);
            }

            // append into query string
            if (o.url.indexOf("?") > -1)
            {
                o.url = o.url + "&" + queryString;
            }
            else
            {
                o.url = o.url + "?" + queryString;
            }

            self.invoke(o);
        }
    });

    /**
     * Provides a storage location for OAuth2 credentials
     *
     * @param type
     * @param scope
     *
     * @return storage instance
     * @constructor
     */
    Gitana.OAuth2Http.Storage = function(scope)
    {
        // in-memory implementation of HTML5 storage interface
        var memoryStorage = function() {

            var memory = {};

            var m = {};
            m.removeItem = function(key)
            {
                delete memory[key];
            };

            m.getItem = function(key)
            {
                return memory[key];
            };

            m.setItem = function(key, value)
            {
                memory[key] = value;
            };

            return m;
        }();

        /**
         * Determines whether the current runtime environment supports HTML5 local storage
         *
         * @return {Boolean}
         */
        var supportsLocalStorage = function()
        {
            try {
                return 'localStorage' in window && window['localStorage'] !== null;
            } catch (e) {
                return false;
            }
        };

        /**
         * Determines whether the current runtime environment supports HTML5 session storage.
         *
         * @return {Boolean}
         */
        var supportsSessionStorage = function()
        {
            try {
                return 'sessionStorage' in window && window['sessionStorage'] !== null;
            } catch (e) {
                return false;
            }
        };

        var acquireStorage = function()
        {
            var storage = null;

            // store
            if (scope == "session" && supportsSessionStorage())
            {
                storage = sessionStorage;
            }
            else if (scope == "local" && supportsLocalStorage())
            {
                storage = localStorage;
            }
            else
            {
                // fall back to memory-based storage
                storage = memoryStorage;
            }

            return storage;
        };

        // result object
        var r = {};

        /**
         * Clears state.
         */
        r.clear = function()
        {
            acquireStorage().removeItem("gitanaAuthState");
        };

        /**
         * Pokes and peeks the value of a key in the state.
         *
         * @param key
         * @param value
         * @return {*}
         */
        r.poke = function(key, value)
        {
            var state = {};

            var stateString = acquireStorage().getItem("gitanaAuthState");
            if (stateString) {
                state = JSON.parse(stateString);
            }

            var touch = false;
            if (typeof(value) !== "undefined" && value !== null)
            {
                state[key] = value;
                touch = true;
            }
            else if (value === null)
            {
                delete state[key];
                touch = true;
            }

            if (touch) {
                acquireStorage().setItem("gitanaAuthState", JSON.stringify(state));
            }

            return state[key];
        };

        return r;
    };

}(this));

// statics
Gitana.OAuth2Http.PASSWORD = "password";
Gitana.OAuth2Http.AUTHORIZATION_CODE = "authorization_code";
Gitana.OAuth2Http.TOKEN = "token";
Gitana.OAuth2Http.COOKIE = "cookie";
Gitana.OAuth2Http.TICKET = "ticket";



(function(window)
{
    /**
     * Creates a chain.  If an object is provided, the chain is augmented onto the object.
     *
     * @param object
     */
    Chain = function(object)
    {
        if (!object)
        {
            object = {};
        }

        // wraps the object into a proxy
        var proxiedObject = Chain.proxy(object);

        // the following methods get pushed onto the chained object
        // methods for managing chain state
        proxiedObject.__queue = (function() {
            var queue = [];
            return function(x) {
                if (x) { if (x == 'empty') { queue = []; } else { queue.push(x); }}
                return queue;
            };
        })();
        proxiedObject.__response = (function() {
            var response = null;
            return function(x) {
                if (!Gitana.isUndefined(x)) { if (x) { response = x; } else { response = null; } }
                return response;
            };
        })();
        proxiedObject.__waiting = (function() {
            var waiting = false;
            return function(x) {
                if (!Gitana.isUndefined(x)) { waiting = x; }
                return waiting;
            };
        })();
        proxiedObject.__parent = (function() {
            var parent = null;
            return function(x) {
                if (!Gitana.isUndefined(x)) { if (x) { parent = x; } else { parent = null; } }
                return parent;
            };
        })();
        proxiedObject.__id = (function() {
            var id = Chain.idCount;
            Chain.idCount++;
            return function() {
                return id;
            };
        })();
        proxiedObject.__helper = (function() {
            var helper = null;
            return function(x) {
                if (x) { helper = x; }
                return helper;
            };
        })();
        // marks any chain links which are placeholders for functions
        proxiedObject.__transparent = (function() {
            var transparent = false; // assume not transparent
            return function(x) {
                if (!Gitana.isUndefined(x)) { transparent = x; }
                return transparent;
            };
        })();
        // provides consume behavior for copy into (from another object into this one)
        if (!proxiedObject.__copyState) {
            proxiedObject.__copyState = function(other) {
                Gitana.copyInto(this, other);
            };
        }




        /**
         * Queues either a callback function, an array of callback functions or a subchain.
         *
         * @param element
         * @param [functionName] function name for debugging
         */
        proxiedObject.then = function(element, functionName)
        {
            var self = this;

            var autorun = false;

            //
            // ARRAY
            //
            // if we're given an array of functions, we'll automatically build out a function that orchestrates
            // the concurrent execution of parallel chains.
            //
            // the function will be pushed onto the queue
            //
            if (Gitana.isArray(element))
            {
                var array = element;

                // parallel function invoker
                var parallelInvoker = function()
                {
                    // counter and onComplete() method to keep track of our parallel thread completion
                    var count = 0;
                    var total = array.length;
                    var onComplete = function()
                    {
                        count++;
                        if (count == total)
                        {
                            // manually signal that we're done
                            self.next();
                        }
                    };

                    for (var i = 0; i < array.length; i++)
                    {
                        var func = array[i];

                        // use a closure
                        var x = function(func)
                        {
                            // each function gets loaded onto its own "parallel" chain
                            // the parallel chain contains a subchain and the onComplete method
                            // the parallel chain is a clone of this chain
                            // the subchain runs the function
                            // these are serial so that the subchain must complete before the onComplete method is called
                            var parallelChain = Chain(); // note: empty chain (parent)
                            parallelChain.__waiting(true); // this prevents auto-run (which would ground out the first subchain call)
                            parallelChain.subchain(self).then(function() { // TODO: should we self.clone() for parallel operations?
                                func.call(this);
                            });
                            parallelChain.then(function() {
                                onComplete();
                            });
                            parallelChain.__waiting(false); // switch back to normal
                            parallelChain.run();
                        };
                        x(func);
                    }

                    // return false so that we wait for manual self.next() signal
                    return false;
                };

                // build a subchain (transparent)
                var subchain = this.subchain(null, true); // don't auto add, we'll do it ourselves
                subchain.__queue(parallelInvoker);
                if (functionName) { subchain.__helper(functionName); }
                element = subchain;
            }

            //
            // FUNCTION
            //
            // if we're given a function, then we're being asked to execute a function serially.
            // to facilitate this, we'll wrap it in a subchain and push the subchain down into the queue.
            // the reason is just to make things a little easier and predictive of what the end user might do with
            // the chain.  they probably don't expect it to just exit out if they try to to
            //   this.then(something)
            // in other words, they should always feel like they have their own chain (which in fact they do)
            else if (Gitana.isFunction(element))
            {
                // create the subchain
                // this does a re-entrant call that adds it to the queue (as a subchain)
                var subchain = this.subchain(null, true); // don't auto add, we'll do it ourselves
                subchain.__queue(element);
                if (functionName) { subchain.__helper(functionName); }
                element = subchain;

                // note: because we're given a function, we can tell this chain to try to "autorun"
                autorun = true;
            }


            // anything that arrives this far is just a subchain
            this.__queue(element);


            // if we're able to autorun (meaning that we were told to then() a function)...
            // we climb the parents until we find the topmost parent and tell it to run.
            if (autorun && !this.__waiting())
            {
                var runner = this;
                while (runner.__parent())
                {
                    runner = runner.__parent();
                }

                if (!runner.__waiting())
                {
                    runner.run();
                }
            }

            // always hand back reference to ourselves
            return this;
        };

        /**
         * Run the next element in the queue
         */
        proxiedObject.run = function()
        {
            var self = this;

            // short cut, if nothing in the queue, bail
            if (this.__queue().length == 0 || this.__waiting())
            {
                return this;
            }

            // mark that we're running something
            this.__waiting(true);

            // the element to run
            var element = this.__queue().shift();

            // case: callback function
            if (Gitana.isFunction(element))
            {
                // it's a callback function
                var callback = element;

                // try to determine response and previous response
                var response = null;
                var previousResponse = null;
                if (this.__parent())
                {
                    response = this.__parent().__response();
                    if (this.__parent().__parent())
                    {
                        previousResponse = this.__parent().__parent().__response();
                    }
                }

                // async
                window.setTimeout(function()
                {
                    Chain.log(self, (self.__helper() ? self.__helper()+ " " : "") + "> " + element.toString());

                    // execute with "this = chain"
                    var returned = callback.call(self, response, previousResponse);
                    if (returned !== false)
                    {
                        self.next(returned);
                    }
                }, 0);
            }
            else
            {
                // it's a subchain element (object)
                // we make sure to copy response forward
                var subchain = element;
                subchain.__response(this.__response());

                // pre-emptively copy forward into subchain
                // only do this if the subchain is transparent
                if (subchain.__transparent())
                {
                    //Gitana.copyInto(subchain, this);
                    subchain.__copyState(this);
                }

                // BEFORE CHAIN RUN CALLBACK
                // this provides a way for a chained object to adjust its method signatures and state ahead
                // of actually executing, usually based on some data that was loaded (such as the type of object
                // like a domain user or group)
                //
                if (subchain.beforeChainRun)
                {
                    subchain.beforeChainRun.call(subchain);
                }

                subchain.run();
            }

            return this;
        };

        /**
         * Creates a subchain and adds it to the queue.
         *
         * If no argument is provided, the generated subchain will be cloned from the current chain element.
         */
        proxiedObject.subchain = function(object, noAutoAdd)
        {
            var transparent = false;
            if (!object) {
                transparent = true;
            }

            if (!object)
            {
                object = this;
            }

            var subchain = Chain(object);
            subchain.__parent(this);

            // BEFORE CHAIN RUN CALLBACK
            // this provides a way for a chained object to adjust its method signatures and state ahead
            // of actually executing, usually based on some data that was loaded (such as the type of object
            // like a domain user or group)
            //
            if (subchain.beforeChainRun)
            {
                subchain.beforeChainRun.call(subchain);
            }

            if (!noAutoAdd)
            {
                this.then(subchain);
            }

            subchain.__transparent(transparent);

            return subchain;
        };

        /**
         * Completes the current element in the chain and provides the response that was generated.
         *
         * The response is pushed into the chain as the current response and the current response is bumped
         * back as the previous response.
         *
         * If the response is null, nothing will be bumped.
         *
         * @param [Object] response
         */
        proxiedObject.next = function(response)
        {
            // toggle responses
            if (typeof response !== "undefined")
            {
                this.__response(response);
            }

            // no longer processing callback
            this.__waiting(false);

            // if there isn't anything left in the queue, then we're done
            // if we have a parent, we can signal that we've completed
            if (this.__queue().length == 0)
            {
                if (this.__parent())
                {
                    // copy response up to parent
                    var r = this.__response();
                    this.__parent().__response(r);
                    this.__response(null);

                    // if the current node is transparent, then copy back to parent
                    //if (this.__transparent())
                    if (this.__transparent())
                    {
                        Gitana.deleteProperties(this.__parent());
                        //Gitana.copyInto(this.__parent(), this);
                        this.__parent().__copyState(this);
                    }

                    // inform parent that we're done
                    this.__parent().next();
                }

                // clear parent so that this chain can be relinked
                this.__parent(null);
                this.__queue('empty');
            }
            else
            {
                // run the next element in the queue
                this.run();
            }
        };

        /**
         * Tells the chain to sleep the given number of milliseconds
         */
        proxiedObject.wait = function(ms)
        {
            return this.then(function() {

                var wake = function(chain)
                {
                    return function()
                    {
                        chain.next();
                    };
                }(this);

                window.setTimeout(wake, ms);

                return false;
            });
        };

        /**
         * Registers an error handler;
         *
         * @param errorHandler
         */
        proxiedObject.trap = function(errorHandler)
        {
            this.errorHandler = errorHandler;

            return this;
        };

        /**
         * Handles the error.
         *
         * @param err
         */
        proxiedObject.error = function(err)
        {
            // find the first error handler we can walking up the chain
            var errorHandler = null;
            var ancestor = this;
            while (ancestor && !errorHandler)
            {
                errorHandler = ancestor.errorHandler;
                if (!errorHandler)
                {
                    ancestor = ancestor.__parent();
                }
            }

            // clean up the chain so that it can still be used
            this.__queue('empty');
            this.__response(null);

            // disconnect and stop the parent from processing
            if (this.__parent())
            {
                this.__parent().__queue('empty');
                this.__parent().__waiting(false);
            }

            // invoke error handler
            if (errorHandler)
            {
                var code = errorHandler.call(this, err);

                // finish out the chain if we didn't get "false"
                if (code !== false)
                {
                    this.next();
                }
            }
        };

        /**
         * Completes a chain and hands control back up to the parent.
         */
        proxiedObject.done = function()
        {
            return this.__parent();
        };

        /**
         * Creates a new chain for this object
         */
        proxiedObject.chain = function()
        {
            return Chain(this).then(function() {
                // empty chain to kick start
            });
        };


        // each object that gets chained provides a clone() method
        // if there is already a clone property, don't override it
        // this allows implementation classes to control how they get cloned
        if (!proxiedObject.clone)
        {
            /**
             * Clones this chain and resets chain properties.
             */
            proxiedObject.clone = function()
            {
                return Chain.clone(this);
            };
        }

        // apply auto trap?
        if (autoTrap())
        {
            proxiedObject.trap(autoTrap());
        }

        return proxiedObject;
    };

    /**
     * Wraps the given object into a proxy.
     *
     * If the object is an existing proxy, it is unpackaged and re-proxied.
     * @param o
     */
    Chain.proxy = function(o)
    {
        if (o.__original && o.__original())
        {
            // NOTE: we can't just unproxy since that loses all state of the current object

            // unproxy back to original
            //o = Chain.unproxy(o);

            // for now, we can do this?
            delete o.__original;
        }

        // clone the object using clone() method
        var proxy = null;
        if (o.clone) {
            proxy = o.clone();
        } else {
            proxy = Chain.clone(o);
        }
        proxy.__original = function() {
            return o;
        };

        return proxy;
    };

    /**
     * Hands back the original object for a proxy.
     *
     * @param proxy
     */
    Chain.unproxy = function(proxy)
    {
        var o = null;

        if (proxy.__original && proxy.__original())
        {
            o = proxy.__original();
        }

        return o;
    };

    Chain.debug = false;
    Chain.log = function(chain, text)
    {
        if (Chain.debug && !Gitana.isUndefined(console))
        {
            var f = function()
            {
                var identifier = this.__id();
                if (this.__transparent()) {
                    identifier += "[t]";
                }

                if (!this.__parent())
                {
                    return identifier;
                }

                return f.call(this.__parent()) + " > " + identifier;
            };

            var identifier = f.call(chain);

            console.log("Chain[" + identifier + "] " + text);
        }
    };
    // clone workhorse method
    Chain.clone = function(object)
    {
        // based on Crockford's solution for clone using prototype on function
        // this copies all properties and methods
        // includes copies of chain functions
        function F() {}
        F.prototype = object;
        var clone = new F();

        // copy properties
        Gitana.copyInto(clone, object);

        return clone;
    };

    var autoTrapValue = null;
    var autoTrap = Chain.autoTrap = function(_autoTrap)
    {
        if (_autoTrap)
        {
            autoTrapValue = _autoTrap;
        }

        return autoTrapValue;
    };

    Chain.idCount = 0;

})(window);(function(window)
{
    var Gitana = window.Gitana;

    Gitana.Chainable = Base.extend(
    /** @lends Gitana.Chainable.prototype */
    {
        /**
         * @constructs
         *
         * @param {Gitana.Driver} driver
         *
         * @class Provides common chaining functions used by various interface methods
         */
        constructor: function(driver)
        {
            var self = this;

            this.base();

            /**
             * Override the Chain.__copyState method so that it utilizes a base method that we can override
             * on a per-class basis.
             */
            this.__copyState = function(other) {
                Gitana.copyInto(this, other);
                this.chainCopyState(other);
            };



            ///////////////////////////////////////////////////////////////////////////////////////////////////////
            //
            // privileged methods
            //
            ///////////////////////////////////////////////////////////////////////////////////////////////////////

            this.getDriver = function()
            {
                return driver;
            };

            this.getFactory = function()
            {
                return new Gitana.ObjectFactory();
            };

            this.httpError = function(httpError)
            {
                var err = new Gitana.Error();
                err.name = "Http Error";
                err.message = httpError.message;
                err.status = httpError.status;
                err.statusText = httpError.statusText;

                // stack trace might be available
                if (httpError.stacktrace)
                {
                    err.stacktrace = httpError.stacktrace;
                }

                this.error(err);

                return false;
            };

            this.missingNodeError = function(id)
            {
                var err = new Gitana.Error();
                err.name = "Missing Node error";
                err.message = "The node: " + id + " could not be found";

                this.error(err);

                return false;
            };




            /////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED
            // CHAIN HANDLERS
            //
            /////////////////////////////////////////////////////////////////////////////////////////

            /**
             * This is a legacy method.  It does the same thing as subchain().
             *
             * @param chainable
             */
            this.link = function(chainable)
            {
                return this.subchain(chainable);
            };

            /**
             * Performs a GET from the server and populates the chainable.
             * Proceeds with the chain as bound to the chainable.
             *
             * @param chainable
             * @param uri
             * @param params
             */
            this.chainGet = function(chainable, uri, params)
            {
                var self = this;

                return this.link(chainable).then(function() {

                    var chain = this;

                    // allow for closures on uri for late resolution
                    if (Gitana.isFunction(uri)) {
                        uri = uri.call(self);
                    }

                    driver.gitanaGet(uri, params, {}, function(response) {
                        chain.handleResponse(response);
                        chain.next();
                    }, function(http) {
                        self.httpError(http);
                    });

                    // NOTE: we return false to tell the chain that we'll manually call next()
                    return false;
                });
            };

            /**
             * Creates an object on the server (write + read).
             * Proceeds with the chain as bound to the chainable.
             *
             * @param chainable
             * @param object
             * @param uri
             * @param params
             */
            this.chainCreate = function(chainable, object, uri, params)
            {
                var self = this;

                return this.link(chainable).then(function() {

                    var chain = this;

                    // allow for closures on uri for late resolution
                    if (Gitana.isFunction(uri)) {
                        uri = uri.call(self);
                    }

                    // create
                    driver.gitanaPost(uri, params, object, function(status) {
                        driver.gitanaGet(uri + "/" + status.getId(), null, {}, function(response) {
                            chain.handleResponse(response);
                            chain.next();
                        }, function(http) {
                            self.httpError(http);
                        });
                    }, function(http) {
                        self.httpError(http);
                    });

                    // NOTE: we return false to tell the chain that we'll manually call next()
                    return false;

                }, "chainCreate");
            };

            /**
             * Creates an object on the server using one URL and then reads it back using another URL.
             * This exists because the security responses don't include _doc fields like other responses.
             *
             * Proceeds with the chain as bound to the chainable.
             *
             * @param chainable
             * @param object
             * @param createUri
             * @param readUri
             */
            this.chainCreateEx = function(chainable, object, createUri, readUri)
            {
                var self = this;

                return this.link(chainable).then(function() {

                    var chain = this;

                    // allow for closures on uri for late resolution
                    if (Gitana.isFunction(createUri)) {
                        createUri = createUri.call(self);
                    }

                    // allow for closures on uri for late resolution
                    if (Gitana.isFunction(readUri)) {
                        readUri = readUri.call(self);
                    }

                    // create
                    driver.gitanaPost(createUri, null, object, function(status) {
                        driver.gitanaGet(readUri, null, {}, function(response) {
                            chain.handleResponse(response);
                            chain.next();
                        }, function(http) {
                            self.httpError(http);
                        });
                    }, function(http) {
                        self.httpError(http);
                    });

                    // NOTE: we return false to tell the chain that we'll manually call next()
                    return false;
                });
            };

            /**
             * Performs a POST to the server and populates the chainable with results.
             * Proceeds with the chain as bound to the chainable.
             *
             * @param chainable
             * @param uri
             * @param params
             * @param payload
             */
            this.chainPost = function(chainable, uri, params, payload)
            {
                var self = this;

                return this.link(chainable).then(function() {

                    var chain = this;

                    // allow for closures on uri for late resolution
                    if (Gitana.isFunction(uri)) {
                        uri = uri.call(self);
                    }

                    // create
                    driver.gitanaPost(uri, params, payload, function(response) {
                        chain.handleResponse(response);
                        chain.next();
                    }, function(http) {
                        self.httpError(http);
                    });

                    // NOTE: we return false to tell the chain that we'll manually call next()
                    return false;
                });
            };

            /**
             * Performs a POST to the server.  The response is not handled.
             * Proceeds with the chain as bound to the chainable.
             *
             * @param chainable
             * @param uri
             * @param params
             * @param payload (optional)
             * @param contentType (optional) - example "text/plain"
             */
            this.chainPostEmpty = function(chainable, uri, params, payload, contentType)
            {
                var self = this;

                // if no payload, set to empty
                if (!payload)
                {
                    payload = {};
                }

                return this.link(chainable).then(function() {

                    var chain = this;

                    // allow for closures on uri for late resolution
                    if (Gitana.isFunction(uri)) {
                        uri = uri.call(self);
                    }

                    // create
                    driver.gitanaPost(uri, params, payload, function(response) {
                        chain.next();
                    }, function(http) {
                        self.httpError(http);
                    });

                    // NOTE: we return false to tell the chain that we'll manually call next()
                    return false;
                });
            };

            /**
             * Performs a POST to the server.  The response is not handled.
             * Proceeds with the chain as bound to the chainable.
             *
             * @param chainable
             * @param uri
             * @param params
             * @param contentType (optional) - example "text/plain"
             * @param payload (optional)
             */
            this.chainUpload = function(chainable, uri, params, contentType, payload)
            {
                var self = this;

                // if no payload, leave f
                if (!payload)
                {
                    payload = {};
                }

                return this.link(chainable).then(function() {

                    var chain = this;

                    // allow for closures on uri for late resolution
                    if (Gitana.isFunction(uri)) {
                        uri = uri.call(self);
                    }

                    // create
                    driver.gitanaUpload(uri, params, contentType, payload, function(response) {
                        chain.next();
                    }, function(http) {
                        self.httpError(http);
                    });

                    // NOTE: we return false to tell the chain that we'll manually call next()
                    return false;
                });
            };

            /**
             * Performs a GET to the server and pushes the response into the chain.
             * Proceeds with the chain as bound to the chainable.
             *
             * @param chainable
             * @param uri
             * @param params
             */
            this.chainGetResponse = function(chainable, uri, params)
            {
                var self = this;

                return this.link(chainable).then(function() {

                    var chain = this;

                    // allow for closures on uri for late resolution
                    if (Gitana.isFunction(uri)) {
                        uri = uri.call(self);
                    }

                    driver.gitanaGet(uri, params, {}, function(response) {
                        chain.next(response);
                    }, function(http) {
                        self.httpError(http);
                    });

                    // NOTE: we return false to tell the chain that we'll manually call next()
                    return false;
                });
            };

            /**
             * Performs a GET to the server and pushes the "rows" response attribute into the chain.
             * Proceeds with the chain as bound to the chainable.
             *
             * @param chainable
             * @param uri
             * @param params
             */
            this.chainGetResponseRows = function(chainable, uri, params)
            {
                return this.chainGetResponse(chainable, uri, params).then(function(response) {
                    return response["rows"];
                });
            };

            /**
             * Performs a GET to the server and checks whether the "rows" array attribute of the response
             * has the given value.
             *
             * Proceeds with the chain as bound to the chainable.
             *
             * @param chainable
             * @param uri
             * @param value
             */
            this.chainHasResponseRow = function(chainable, uri, value)
            {
                return this.chainGetResponse(chainable, uri).then(function(response) {
                    var authorized = false;
                    for (var i = 0; i < response.rows.length; i++)
                    {
                        if (response.rows[i].toLowerCase() == value.toLowerCase())
                        {
                            authorized = true;
                        }
                    }
                    return authorized;
                });
            };

            /**
             * Performs a POST to the server and pushes the response into the chain.
             * Proceeds with the chain as bound to the chainable.
             *
             * @param chainable
             * @param uri
             * @param params
             */
            this.chainPostResponse = function(chainable, uri, params, payload)
            {
                var self = this;

                return this.link(chainable).then(function() {

                    var chain = this;

                    // allow for closures on uri for late resolution
                    if (Gitana.isFunction(uri)) {
                        uri = uri.call(self);
                    }

                    driver.gitanaPost(uri, params, payload, function(response) {
                        chain.next(response);
                    }, function(http) {
                        self.httpError(http);
                    });

                    // NOTE: we return false to tell the chain that we'll manually call next()
                    return false;
                });
            };


            /**
             * Helper to gets the principal id for a principal object, json structure or principal id itself.
             * This returns something like "domainId/principalId"
             *
             * @param principal
             */
            this.extractPrincipalDomainQualifiedId = function(principal, defaultDomainId)
            {
                var identifiers = this.extractPrincipalIdentifiers(principal, defaultDomainId);

                return identifiers["domain"] + "/" + identifiers["principal"];
            };

            /**
             * Helper to gets the principal id for a principal object, json structure or principal id itself.
             * This returns something like "domainId/principalId"
             *
             * @param principal principal object or string (principal id or domain qualified principal id)
             * @param defaultDomainId
             */
            this.extractPrincipalIdentifiers = function(principal, defaultDomainId)
            {
                var identifiers = {};

                if (!defaultDomainId)
                {
                    defaultDomainId = "default";
                }

                if (Gitana.isString(principal))
                {
                    var x = principal.indexOf("/");
                    if (x > -1)
                    {
                        identifiers["domain"] = principal.substring(0, x);
                        identifiers["principal"] = principal.substring(x + 1);
                    }
                    else
                    {
                        identifiers["domain"] = defaultDomainId;
                        identifiers["principal"] = principal;
                    }
                }
                else if (principal.objectType && principal.objectType() == "Gitana.DomainPrincipal")
                {
                    identifiers["domain"] = principal.getDomainId();
                    identifiers["principal"] = principal.getId();
                }
                else if (principal.objectType && principal.objectType() == "Gitana.TeamMember")
                {
                    identifiers["domain"] = principal["domainId"];
                    identifiers["principal"] = principal["_doc"];
                }
                else if (principal["_doc"])
                {
                    identifiers["domain"] = defaultDomainId;
                    identifiers["principal"] = principal["_doc"];
                }
                else if (principal["name"])
                {
                    identifiers["domain"] = defaultDomainId;
                    identifiers["principal"] = principal["name"];
                }

                return identifiers;
            };
        },

        /**
         * Used internally during chain copy going forward or backward through the chain.
         *
         * This is wired into the Chain.__copyState method and allows a convenient way to override
         * chain copy behavior on a per-object-type basis.
         *
         * @param otherObject
         */
        chainCopyState: function(otherObject)
        {
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.Response = Base.extend(
    /** @lends Gitana.Response.prototype */
    {
        /**
         * @constructs
         *
         * @class Gitana Response that wraps a response document from the Gitana server.
         *
         * @param {Object} object json response object
         */
        constructor: function(object)
        {
            Gitana.copyInto(this, object);
        },

        /**
         * Gets the id ("_doc") field of the response (if one is available).
         *
         * @public
         *
         * @returns {String} id
         */
        getId: function()
        {
            return this["_doc"];
        },

        /**
         * Indicates whether this response is a Status Document.
         *
         * @public
         *
         * @returns {Boolean} whether this is a status document
         */
        isStatusDocument: function()
        {
            return (this["ok"] || this["error"]);
        },

        /**
         * Indicates whether this response is a List Document.
         *
         * @public
         *
         * @returns {Boolean} whether this is a list document
         */
        isListDocument: function()
        {
            return this["total_rows"] && this["rows"] && this["offset"];
        },

        /**
         * Indicates whether this response is a Data Document.
         *
         * @public
         *
         * @returns {Boolean} whether this is a data document
         */
        isDataDocument: function()
        {
            return (!this.isStatusDocument() && !this.isListDocument());
        },

        /**
         * Indicates whether the response is "ok".
         *
         * @public
         *
         * @returns {Boolean} whether the response is "ok"
         */
        isOk: function()
        {
            // assume things are ok
            var ok = true;

            if (this.isStatusDocument()) {
                if (this["ok"] != null) {
                    ok = this["ok"];
                }
            }

            // any document type can specify an error
            if (this["error"]) {
                ok = false;
            }

            return ok;
        },

        /**
         * Indicates whetehr the response is in an error state.
         *
         * @public
         *
         * @returns {Boolean} whether the response is in an error state
         */
        isError: function()
        {
            return !this.isOk();
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.AuthInfo = Base.extend(
    /** @lends Gitana.AuthInfo.prototype */
    {
        /**
         * @constructs
         *
         * @class Gitana.AuthInfo holds authentication info for the driver
         *
         * @param {Object} object json response object
         */
        constructor: function(object)
        {
            Gitana.copyInto(this, object);
        },

        getPrincipalId: function()
        {
            return this["principalId"];
        },

        getPrincipalDomainId: function()
        {
            return this["principalDomainId"];
        },

        getPrincipalName: function()
        {
            return this["principalName"];
        },

        getTenantId: function()
        {
            return this["tenantId"];
        },

        getTenantTitle: function()
        {
            return this["tenantTitle"];
        },

        getTenantDescription: function()
        {
            return this["tenantDescription"];
        },

        getClientId: function()
        {
            return this["clientId"];
        },

        getTicket: function()
        {
            return this["ticket"];
        }
    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.SystemMetadata = Base.extend(
    /** @lends Gitana.SystemMetadata.prototype */
    {
        /**
         * @constructs
         *
         * @class System Metadata
         */
        constructor: function()
        {
            this.base();
        },

        updateFrom: function(json)
        {
            // clear old system properties
            Gitana.deleteProperties(this, false);

            Gitana.copyInto(this, json);
        },

        get: function(key)
        {
            return this[key];
        },

        /**
         * Retrieves the changeset id.
         *
         * @public
         *
         * @return the changeset id
         */
        getChangesetId: function()
        {
            return this.get("changeset");
        },

        /**
         * Retrieves the name of the user who created this object.
         *
         * @public
         *
         * @return the user name of the creator
         */
        getCreatedBy: function()
        {
            return this.get("created_by");
        },

        /**
         * Retrieves the id of the user who created this object.
         *
         * @public
         *
         * @return the user id of the creator
         */
        getCreatedByPrincipalId: function()
        {
            return this.get("created_by_principal_id");
        },

        /**
         * Retrieves the domain id of the user who created this object.
         *
         * @public
         *
         * @return the user domain id of the creator
         */
        getCreatedByPrincipalDomainId: function()
        {
            return this.get("created_by_principal_domain_id");
        },

        /*
        readCreatedByPrincipal: function(platform)
        {
            return this.subchain(platform).readDomain(this.getCreatedByPrincipalDomainId).readPrincipal(this.getCreatedByPrincipalId);
        },
        */

        /**
         * Retrieves the id of the user who modified this object.
         *
         * @public
         *
         * @return the user id of the modifier
         */
        getModifiedBy: function()
        {
            return this.get("modified_by");
        },

        /**
         * Retrieves the id of the user who modified this object.
         *
         * @public
         *
         * @return the user id of the modifier
         */
        getModifiedByPrincipalId: function()
        {
            return this.get("modified_by_principal_id");
        },

        /**
         * Retrieves the domain id of the user who modified this object.
         *
         * @public
         *
         * @return the user domain id of the modifier
         */
        getModifiedByPrincipalDomainId: function()
        {
            return this.get("modified_by_principal_domain_id");
        },

        /*
        readModifiedByPrincipal: function(platform)
        {
            return this.subchain(platform).readDomain(this.getModifiedByPrincipalDomainId).readPrincipal(this.getModifiedByPrincipalId);
        },
        */

        /**
         * Retrieves the timestamp for creation of this object.
         *
         * @public
         *
         * @return creation timestamp
         */
        getCreatedOn: function()
        {
            if (!this.createdOn)
            {
                this.createdOn = new Gitana.Timestamp(this.get("created_on"));
            }

            return this.createdOn;
        },

        /**
         * Retrieves the timestamp for modification of this object.
         *
         * @public
         *
         * @return modification timestamp
         */
        getModifiedOn: function()
        {
            if (!this.modifiedOn)
            {
                this.modifiedOn = new Gitana.Timestamp(this.get("modified_on"));
            }

            return this.modifiedOn;
        }

    });
    
})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.Timestamp = Base.extend(
    /** @lends Gitana.Timestamp.prototype */
    {
        /**
         * @constructs
         *
         * @class Timestamp
         *
         * @param {Object} object the timestamp json object
         */
        constructor: function(object)
        {
            this.base(object);
        },

        /**
         * @returns {Integer} the year
         */
        getYear: function()
        {
            return this["year"];
        },

        /**
          @returns {Integer} the month
         */
        getMonth: function()
        {
            return this["month"];
        },

        /**
         * @returns {Integer} the day of the month
         */
        getDay: function()
        {
            return this["day_of_month"];
        },

        /**
         * @returns {Integer} the hour of the day (24 hour clock)
         */
        getHour: function()
        {
            return this["hour"];
        },

        /**
         * @returns {Integer} the minute
         */
        getMinute: function()
        {
            return this["minute"];
        },

        /**
         * @returns {Integer} the second
         */
        getSecond: function()
        {
            return this["second"];
        },

        /**
         * @returns {Integer} the millisecond (0-1000)
         */
        getMillisecond: function()
        {
            return this["millisecond"];
        },

        /**
         * @returns {Integer} absolute millisecond
         */
        getTime: function()
        {
            return this["ms"];
        },

        /**
         * @returns {String} text-friendly timestamp
         */
        getTimestamp: function()
        {
            return this["timestamp"];
        }

    });
    
})(window);
(function(window)
{
    Gitana.uniqueIdCounter = 0;

    /**
     * Builds an array from javascript method arguments.
     *
     * @inner
     *
     * @param {arguments} arguments
     *
     * @returns {Array} an array
     */
    Gitana.makeArray = function(args) {
        return Array.prototype.slice.call(args);
    };

    /**
     * Serializes a object into a JSON string and optionally makes it pretty by indenting.
     *
     * @inner
     *
     * @param {Object} object The javascript object.
     * @param {Boolean} pretty Whether the resulting string should have indentation.
     *
     * @returns {String} string
     */
    Gitana.stringify = function(object, pretty) {

        var val = null;
        if (object)
        {
            if (pretty)
            {
                val = JSON.stringify(object, null, "  ");
            }
            else
            {
                val = JSON.stringify(object);
            }
        }

        return val;
    };

    /**
     * Determines whether the given argument is a String.
     *
     * @inner
     *
     * @param arg argument
     *
     * @returns {Boolean} whether it is a String
     */
    Gitana.isString = function( arg ) {
        return (typeof arg == "string");
    };

    /**
     * Determines whether the given argument is a Number.
     *
     * @inner
     *
     * @param arg argument
     *
     * @returns {Boolean} whether it is a Number
     */
    Gitana.isNumber = function( arg ) {
        return (typeof arg == "number");
    };

    /**
     * Determines whether the given argument is a Boolean.
     *
     * @inner
     *
     * @param arg argument
     *
     * @returns {Boolean} whether it is a Boolean
     */
    Gitana.isBoolean = function( arg ) {
        return (typeof arg == "boolean");
    };

    /**
     * Determines whether the given argument is a Function.
     *
     * @inner
     *
     * @param arg argument
     *
     * @returns {Boolean} whether it is a Function
     */
    Gitana.isFunction = function(arg) {
        return Object.prototype.toString.call(arg) === "[object Function]";
    };

    /**
     * Determines whether a bit of text starts with a given prefix.
     *
     * @inner
     *
     * @param {String} text A bit of text.
     * @param {String} prefix The prefix.
     *
     * @returns {Boolean} whether the text starts with the prefix.
     */
    Gitana.startsWith = function(text, prefix) {
        return text.substr(0, prefix.length) === prefix;
    };

    /**
     * Copies the members of the source object into the target object.
     * This includes both properties and functions from the source object.
     *
     * @inner
     *
     * @param {Object} target Target object.
     * @param {Object} source Source object.
     */
    Gitana.copyInto = function(target, source) {
        for (var i in source) {
            if (source.hasOwnProperty(i) && !this.isFunction(source[i])) {
                target[i] = source[i];
            }
        }
    };

    /**
     * Deletes any owned properties of the given object.  If specified, owned functions will also be deleted.
     *
     * @inner
     *
     * @param object {Object} object
     */
    Gitana.deleteProperties = function(object, deleteFunctions) {
        var keys = [];
        for (var k in object) { keys.push(k); }

        for (var i = 0; i < keys.length; i++)
        {
            var key = keys[i];

            if (object.hasOwnProperty(key)) {
                if (!Gitana.isFunction(object[key]) || (deleteFunctions && Gitana.isFunction(object[key]))) {
                    delete object[key];
                }
            }
        }
    };


    /**
     * Stamps the functions and properties from the source object to the target object.
     *
     * @inner
     *
     * @param {Object} target Target object.
     * @param {Object} source Source object.
     */
    Gitana.stampInto = function(target, source) {
        for (var i in source)
        {
            if (source.hasOwnProperty(i))
            {
                target[i] = source[i];
            }
        }
    };

    Gitana.contains = function(a, obj)
    {
        var i = a.length;
        while (i--)
        {
            if (a[i] === obj)
            {
                return true;
            }
        }
        return false;
    };

    Gitana.isArray = function(obj)
    {
        return obj.push && obj.slice;
    };

    Gitana.isUndefined = function(obj)
    {
        return (typeof obj == "undefined");
    };

    Gitana.isEmpty = function(obj)
    {
        return this.isUndefined(obj) || obj == null;
    };

    Gitana.generateId = function()
    {
        Gitana.uniqueIdCounter++;
        return "gitana-" + Gitana.uniqueIdCounter;
    };

    Gitana.isNode = function(o)
    {
        return (
                typeof Node === "object" ? o instanceof Node :
                        typeof o === "object" && typeof o.nodeType === "number" && typeof o.nodeName==="string");
    };

    Gitana.isElement = function(o)
    {
        return (
                typeof HTMLElement === "object" ? o instanceof HTMLElement : //DOM2
                        typeof o === "object" && o.nodeType === 1 && typeof o.nodeName==="string");
    };

    Gitana.debug = function(str)
    {
        if (!this.isUndefined(console))
        {
            console.log(str);
        }
    };

    Gitana.error = function(str)
    {
        if (!this.isUndefined(console))
        {
            console.error(str);
        }
    };

    Gitana.getNumberOfKeys = function(map)
    {
        var count = 0;
        for (var key in map) {
            count++;
        }

        return count;
    };

    /**
     * Writes a cookie.
     *
     * @param {String} name
     * @param {String} value
     * @param [String] path optional path (assumed "/" if not provided)
     * @param [Number] days optional # of days to store cookie
     *                      if null or -1, assume session cookie
     *                      if 0, assume expired cookie
     *                      if > 0, assume # of days
     * @param [String] domain optional domain (otherwise assumes wildcard base domain)
     */
    Gitana.writeCookie = function(name, value, path, days, domain)
    {
        if (typeof(document) !== "undefined")
        {
            var createCookie = function(name, value, path, days, host)
            {
                // path
                if (!path)
                {
                    path = "/";
                }
                var pathString = ";path=" + path;

                // expiration
                var expirationString = "";
                if (typeof(days) == "undefined" || days == -1)
                {
                    // session cookie
                }
                else if (days == 0)
                {
                    // expired cookie
                    expirationString = ";expires=Thu, 01 Jan 1970 00:00:01 GMT";
                }
                else if (days > 0)
                {
                    var date = new Date();
                    date.setTime(date.getTime()+(days*24*60*60*1000));
                    expirationString = ";expires="+date.toGMTString();
                }

                // domain
                var domainString = "";
                if (host)
                {
                    domainString = ";domain=" + host;
                }

                document.cookie = name + "=" + value + expirationString + pathString + domainString + ";";
            };

            createCookie(name, value, path, days, domain);
        }
    };

    /**
     * Deletes a cookie.
     *
     * @param name
     * @param path
     */
    Gitana.deleteCookie = function(name, path)
    {
        var existsCookie = function(name, path)
        {
            return Gitana.readCookie(name);
        };

        if (typeof(document) != "undefined")
        {
            // first attempt, let the browser sort out the assumed domain
            // this works for most modern browsers
            if (existsCookie(name))
            {
                // use expiration time of 0 to signal expired cookie
                Gitana.writeCookie(name, "", path, 0);
            }

            // second attempt, if necessary, plug in an assumed domain
            // this is needed for phantomjs
            if (existsCookie(name))
            {
                // see if we can resolve a domain
                if (window)
                {
                    var domain = window.location.host;
                    if (domain)
                    {
                        // remove :port
                        var i = domain.indexOf(":");
                        if (i > -1)
                        {
                            domain = domain.substring(0, i);
                        }
                    }

                    // use expiration time of 0 to signal expired cookie
                    Gitana.writeCookie(name, "", path, 0, domain);
                }
            }
        }
    };

    Gitana.readCookie = function(name)
    {
        function _readCookie(name)
        {
            var nameEQ = name + "=";
            var ca = document.cookie.split(';');
            for (var i = 0; i < ca.length; i++)
            {
                var c = ca[i];
                while (c.charAt(0)==' ')
                {
                    c = c.substring(1,c.length);
                }

                if (c.indexOf(nameEQ) == 0)
                {
                    return c.substring(nameEQ.length,c.length);
                }
            }
            return null;
        }

        var value = null;

        if (typeof(document) !== "undefined")
        {
            value = _readCookie(name);
        }

        return value;
    };


    Gitana.getCurrentQueryStringParameter = function(paramName)
    {
        var searchString = window.location.search.substring(1), i, val, params = searchString.split("&");

        for (i = 0; i < params.length; i++)
        {
            val = params[i].split("=");

            if (val[0] == paramName)
            {
                return unescape(val[1]);
            }
        }

        return null;
    };

    Gitana.getCurrentHashStringParameter = function(paramName)
    {
        var searchString = window.location.href.substring(window.location.href.indexOf("#") + 1);
        var params = searchString.split("&");

        for (i = 0; i < params.length; i++)
        {
            val = params[i].split("=");

            if (val[0] == paramName)
            {
                return unescape(val[1]);
            }
        }

        return null;
    };

    Gitana.btoa = function(string)
    {
        var b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

        var i = 0, length = string.length, ascii, index, output = '';

        for (; i < length; i+=3) {
            ascii = [
                string.charCodeAt(i),
                string.charCodeAt(i+1),
                string.charCodeAt(i+2)
            ];

            index = [
                ascii[0] >> 2,
                ((ascii[0] & 3) << 4) | ascii[1] >> 4,
                ((ascii[1] & 15) << 2) | ascii[2] >> 6,
                ascii[2] & 63
            ];

            if (isNaN(ascii[1])) {
                index[2] = 64;
            }
            if (isNaN(ascii[2])) {
                index[3] = 64;
            }

            output += b64.charAt(index[0]) + b64.charAt(index[1]) + b64.charAt(index[2]) + b64.charAt(index[3]);
        }

        return output;
    };

    /**
     * Copies only those members that are already represented on the target.
     *
     * @inner
     *
     * @param {Object} target Target object.
     * @param {Object} source Source object.
     */
    Gitana.copyKeepers = function(target, source) {

        if (!source) { return; }

        for (var i in source) {
            if (source.hasOwnProperty(i) && !this.isFunction(source[i])) {
                if (!Gitana.isUndefined(target[i])) {
                    target[i] = source[i];
                }
            }
        }
    };

})(window);(function(window)
{
    Gitana.Methods = {};

    /**
     * Produces the common function to handle listAttachments() on various attachables within Gitana.
     *
     * @param [mapClass] map implementation class (if none provided, uses Gitana.BinaryAttachmentMap)
     *
     * @return {Function}
     */
    Gitana.Methods.listAttachments = function(mapClass) {

        if (!mapClass) {
            mapClass = Gitana.BinaryAttachmentMap;
        }

        return function(local) {

            var self = this;

            var result = this.subchain(new mapClass(this));
            if (!local)
            {
                // front-load some work that fetches from remote server
                result.then(function() {

                    var chain = this;

                    self.getDriver().gitanaGet(self.getUri() + "/attachments", null, {}, function(response) {
                        chain.handleResponse(response);
                        chain.next();
                    });

                    return false;
                });
            }
            else
            {
                // try to populate the map from our cached values on the node (if they exist)
                var existingMap = self.getSystemMetadata()["attachments"];
                if (existingMap)
                {
                    // attachments that come off of system() don't have "attachmentId" on their json object
                    // instead, the "attachmentId" is the key into the map.

                    // so here, in terms of normalizing things, we copy "attachmentId" into the json object
                    for (var key in existingMap)
                    {
                        var value = result[key];
                        value["attachmentId"] = key;
                    }
                }

                //result.handleResponse(existingMap);
            }

            return result;
        };
    };

    /**
     * Produces the common function to handle attach() of attachments to an attachable within Gitana.
     *
     * @param [attachmentClass] attachment implementation class (if none provided, uses Gitana.BinaryAttachment)
     * @param [paramsFunction] optional population function for url params
     *
     * @return {Function}
     */
    Gitana.Methods.attach = function(attachmentClass, paramsFunction) {

        if (!attachmentClass) {
            attachmentClass = Gitana.BinaryAttachment;
        }

        return function(attachmentId, contentType, data)
        {
            var self = this;

            if (!attachmentId)
            {
                attachmentId = "default";
            }

            // the thing we're handing back
            var result = this.subchain(new attachmentClass(this));

            // preload some work onto a subchain
            result.then(function() {

                // params
                var params = {};
                if (paramsFunction) {
                    paramsFunction(params);
                }

                // upload the attachment
                var uploadUri = self.getUri() + "/attachments/" + attachmentId;
                this.chainUpload(this, uploadUri, params, contentType, data).then(function() {

                    // read back attachment information and plug onto result
                    this.subchain(self).listAttachments().then(function() {

                        // TODO: update attachment information on attachable.system() ?

                        this.select(attachmentId).then(function() {
                            result.handleResponse(this);
                        });
                    });
                });
            });

            return result;
        };
    };

    /**
     * Produces the common function to handle unattach() of attachments from an attachable within Gitana.
     *
     * @return {Function}
     */
    Gitana.Methods.unattach = function()
    {
        return function(attachmentId) {

            return this.then(function() {
                this.chainDelete(this, this.getUri() + "/attachments/" + attachmentId).then(function() {
                    // TODO
                });
            });
        };
    };

    Gitana.Methods.getPreviewUri = function(prefix)
    {
        if (!prefix) {
            prefix = "preview";
        }

        return function(name, config) {

            var url = this.getDriver().baseURL + this.getUri() + "/" + prefix + "/" + name;

            if (config)
            {
                var first = true;

                for (var key in config)
                {
                    if (first)
                    {
                        url += "?";
                    }
                    else
                    {
                        url += "&";
                    }

                    var value = config[key];
                    if (value)
                    {
                        url += key + "=" + value;
                    }

                    first = false;
                }
            }

            return url;
        };
    };

    Gitana.Methods.listInteractionObjects = function(factoryMapMethod, uriPath)
    {
        return function(pagination)
        {
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var chainable = this.getFactory()[factoryMapMethod](this);
            return this.chainGet(chainable, this.getUri() + "/" + uriPath, params);
        };
    };

    Gitana.Methods.readInteractionObject = function(factoryObjectMethod, uriPath)
    {
        return function(interactionObjectId)
        {
            var chainable = this.getFactory()[factoryObjectMethod](this);
            return this.chainGet(chainable, this.getUri() + "/" + uriPath + "/" + interactionObjectId);
        };
    };

    Gitana.Methods.queryInteractionObjects = function(factoryMapMethod, uriPath)
    {
        return function(query, pagination)
        {
            var self = this;

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return self.getUri() + "/" + uriPath + "/query";
            };

            var chainable = this.getFactory()[factoryMapMethod](this);
            return this.chainPost(chainable, uriFunction, params, query);
        };
    };

})(window);(function(window)
{
    // if we're running on the Cloud CMS hosted platform, we can auto-acquire the client key that we should use
    (function()  {

        // check to make sure location exists (only available in browsers)
        if (typeof window.location != "undefined")
        {
            if (typeof(Gitana.autoConfigUri) === "undefined")
            {
                var uri = window.location.href;
                var z1 = uri.indexOf(window.location.pathname);
                z1 = uri.indexOf("/", z1 + 2);
                if (z1 > -1)
                {
                    uri = uri.substring(0, z1);
                }

                if (uri.indexOf("cloudcms.net") > -1)
                {
                    Gitana.autoConfigUri = uri;
                }
            }
        }

    }());

})(window);(function(window)
{
    var Gitana = window.Gitana;
    
    /**
     * Object factory
     *
     * Produces object instances (nodes included) for given json.
     */
    Gitana.ObjectFactory = Base.extend(
    /** @lends Gitana.ObjectFactory.prototype */
    {
        constructor: function()
        {
            this.create = function(klass, existing, object)
            {
                var created = new klass(existing, object);

                return created;
            };
        },

        platformDataStoreMap: function(platform, object)
        {
            return this.create(Gitana.PlatformDataStoreMap, platform, object);
        },

        platformDataStore: function(platform, object)
        {
            var type = object.datastoreTypeId;

            return this[type](platform, object);
        },



        //////////////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // CLUSTER
        //
        //////////////////////////////////////////////////////////////////////////////////////////////////////////

        platform: function(cluster, object)
        {
            return this.create(Gitana.Platform, cluster, object);
        },

        job: function(cluster, object)
        {
            var type = null;

            if (object)
            {
                if (Gitana.isString(object))
                {
                    type = object;
                }
                else
                {
                    type = object["type"];
                }
            }

            var job = null;
            if ("copy" == type)
            {
                job = this.create(Gitana.CopyJob, cluster, object);
            }
            else if ("export" == type)
            {
                job = this.create(Gitana.TransferExportJob, cluster, object);
            }
            else if ("import" == type)
            {
                job = this.create(Gitana.TransferImportJob, cluster, object);
            }
            else
            {
                job = this.create(Gitana.Job, cluster, object);
            }

            return job;
        },

        jobMap: function(cluster, object)
        {
            return this.create(Gitana.JobMap, cluster, object);
        },

        logEntry: function(cluster, object)
        {
            return this.create(Gitana.LogEntry, cluster, object);
        },

        logEntryMap: function(cluster, object)
        {
            return this.create(Gitana.LogEntryMap, cluster, object);
        },



        //////////////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // PLATFORM
        //
        //////////////////////////////////////////////////////////////////////////////////////////////////////////

        auditRecord: function(repository, object)
        {
            return this.create(Gitana.AuditRecord, repository, object);
        },

        auditRecordMap: function(repository, object)
        {
            return this.create(Gitana.AuditRecordMap, repository, object);
        },

        stack: function(platform, object)
        {
            return this.create(Gitana.Stack, platform, object);
        },

        stackMap: function(platform, object)
        {
            return this.create(Gitana.StackMap, platform, object);
        },

        project: function(platform, object)
        {
            return this.create(Gitana.Project, platform, object);
        },

        projectMap: function(platform, object)
        {
            return this.create(Gitana.ProjectMap, platform, object);
        },

        repository: function(platform, object)
        {
            return this.create(Gitana.Repository, platform, object);
        },

        repositoryMap: function(platform, object)
        {
            return this.create(Gitana.RepositoryMap, platform, object);
        },

        domain: function(platform, object)
        {
            return this.create(Gitana.Domain, platform, object);
        },

        domainMap: function(platform, object)
        {
            return this.create(Gitana.DomainMap, platform, object);
        },

        vault: function(platform, object)
        {
            return this.create(Gitana.Vault, platform, object);
        },

        vaultMap: function(platform, object)
        {
            return this.create(Gitana.VaultMap, platform, object);
        },

        registrar: function(platform, object)
        {
            return this.create(Gitana.Registrar, platform, object);
        },

        registrarMap: function(platform, object)
        {
            return this.create(Gitana.RegistrarMap, platform, object);
        },

        directory: function(platform, object)
        {
            return this.create(Gitana.Directory, platform, object);
        },

        directoryMap: function(platform, object)
        {
            return this.create(Gitana.DirectoryMap, platform, object);
        },

        application: function(platform, object)
        {
            return this.create(Gitana.Application, platform, object);
        },

        applicationMap: function(platform, object)
        {
            return this.create(Gitana.ApplicationMap, platform, object);
        },

        warehouse: function(platform, object)
        {
            return this.create(Gitana.Warehouse, platform, object);
        },

        warehouseMap: function(platform, object)
        {
            return this.create(Gitana.WarehouseMap, platform, object);
        },

        webhost: function(platform, object)
        {
            return this.create(Gitana.WebHost, platform, object);
        },

        webhostMap: function(platform, object)
        {
            return this.create(Gitana.WebHostMap, platform, object);
        },

        autoClientMapping: function(webhost, object)
        {
            return this.create(Gitana.AutoClientMapping, webhost, object);
        },

        autoClientMappingMap: function(webhost, object)
        {
            return this.create(Gitana.AutoClientMappingMap, webhost, object);
        },

        trustedDomainMapping: function(webhost, object)
        {
            return this.create(Gitana.TrustedDomainMapping, webhost, object);
        },

        trustedDomainMappingMap: function(webhost, object)
        {
            return this.create(Gitana.TrustedDomainMappingMap, webhost, object);
        },

        deployedApplication: function(webhost, object)
        {
            return this.create(Gitana.DeployedApplication, webhost, object);
        },

        deployedApplicationMap: function(webhost, object)
        {
            return this.create(Gitana.DeployedApplicationMap, webhost, object);
        },

        settings: function(application, object)
        {
            return this.create(Gitana.Settings, application, object);
        },

        settingsMap: function(application, object)
        {
            return this.create(Gitana.SettingsMap, application, object);
        },

        registration: function(application, object)
        {
            return this.create(Gitana.Registration, application, object);
        },

        registrationMap: function(application, object)
        {
            return this.create(Gitana.RegistrationMap, application, object);
        },

        email: function(application, object)
        {
            return this.create(Gitana.Email, application, object);
        },

        emailMap: function(application, object)
        {
            return this.create(Gitana.EmailMap, application, object);
        },

        emailProvider: function(application, object)
        {
            return this.create(Gitana.EmailProvider, application, object);
        },

        emailProviderMap: function(application, object)
        {
            return this.create(Gitana.EmailProviderMap, application, object);
        },

        interactionApplication: function(warehouse, object)
        {
            return this.create(Gitana.InteractionApplication, warehouse, object);
        },

        interactionApplicationMap: function(warehouse, object)
        {
            return this.create(Gitana.InteractionApplicationMap, warehouse, object);
        },

        interactionSession: function(warehouse, object)
        {
            return this.create(Gitana.InteractionSession, warehouse, object);
        },

        interactionSessionMap: function(warehouse, object)
        {
            return this.create(Gitana.InteractionSessionMap, warehouse, object);
        },

        interactionPage: function(warehouse, object)
        {
            return this.create(Gitana.InteractionPage, warehouse, object);
        },

        interactionPageMap: function(warehouse, object)
        {
            return this.create(Gitana.InteractionPageMap, warehouse, object);
        },

        interactionNode: function(warehouse, object)
        {
            return this.create(Gitana.InteractionNode, warehouse, object);
        },

        interactionNodeMap: function(warehouse, object)
        {
            return this.create(Gitana.InteractionNodeMap, warehouse, object);
        },

        interactionUser: function(warehouse, object)
        {
            return this.create(Gitana.InteractionUser, warehouse, object);
        },

        interactionUserMap: function(warehouse, object)
        {
            return this.create(Gitana.InteractionUserMap, warehouse, object);
        },

        // new

        interactionContinent: function(warehouse, object)
        {
            return this.create(Gitana.InteractionContinent, warehouse, object);
        },

        interactionContinentMap: function(warehouse, object)
        {
            return this.create(Gitana.InteractionContinentMap, warehouse, object);
        },

        interactionCountry: function(warehouse, object)
        {
            return this.create(Gitana.InteractionCountry, warehouse, object);
        },

        interactionCountryMap: function(warehouse, object)
        {
            return this.create(Gitana.InteractionCountryMap, warehouse, object);
        },

        interactionCity: function(warehouse, object)
        {
            return this.create(Gitana.InteractionCity, warehouse, object);
        },

        interactionCityMap: function(warehouse, object)
        {
            return this.create(Gitana.InteractionCityMap, warehouse, object);
        },

        interactionRegion: function(warehouse, object)
        {
            return this.create(Gitana.InteractionRegion, warehouse, object);
        },

        interactionRegionMap: function(warehouse, object)
        {
            return this.create(Gitana.InteractionRegionMap, warehouse, object);
        },

        interactionPostalCode: function(warehouse, object)
        {
            return this.create(Gitana.InteractionPostalCode, warehouse, object);
        },

        interactionPostalCodeMap: function(warehouse, object)
        {
            return this.create(Gitana.InteractionPostalCodeMap, warehouse, object);
        },

        interactionUserAgent: function(warehouse, object)
        {
            return this.create(Gitana.InteractionUserAgent, warehouse, object);
        },

        interactionUserAgentMap: function(warehouse, object)
        {
            return this.create(Gitana.InteractionUserAgentMap, warehouse, object);
        },

        interactionOperatingSystem: function(warehouse, object)
        {
            return this.create(Gitana.InteractionOperatingSystem, warehouse, object);
        },

        interactionOperatingSystemMap: function(warehouse, object)
        {
            return this.create(Gitana.InteractionOperatingSystemMap, warehouse, object);
        },

        interactionDevice: function(warehouse, object)
        {
            return this.create(Gitana.InteractionDevice, warehouse, object);
        },

        interactionDeviceMap: function(warehouse, object)
        {
            return this.create(Gitana.InteractionDeviceMap, warehouse, object);
        },

        //

        interactionReport: function(warehouse, object)
        {
            return this.create(Gitana.InteractionReport, warehouse, object);
        },

        interactionReportMap: function(warehouse, object)
        {
            return this.create(Gitana.InteractionReportMap, warehouse, object);
        },

        interactionReportEntry: function(warehouse, object)
        {
            return this.create(Gitana.InteractionReportEntry, warehouse, object);
        },

        interactionReportEntryMap: function(warehouse, object)
        {
            return this.create(Gitana.InteractionReportEntryMap, warehouse, object);
        },

        interaction: function(warehouse, object)
        {
            return this.create(Gitana.Interaction, warehouse, object);
        },

        interactionMap: function(warehouse, object)
        {
            return this.create(Gitana.InteractionMap, warehouse, object);
        },

        client: function(platform, object)
        {
            var client = this.create(Gitana.Client, platform, object);
            Gitana.stampInto(client, Gitana.ClientMethods);

            return client;
        },

        clientMap: function(platform, object)
        {
            return this.create(Gitana.ClientMap, platform, object);
        },

        authenticationGrant: function(platform, object)
        {
            return this.create(Gitana.AuthenticationGrant, platform, object);
        },

        authenticationGrantMap: function(platform, object)
        {
            return this.create(Gitana.AuthenticationGrantMap, platform, object);
        },

        billingProviderConfiguration: function(platform, object)
        {
            return this.create(Gitana.BillingProviderConfiguration, platform, object);
        },

        billingProviderConfigurationMap: function(platform, object)
        {
            return this.create(Gitana.BillingProviderConfigurationMap, platform, object);
        },



        //////////////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // REPOSITORY
        //
        //////////////////////////////////////////////////////////////////////////////////////////////////////////

        changeset: function(repository, object)
        {
            return this.create(Gitana.Changeset, repository, object);
        },

        branch: function(repository, object)
        {
            return this.create(Gitana.Branch, repository, object);
        },

        /**
         * Creates a node
         *
         * @param branch
         * @param object either object or the string type id
         */
        node: function(branch, object)
        {
            var objectClass = null;

            if (object)
            {
                // allow for object to be the type id
                if (Gitana.isString(object))
                {
                    object = {
                        "_type": object
                    };
                }

                // see if we can derive a more accurate type
                var type = object["_type"];
                if (type)
                {
                    if (Gitana.ObjectFactory.registry[type])
                    {
                        objectClass = Gitana.ObjectFactory.registry[type];
                    }
                }
                if (!objectClass)
                {
                    // allow default trip through to association for association types
                    if (type && Gitana.startsWith(type, "a:"))
                    {
                        objectClass = Gitana.Association;
                    }
                }
                if (!objectClass)
                {
                    // check out if it says its an association via special key
                    if (object.__is_association && object.__is_association())
                    {
                        objectClass = Gitana.Association;
                    }
                }
            }
            if (!objectClass)
            {
                // assume node
                objectClass = Gitana.Node;
            }

            // instantiate and set any properties
            return this.create(objectClass, branch, object);
        },

        association: function(branch, object)
        {
            return this.create(Gitana.Association, branch, object);
        },

        branchMap: function(repository, object)
        {
            return this.create(Gitana.BranchMap, repository, object);
        },

        changesetMap: function(repository, object)
        {
            return this.create(Gitana.ChangesetMap, repository, object);
        },

        nodeMap: function(branch, object)
        {
            return this.create(Gitana.NodeMap, branch, object);
        },

        definition: function(branch, object)
        {
            return this.create(Gitana.Definition, branch, object);
        },

        form: function(branch, object)
        {
            return this.create(Gitana.Form, branch, object);
        },

        traversalResults: function(branch, object)
        {
            return this.create(Gitana.TraversalResults, branch, object);
        },



        //////////////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // DOMAINS
        //
        //////////////////////////////////////////////////////////////////////////////////////////////////////////

        domainPrincipal: function(domain, object)
        {
            // create the principal
            var principal = this.create(Gitana.DomainPrincipal, domain, object);

            // extend the principal pre-emptively if we have an object
            if (object)
            {
                this.extendPrincipal(principal);
            }

            return principal;
        },

        domainPrincipalMap: function(domain, object)
        {
            return this.create(Gitana.PrincipalMap, domain, object);
        },

        extendPrincipal: function(principal)
        {
            if (principal.getType() && principal.objectType() == "Gitana.DomainPrincipal")
            {
                if (principal.getType() == "USER")
                {
                    Gitana.stampInto(principal, Gitana.DomainUser);
                }
                else if (principal.getType() == "GROUP")
                {
                    Gitana.stampInto(principal, Gitana.DomainGroup);
                }
            }
        },



        //////////////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // VAULTS
        //
        //////////////////////////////////////////////////////////////////////////////////////////////////////////

        archive: function(vault, object)
        {
            return this.create(Gitana.Archive, vault, object);
        },

        archiveMap: function(vault, object)
        {
            return this.create(Gitana.ArchiveMap, vault, object);
        },



        //////////////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // MISCELLANEOUS
        //
        //////////////////////////////////////////////////////////////////////////////////////////////////////////

        team: function(cluster, teamable, object)
        {
            return new Gitana.Team(cluster, teamable, object);
        },

        teamMap: function(cluster, teamable, object)
        {
            return new Gitana.TeamMap(cluster, teamable, object);
        },

        activity: function(datastore, object)
        {
            return new Gitana.Activity(datastore, object);
        },

        activityMap: function(datastore, object)
        {
            return new Gitana.ActivityMap(datastore, object);
        },

        role: function(cluster, roleContainer, object)
        {
            return new Gitana.Role(cluster, roleContainer, object);
        },

        roleMap: function(cluster, roleContainer, object)
        {
            return new Gitana.RoleMap(cluster, roleContainer, object);
        },


        //////////////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // REGISTRAR
        //
        //////////////////////////////////////////////////////////////////////////////////////////////////////////

        tenant: function(registrar, object)
        {
            return this.create(Gitana.Tenant, registrar, object);
        },

        tenantMap: function(registrar, object)
        {
            return this.create(Gitana.TenantMap, registrar, object);
        },

        plan: function(registrar, object)
        {
            return this.create(Gitana.Plan, registrar, object);
        },

        planMap: function(registrar, object)
        {
            return this.create(Gitana.PlanMap, registrar, object);
        },

        meter: function(registrar, object)
        {
            return this.create(Gitana.Meter, registrar, object);
        },

        meterMap: function(registrar, object)
        {
            return this.create(Gitana.MeterMap, registrar, object);
        },




        //////////////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // DIRECTORY
        //
        //////////////////////////////////////////////////////////////////////////////////////////////////////////

        identity: function(directory, object)
        {
            return this.create(Gitana.Identity, directory, object);
        },

        identityMap: function(directory, object)
        {
            return this.create(Gitana.IdentityMap, directory, object);
        },

        connection: function(directory, object)
        {
            return this.create(Gitana.Connection, directory, object);
        },

        connectionMap: function(directory, object)
        {
            return this.create(Gitana.ConnectionMap, directory, object);
        }


    });

    // static methods for registration
    Gitana.ObjectFactory.registry = { };
    Gitana.ObjectFactory.register = function(qname, objectClass)
    {
        Gitana.ObjectFactory.registry[qname] = objectClass;
    };

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.AbstractPersistable = Gitana.Chainable.extend(
    /** @lends Gitana.AbstractPersistable.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.Chainable
         *
         * @class Abstract base class for abstract objects and maps
         *
         * @param {Gitana} driver Gitana driver
         * @param [Object] object
         */
        constructor: function(driver, object)
        {
            this.base(driver);

            // auto-load response
            if (object)
            {
                this.handleResponse.call(this, object);
            }
        },

        /**
         * @EXTENSION_POINT
         *
         * Convert the json response object into the things we want to preserve on the object.
         * This should set the "object" property but may choose to set other properties as well.
         *
         * @param response
         */
        handleResponse: function(response)
        {
            // remove our properties (not functions)
            Gitana.deleteProperties(this, false);

            // special handling - if response contains "_ref", remove it
            if (response["_ref"]) {
                delete response["_ref"];
            }

            // copy properties
            Gitana.copyInto(this, response);

            // handle any system properties
            this.handleSystemProperties(response);
        },

        /**
         * Gets called after the response is handled and allows the object to pull out special values from
         * the "object" field so that they don't sit on the JSON object
         */
        handleSystemProperties: function(response)
        {
            // utilize the chainCopyState method in case the response is a Gitana object
            this.chainCopyState(response);
        },

        /**
         * Hands back a cleanup, properties-only JSON simple object.
         */
        json: function()
        {
            return JSON.parse(JSON.stringify(this));
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.AbstractMap = Gitana.AbstractPersistable.extend(
    /** @lends Gitana.AbstractMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPersistable
         *
         * @class Abstract base class for a map of Gitana objects
         *                   f
         * @param {Gitana} driver
         * @param [Object] object
         */
        constructor: function(driver, object)
        {
            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            // auto-manage a list of keys
            this.__keys = (function() {
                var list = [];
                return function(x) {
                    if (!Gitana.isUndefined(x)) {
                        if (x == 'empty') {
                            while (list.length > 0) { list.shift(); }
                        } else {
                            if (!x && x.length) {
                                for (var i = 0; i < x.length; i++) {
                                    list.push(x[i]);
                                }
                            }
                            else
                            {
                                list.push(x);
                            }
                        }
                    }
                    return list;
                };
            })();

            this.__totalRows = (function() {
                var _totalRows = null;
                return function(totalRows) {
                    if (!Gitana.isUndefined(totalRows)) { _totalRows = totalRows; }
                    return _totalRows;
                };
            })();

            this.__size = (function() {
                var _size = null;
                return function(size) {
                    if (!Gitana.isUndefined(size)) { _size = size; }
                    return _size;
                };
            })();

            this.__offset = (function() {
                var _offset = 0;
                return function(offset) {
                    if (!Gitana.isUndefined(offset) && offset >= 0) { _offset = offset; }
                    return _offset;
                };
            })();

            this.base(driver, object);

            // in case the incoming object is a state-carrying object (like another map)
            if (object)
            {
                this.chainCopyState(object);
            }
        },

        /**
         * Override to include:
         *
         *   __keys
         *   __totalRows
         *   __size
         *   __offset
         *
         * @param otherObject
         */
        chainCopyState: function(otherObject)
        {
            this.base(otherObject);

            // include keys
            if (otherObject.__keys) {
                this.__keys('empty');
                for (var i = 0; i < otherObject.__keys().length; i++)
                {
                    var k = otherObject.__keys()[i];
                    this.__keys().push(k);
                }
            }

            if (otherObject.__totalRows) {
                this.__totalRows(otherObject.__totalRows());
            }
            if (otherObject.__size) {
                this.__size(otherObject.__size());
            }
            if (otherObject.__offset) {
                this.__offset(otherObject.__offset());
            }

        },

        clear: function()
        {
            // clear object properties (but not member functions)
            Gitana.deleteProperties(this, false);

            // empty keys
            this.__keys('empty');
        },

        /**
         * @override
         *
         * Convert the json response object into the things we want to preserve on the object.
         * This should set the "object" property but may choose to set other properties as well.
         *
         * @param response
         */
        handleResponse: function(response)
        {
            this.clear();

            if (response)
            {
                // is it a gitana map?
                if (response.totalRows && response.size && response.offset) {
                    this.__totalRows(response.totalRows());
                    this.__size(response.size());
                    this.__offset(response.offset());
                }
                else
                {
                    // otherwise assume it is a gitana result set
                    this.__totalRows(response["total_rows"]);
                    this.__size(response["size"]);
                    this.__offset(response["offset"]);
                }

                if (response.rows)
                {
                    // parse array
                    if (Gitana.isArray(response.rows))
                    {
                        for (var i = 0; i < response.rows.length; i++)
                        {
                            var o = this.buildObject(response.rows[i]);
                            this[o.getId()] = o;

                            this.__keys().push(o.getId());
                        }
                    }
                    else
                    {
                        // parse object
                        for (var key in response.rows)
                        {
                            if (response.rows.hasOwnProperty(key) && !Gitana.isFunction(response.rows[key]))
                            {
                                var value = response.rows[key];

                                var o = this.buildObject(value);

                                // determine key
                                var k = (o.getId && o.getId());
                                if (!k) {
                                    k = key;
                                }
                                this[k] = o;

                                this.__keys().push(k);
                            }
                        }
                    }
                    this.__size(this.__keys().length);
                }
                else
                {
                    // otherwise, assume it is key/value pairs
                    // it also might be another Gitana Map

                    for (var key in response)
                    {
                        if (response.hasOwnProperty(key) && !Gitana.isFunction(response[key]))
                        {
                            var value = response[key];

                            var o = this.buildObject(value);

                            // determine key
                            var k = (o.getId && o.getId());
                            if (!k) {
                                k = key;
                            }
                            this[k] = o;

                            this[k] = o;

                            this.__keys().push(k);
                        }
                    }
                    this.__size(this.__keys().length);
                }
            }
        },

        /**
         * @abstract
         * ABSTRACT METHOD
         *
         * @param json
         */
        buildObject: function(json)
        {

        },

        get: function(key)
        {
            return this[key];
        },

        asArray: function()
        {
            var array = [];
            for (var i = 0; i < this.__keys().length; i++)
            {
                var k = this.__keys()[i];

                array.push(this[k]);
            }

            return array;
        },

        size: function(callback)
        {
            if (callback)
            {
                return this.then(function() {
                    callback.call(this, this.__size());
                });
            }

            return this.__size();
        },

        offset: function(callback)
        {
            if (callback)
            {
                return this.then(function() {
                    callback.call(this, this.__offset());
                });
            }

            return this.__offset();
        },

        totalRows: function(callback)
        {
            if (callback)
            {
                return this.then(function() {
                    callback.call(this, this.__totalRows());
                });
            }

            return this.__totalRows();
        },


        /**
         * Iterates over the map and fires the callback function in SERIAL for each element in the map.
         * The scope for the callback is the object from the map (i.e. repository object, node object).
         *
         * The arguments to the callback function are (key, value) where value is the same as "this".
         *
         * NOTE: This works against elements in the map in SERIAL.  One at a time.  If you are doing concurrent
         * remote operations for members of the set such that each operation is independent, you may want to use
         * the eachX() method.
         *
         * @chained this
         *
         * @param callback
         */
        each: function(callback)
        {
            return this.then(function() {

                // run functions
                for (var i = 0; i < this.__keys().length; i++)
                {
                    // key and value from the map
                    var key = this.__keys()[i];
                    var value = this[key];

                    // a function that fires our callback
                    // wrap in a closure so that we store the callback and key
                    // note: this = the value wrapped in a chain, so we don't pass in value
                    var f = function(callback, key, index, map)
                    {
                        return function()
                        {
                            callback.call(this, key, this, index);

                            // manually copy resulting value back
                            Gitana.deleteProperties(map[key]);
                            Gitana.copyInto(map[key], this);
                        };

                    }(callback, key, i, this);

                    // create subchain mounted on this chainable and the run function
                    this.subchain(value).then(f);
                }

                return this;
            });
        },

        /**
         * Iterates over the map and fires the callback function in PARALLEL for each element in the map.
         * The scope for the callback is the object from the map (i.e. repository object, node object).
         *
         * The arguments to the callback function are (key, value) where value is the same as "this".
         *
         * NOTE: This works against elements in the map in PARALLEL.  All map members are fired against at the same
         * time on separate timeouts.  There is no guaranteed order for their completion.  If you require serial
         * execution, use the each() method.
         *
         * @chained
         *
         * @param callback
         */
        eachX: function(callback)
        {
            return this.then(function() {

                // create an array of functions that invokes the callback for each element in the array
                var functions = [];
                for (var i = 0; i < this.__keys().length; i++)
                {
                    var key = this.__keys()[i];
                    var value = this[key];

                    var f = function(callback, key, value, index) {

                        return function()
                        {
                            // NOTE: we're running a parallel chain that is managed for us by the Chain then() method.
                            // we can't change the parallel chain but we can subchain from it
                            // in our subchain we run our method
                            // the parallel chain kind of acts like one-hop noop so that we can take over and do our thing
                            this.subchain(value).then(function() {
                                callback.call(this, key, this, index);
                            });
                        };

                    }(callback, key, value, i);

                    functions.push(f);
                }

                // kick off all these functions in parallel
                // adding them to the subchain
                return this.then(functions);
            });
        },

        /**
         * Iterates over the map and applies the callback filter function to each element.
         * It should hand back true if it wants to keep the value and false to remove it.
         *
         * NOTE: the "this" for the callback is the object from the map.
         *
         * @chained
         *
         * @param callback
         */
        filter: function(callback)
        {
            return this.then(function() {

                var keysToKeep = [];
                var keysToRemove = [];

                for (var i = 0; i < this.__keys().length; i++)
                {
                    var key = this.__keys()[i];
                    var object = this[key];

                    var keepIt = callback.call(object);
                    if (keepIt)
                    {
                        keysToKeep.push(key);
                    }
                    else
                    {
                        keysToRemove.push(key);
                    }
                }

                // remove any keys we don't want from the map
                for (var i = 0; i < keysToRemove.length; i++)
                {
                    delete this[keysToRemove[i]];
                }

                // swap keys to keep
                // NOTE: we first clear the keys but we can't use slice(0,0) since that produces a NEW array
                // instead, do this shift trick
                this.__keys('empty');
                for (var i = 0; i < keysToKeep.length; i++)
                {
                    this.__keys().push(keysToKeep[i]);
                }
            });
        },

        /**
         * Applies a comparator to sort the map.
         *
         * If no comparator is applied, the map will be sorted by its modification timestamp (if possible).
         *
         * The comparator can be a string that uses dot-notation to identify a field in the JSON that
         * should be sorted.  (example: "title" or "property1.property2.property3")
         *
         * Finally, the comparator can be a function.  It takes (previousValue, currentValue) and hands back:
         *   -1 if the currentValue is less than the previousValue (should be sorted lower)
         *   0 if they are equivalent
         *   1 if they currentValue is greater than the previousValue (should be sorted higher)
         *
         * @chained
         *
         * @param comparator
         */
        sort: function(comparator)
        {
            return this.then(function() {

                // build a temporary array of values
                var array = [];
                for (var i = 0; i < this.__keys().length; i++) {
                    var key = this.__keys()[i];
                    array.push(this[key]);
                }

                // sort the array
                array.sort(comparator);

                // now reset keys according to the order of the array
                this.__keys("empty");
                for (var i = 0; i < array.length; i++)
                {
                    this.__keys().push(array[i].getId());
                }

            });
        },

        /**
         * Limits the number of elements in the map.
         *
         * @chained
         *
         * @param size
         */
        limit: function(size)
        {
            return this.then(function() {

                var keysToRemove = [];

                if (size > this.__keys().length)
                {
                    // keep everything
                    return;
                }

                // figure out which keys to remove
                for (var i = 0; i < this.__keys().length; i++)
                {
                    if (i >= size)
                    {
                        keysToRemove.push(this.__keys()[i]);
                    }
                }

                // truncate the keys
                // NOTE: we can't use slice here since that produces a new array
                while (this.__keys().length > size)
                {
                    this.__keys().pop();
                }

                // remove any keys to remove from map
                for (var i = 0; i < keysToRemove.length; i++)
                {
                    delete this[keysToRemove[i]];
                }

                // reset the size
                this.__size(this.__keys().length);
            });
        },

        /**
         * Paginates elements in the map.
         *
         * @chained
         *
         * @param pagination
         */
        paginate: function(pagination)
        {
            return this.then(function() {

                var skip = pagination.skip;
                var limit = pagination.limit;

                var keysToRemove = [];

                // figure out which keys to remove
                for (var i = 0; i < this.__keys().length; i++)
                {
                    if (i < skip || i >= skip + limit)
                    {
                        keysToRemove.push(this.__keys()[i]);
                    }
                }

                // truncate the keys
                // NOTE: we can't use slice here since that produces a new array
                while (this.__keys().length > limit + skip)
                {
                    this.__keys().pop();
                }

                // remove any keys to remove from map
                for (var i = 0; i < keysToRemove.length; i++)
                {
                    delete this[keysToRemove[i]];
                }

                // reset the limit
                this.__size(this.__keys().length);
            });
        },

        /**
         * Counts the number of elements in the map and fires it into a callback function.
         */
        count: function(callback)
        {
            if (callback)
            {
                return this.then(function() {
                    callback.call(this, this.__keys().length);
                });
            }

            return this.__keys().length;
        },

        /**
         * Keeps the first element in the map
         */
        keepOne: function(emptyHandler)
        {
            var self = this;

            var json = {};
            if (this.__keys().length > 0)
            {
                json = this[this.__keys()[0]];
            }

            var chainable = this.buildObject(json);

            return this.subchain(chainable).then(function() {

                var chain = this;

                this.subchain(self).then(function() {

                    if (this.__keys().length > 0)
                    {
                        var obj = this[this.__keys()[0]];

                        if (chain.loadFrom)
                        {
                            // for objects, like nodes or branches
                            chain.loadFrom(obj);
                        }
                        else
                        {
                            // non-objects? (i.e. binary or attachment maps)
                            chain.handleResponse(obj);
                        }
                    }
                    else
                    {
                        var err = new Gitana.Error();
                        err.name = "Empty Map";
                        err.message = "The map doesn't have any elements in it";

                        if (emptyHandler)
                        {
                            return emptyHandler.call(self, err);
                        }
                        else
                        {
                            this.error(err);
                        }
                    }

                });
            });
        },

        /**
         * Selects an individual element from the map and continues the chain.
         *
         * @param key
         */
        select: function(key)
        {
            var self = this;

            var json = {};
            if (this[key])
            {
                json = this[key];
            }

            // what we hand back
            var result = this.subchain(this.buildObject(json));

            // preload some work
            return result.then(function() {

                var chain = this;

                this.subchain(self).then(function() {

                    var obj = this[key];
                    if (!obj)
                    {
                        var err = new Gitana.Error();
                        err.name = "No element with key: " + key;
                        err.message = err.name;

                        this.error(err);

                        return false;
                    }

                    if (result.loadFrom)
                    {
                        // for objects, like nodes or branches
                        chain.loadFrom(obj);
                    }
                    else
                    {
                        // non-objects? (i.e. binary or attachment maps)
                        chain.handleResponse(obj);
                    }

                });
            });
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.AbstractObject = Gitana.AbstractPersistable.extend(
    /** @lends Gitana.AbstractObject.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPersistable
         *
         * @class Abstract base class for Gitana document objects.
         *
         * @param {Gitana} driver
         * @param [Object] object
         */
        constructor: function(driver, object)
        {
            this.__system = (function() {
                var _system = new Gitana.SystemMetadata();
                return function(system) {
                    if (!Gitana.isUndefined(system)) { _system.updateFrom(system); }
                    return _system;
                };
            })();




            ///////////////////////////////////////////////////////////////////////////////////////////////
            //
            // INSTANCE CHAINABLE METHODS
            //
            ///////////////////////////////////////////////////////////////////////////////////////////////

            /**
             * Executes an HTTP delete for this object and continues the chain with the chainable.
             *
             * @param chainable
             * @param uri
             * @param params
             */
            this.chainDelete = function(chainable, uri, params)
            {
                var self = this;

                return this.link(chainable).then(function() {

                    var chain = this;

                    // allow for closures on uri for late resolution
                    if (Gitana.isFunction(uri)) {
                        uri = uri.call(self);
                    }

                    // delete
                    chain.getDriver().gitanaDelete(uri, params, function() {
                        chain.next();
                    }, function(http) {
                        self.httpError(http);
                    });

                    // NOTE: we return false to tell the chain that we'll manually call next()
                    return false;
                });
            };

            /**
             * Reloads this object from the server and then passes control to the chainable.
             *
             * @param uri
             * @param params
             */
            this.chainReload = function(chainable, uri, params)
            {
                var self = this;

                return this.link(chainable).then(function() {

                    var chain = this;

                    // allow for closures on uri for late resolution
                    if (Gitana.isFunction(uri)) {
                        uri = uri.call(self);
                    }

                    // reload
                    chain.getDriver().gitanaGet(uri, params, {}, function(obj) {
                        chain.handleResponse(obj);
                        chain.next();
                    }, function(http) {
                        self.httpError(http);
                    });

                    // NOTE: we return false to tell the chain that we'll manually call next()
                    return false;
                });
            };

            /**
             * Executes an update (write + read) of this object and then passes control to the chainable.
             *
             * @param chainable
             * @param uri
             * @param params
             */
            this.chainUpdate = function(chainable, uri, params)
            {
                var self = this;

                return this.link(chainable).then(function() {

                    var chain = this;

                    // allow for closures on uri for late resolution
                    if (Gitana.isFunction(uri)) {
                        uri = uri.call(self);
                    }

                    // delete
                    chain.getDriver().gitanaPut(uri, params, chain, function() {
                        chain.getDriver().gitanaGet(uri, params, {}, function(obj) {
                            chain.handleResponse(obj);
                            chain.next();
                        }, function(http) {
                            self.httpError(http);
                        });
                    }, function(http) {
                        self.httpError(http);
                    });

                    // NOTE: we return false to tell the chain that we'll manually call next()
                    return false;
                });
            };


            // finally chain to parent prototype
            this.base(driver, object);
        },

        /**
         * Override to include:
         *
         *   __system
         *
         * @param otherObject
         */
        chainCopyState: function(otherObject)
        {
            this.base(otherObject);

            // include __system properties?
            if (otherObject.__system) {
                this.__system(otherObject.__system());
            }
        },

        /**
         * @EXTENSION_POINT
         */
        getUri: function()
        {
            return null;
        },

        /**
         * @ABSTRACT
         *
         * To be implemented by object implementations.
         */
        getType: function()
        {
            return null;
        },

        /**
         * Hands back the URI of this object as referenced by the browser.
         */
        getProxiedUri: function()
        {
            return this.getDriver().baseURL + this.getUri();
        },

        /**
         * Get a json property
         *
         * @param key
         */
        get: function(key)
        {
            return this[key];
        },

        /**
         * Set a json property
         *
         * @param key
         * @param value
         */
        set: function(key ,value)
        {
            this[key] = value;
        },

        /**
         * Hands back the ID ("_doc") of this object.
         *
         * @public
         *
         * @returns {String} id
         */
        getId: function()
        {
            return this.get("_doc");
        },

        /**
         * Hands back the system metadata for this object.
         *
         * @public
         *
         * @returns {Gitana.SystemMetadata} system metadata
         */
        getSystemMetadata: function()
        {
            return this.__system();
        },

        /**
         * The title for the object.
         *
         * @public
         *
         * @returns {String} the title
         */
        getTitle: function()
        {
            return this.get("title");
        },

        /**
         * The description for the object.
         *
         * @public
         *
         * @returns {String} the description
         */
        getDescription: function()
        {
            return this.get("description");
        },

        // TODO: this is a temporary workaround at the moment
        // it has to do all kinds of special treatment for _ variables because these variables are
        // actually system managed but they're on the top level object.
        //
        // TODO:
        // 1) gitana repo system managed properties should all be under _system
        // 2) the system block should be pulled off the object on read and not required on write

        /**
         * Replaces all of the properties of this object with those of the given object.
         * This method should be used to update the state of this object.
         *
         * Any functions from the incoming object will not be copied.
         *
         * @public
         *
         * @param object {Object} object containing the properties
         */
        replacePropertiesWith: function(object)
        {
            // create a copy of the incoming object
            var candidate = {};
            Gitana.copyInto(candidate, object);

            // we don't allow the following values to be replaced
            var backups = {};
            backups["_doc"] = this["_doc"];
            delete candidate["_doc"];
            backups["_type"] = this["_type"];
            delete candidate["_type"];
            backups["_qname"] = this["_qname"];
            delete candidate["_qname"];

            // remove our properties (not functions)
            Gitana.deleteProperties(this, false);

            // restore
            this["_doc"] = backups["_doc"];
            this["_type"] = backups["_type"];
            this["_qname"] = backups["_qname"];

            // copy in candidate properties
            Gitana.copyInto(this, candidate);
        },

        /**
         * @override
         */
        handleSystemProperties: function(response)
        {
            this.base(response);

            if (this["_system"])
            {
                // strip out system metadata
                var json = this["_system"];
                delete this["_system"];

                // update system properties
                this.__system().updateFrom(json);
            }
        },

        /**
         * Helper function to convert the object portion to JSON
         *
         * @param pretty
         */
        stringify: function(pretty)
        {
            return Gitana.stringify(this, pretty);
        },

        /**
         * Helper method that loads this object from another object of the same type.
         *
         * For example, loading a node from another loaded node.
         *
         * @param anotherObject
         */
        loadFrom: function(anotherObject)
        {
            this.handleResponse(anotherObject);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.AbstractSelfableObject = Gitana.AbstractObject.extend(
    /** @lends Gitana.AbstractSelfableObject.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractObject
         *
         * @class Abstract base class for selfable Gitana document objects.
         *
         * @param {Gitana} driver
         * @param [Object] object
         */
        constructor: function(driver, object)
        {
            // finally chain to parent prototype
            this.base(driver, object);
        },



        //////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // SELFABLE
        //
        //////////////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Delete
         *
         * @chained this
         *
         * @public
         */
        del: function()
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri();
            };

            // NOTE: pass control back to the server instance
            return this.chainDelete(this.getPlatform(), uriFunction);
        },

        /**
         * Reload
         *
         * @chained this
         *
         * @public
         */
        reload: function()
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri();
            };

            return this.chainReload(null, uriFunction);
        },

        /**
         * Update
         *
         * @chained this
         *
         * @public
         */
        update: function()
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri();
            };

            return this.chainUpdate(null, uriFunction);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.AbstractSelfableACLObject = Gitana.AbstractSelfableObject.extend(
    /** @lends Gitana.AbstractSelfableACLObject.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractSelfableObject
         *
         * @class Abstract base class for selfable ACL Gitana document objects.
         *
         * @param {Gitana} driver
         * @param [Object] object
         */
        constructor: function(driver, object)
        {
            // finally chain to parent prototype
            this.base(driver, object);
        },



        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // ACL METHODS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Retrieve full ACL and pass into chaining method.
         *
         * @chained this
         *
         * @param callback
         */
        loadACL: function(callback)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/acl/list";
            };

            return this.chainGetResponse(this, uriFunction).then(function(response) {
                callback.call(this, response);
            });
        },

        /**
         * Retrieve list of authorities and pass into chaining method.
         *
         * @chained this
         *
         * @param {Gitana.DomainPrincipal|String} principal the principal or the principal id
         * @param callback
         */
        listAuthorities: function(principal, callback)
        {
            var principalDomainQualifiedId = this.extractPrincipalDomainQualifiedId(principal);

            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/acl?id=" + principalDomainQualifiedId;
            };

            return this.chainGetResponseRows(this, uriFunction).then(function(response) {
                callback.call(this, response);
            });
        },

        /**
         * Checks whether the given principal has a granted authority for this object.
         * This passes the result (true/false) to the chaining function.
         *
         * @chained this
         *
         * @param {Gitana.DomainPrincipal|String} principal the principal or the principal id
         * @param {String} authorityId the id of the authority
         * @param callback
         */
        checkAuthority: function(principal, authorityId, callback)
        {
            var principalDomainQualifiedId = this.extractPrincipalDomainQualifiedId(principal);

            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/authorities/" + authorityId + "/check?id=" + principalDomainQualifiedId;
            };

            return this.chainPostResponse(this, uriFunction).then(function(response) {
                callback.call(this, response["check"]);
            });
        },

        /**
         * Grants an authority to a principal against this object.
         *
         * @chained this
         *
         * @param {Gitana.DomainPrincipal|String} principal the principal or the principal id
         * @param {String} authorityId the id of the authority
         */
        grantAuthority: function(principal, authorityId)
        {
            var principalDomainQualifiedId = this.extractPrincipalDomainQualifiedId(principal);

            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/authorities/" + authorityId + "/grant?id=" + principalDomainQualifiedId;
            };

            return this.chainPostEmpty(null, uriFunction);
        },

        /**
         * Revokes an authority from a principal against this object.
         *
         * @chained this
         *
         * @param {Gitana.DomainPrincipal|String} principal the principal or the principal id
         * @param {String} authorityId the id of the authority
         */
        revokeAuthority: function(principal, authorityId)
        {
            var principalDomainQualifiedId = this.extractPrincipalDomainQualifiedId(principal);

            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/authorities/" + authorityId + "/revoke?id=" + principalDomainQualifiedId;
            };

            return this.chainPostEmpty(null, uriFunction);
        },

        /**
         * Revokes all authorities for a principal against the server.
         *
         * @chained this
         *
         * @param {Gitana.Principal|String} principal the principal or the principal id
         */
        revokeAllAuthorities: function(principal)
        {
            return this.revokeAuthority(principal, "all");
        },

        /**
         * Loads the authority grants for a given set of principals.
         *
         * @chained this
         *
         * @param callback
         */
        loadAuthorityGrants: function(principalIds, callback)
        {
            if (!principalIds)
            {
                principalIds = [];
            }

            var json = {
                "principals": principalIds
            };

            return this.chainPostResponse(this, this.getUri() + "/authorities", {}, json).then(function(response) {
                callback.call(this, response);
            });
        },

        /**
         * Checks whether the given principal has a permission against this object.
         * This passes the result (true/false) to the chaining function.
         *
         * @chained this
         *
         * @param {Gitana.DomainPrincipal|String} principal the principal or the principal id
         * @param {String} permissionId the id of the permission
         * @param callback
         */
        checkPermission: function(principal, permissionId, callback)
        {
            var principalDomainQualifiedId = this.extractPrincipalDomainQualifiedId(principal);

            var uriFunction = function()
            {
                return self.getUri() + "/permissions/" + permissionId + "/check?id=" + principalDomainQualifiedId;
            };

            return this.chainPostResponse(this, uriFunction).then(function(response) {
                callback.call(this, response["check"]);
            });
        }


        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // END OF ACL METHODS
        //
        //////////////////////////////////////////////////////////////////////////////////////////


    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.DataStore = Gitana.AbstractObject.extend(
    /** @lends Gitana.DataStore.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractObject
         *
         * @class DataStore
         *
         * @param {Gitana} driver
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(driver, object)
        {
            this.base(driver, object);
        },

        /**
         * @ABSTRACT
         *
         * To be implemented by data store implementations.
         */
        getUri: function()
        {
            return null;
        },

        /**
         * @ABSTRACT
         *
         * To be implemented by data store implementations.
         */
        getType: function()
        {
            return null;
        },



        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // ACL METHODS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Retrieve full ACL and pass into chaining method.
         *
         * @chained this
         *
         * @param callback
         */
        loadACL: function(callback)
        {
            var uriFunction = function()
            {
                return this.getUri() + "/acl/list";
            };

            return this.chainGetResponse(this, uriFunction).then(function(response) {
                callback.call(this, response);
            });
        },

        /**
         * Retrieve list of authorities and pass into chaining method.
         *
         * @chained this
         *
         * @param {Gitana.Principal|String} principal the principal or the principal id
         * @param callback
         */
        listAuthorities: function(principal, callback)
        {
            var principalDomainQualifiedId = this.extractPrincipalDomainQualifiedId(principal);

            var uriFunction = function()
            {
                return this.getUri() + "/acl?id=" + principalDomainQualifiedId;
            };

            return this.chainGetResponseRows(this, uriFunction).then(function(response) {
                callback.call(this, response);
            });
        },

        /**
         * Checks whether the given principal has a granted authority for this object.
         * This passes the result (true/false) to the chaining function.
         *
         * @chained this
         *
         * @param {Gitana.Principal|String} principal the principal or the principal id
         * @param {String} authorityId the id of the authority
         * @param callback
         */
        checkAuthority: function(principal, authorityId, callback)
        {
            var principalDomainQualifiedId = this.extractPrincipalDomainQualifiedId(principal);

            var uriFunction = function()
            {
                return this.getUri() + "/authorities/" + authorityId + "/check?id=" + principalDomainQualifiedId;
            };

            return this.chainPostResponse(this, uriFunction).then(function(response) {
                callback.call(this, response["check"]);
            });
        },

        /**
         * Grants an authority to a principal against this object.
         *
         * @chained this
         *
         * @param {Gitana.Principal|String} principal the principal or the principal id
         * @param {String} authorityId the id of the authority
         */
        grantAuthority: function(principal, authorityId)
        {
            var principalDomainQualifiedId = this.extractPrincipalDomainQualifiedId(principal);

            var uriFunction = function()
            {
                return this.getUri() + "/authorities/" + authorityId + "/grant?id=" + principalDomainQualifiedId;
            };

            return this.chainPostEmpty(null, uriFunction);
        },

        /**
         * Revokes an authority from a principal against this object.
         *
         * @chained this
         *
         * @param {Gitana.Principal|String} principal the principal or the principal id
         * @param {String} authorityId the id of the authority
         */
        revokeAuthority: function(principal, authorityId)
        {
            var principalDomainQualifiedId = this.extractPrincipalDomainQualifiedId(principal);

            var uriFunction = function()
            {
                return this.getUri() + "/authorities/" + authorityId + "/revoke?id=" + principalDomainQualifiedId;
            };

            return this.chainPostEmpty(null, uriFunction);
        },

        /**
         * Revokes all authorities for a principal against the server.
         *
         * @chained server
         *
         * @param {Gitana.Principal|String} principal the principal or the principal id
         */
        revokeAllAuthorities: function(principal)
        {
            return this.revokeAuthority(principal, "all");
        },

        /**
         * Loads the authority grants for a given set of principals.
         *
         * @chained repository
         *
         * @param callback
         */
        loadAuthorityGrants: function(principalIds, callback)
        {
            if (!principalIds)
            {
                principalIds = [];
            }

            var json = {
                "principals": principalIds
            };

            return this.chainPostResponse(this, this.getUri() + "/authorities", {}, json).then(function(response) {
                callback.call(this, response);
            });
        },

        /**
         * Checks whether the given principal has a permission against this object.
         * This passes the result (true/false) to the chaining function.
         *
         * @chained this
         *
         * @param {Gitana.Principal|String} principal the principal or the principal id
         * @param {String} permissionId the id of the permission
         * @param callback
         */
        checkPermission: function(principal, permissionId, callback)
        {
            var principalDomainQualifiedId = this.extractPrincipalDomainQualifiedId(principal);

            var uriFunction = function()
            {
                return this.getUri() + "/permissions/" + permissionId + "/check?id=" + principalDomainQualifiedId;
            };

            return this.chainPostResponse(this, uriFunction).then(function(response) {
                callback.call(this, response["check"]);
            });
        },


        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // END OF ACL METHODS
        //
        //////////////////////////////////////////////////////////////////////////////////////////



        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // TEAMABLE
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Reads a team.
         *
         * @param teamKey
         *
         * @chainable team
         */
        readTeam: function(teamKey)
        {
            var uriFunction = function()
            {
                return this.getUri() + "/teams/" + teamKey;
            };

            var chainable = this.getFactory().team(this.getPlatform(), this);
            return this.chainGet(chainable, uriFunction);
        },

        /**
         * Lists teams.
         *
         * @chainable map of teams
         */
        listTeams: function()
        {
            var uriFunction = function()
            {
                return this.getUri() + "/teams";
            };

            var chainable = this.getFactory().teamMap(this.getCluster(), this);
            return this.chainGet(chainable, uriFunction);
        },

        /**
         * Creates a team.
         *
         * @param teamKey
         * @param object
         *
         * @chainable team
         */
        createTeam: function(teamKey, object)
        {
            if (!object)
            {
                object = {};
            }

            var uriFunction = function()
            {
                return this.getUri() + "/teams?key=" + teamKey;
            };

            var self = this;

            var chainable = this.getFactory().team(this.getPlatform(), this);
            return this.chainPostResponse(chainable, uriFunction, {}, object).then(function() {

                var chain = this;

                Chain(self).readTeam(teamKey).then(function() {
                    chain.handleResponse(this);
                    chain.next();
                });

                // we manually advance the chain
                return false;
            });
        },

        /**
         * Gets the owners team
         *
         * @chained team
         */
        readOwnersTeam: function()
        {
            return this.readTeam("owners");
        },

        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // END OF TEAMABLE
        //
        //////////////////////////////////////////////////////////////////////////////////////////




        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // ACTIVITIES
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists activities.
         *
         * @chained activity map
         *
         * @param [Object] pagination pagination (optional)
         */
        listActivities: function(pagination)
        {
            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var chainable = this.getFactory().activityMap(this);
            return this.chainGet(chainable, "/activities", params);
        },

        /**
         * Read an activity.
         *
         * @chained activity
         *
         * @param {String} activityId the activity id
         */
        readActivity: function(activityId)
        {
            var chainable = this.getFactory().activity(this);
            return this.chainGet(chainable, "/activities/" + activityId);
        },

        /**
         * Queries for activities.
         *
         * @chained activity map
         *
         * @param {Object} query query.
         * @param [Object] pagination pagination (optional)
         */
        queryActivities: function(query, pagination)
        {
            var chainable = this.getFactory().activityMap(this);

            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            return this.chainPost(chainable, "/activities/query", params, query);
        },




        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // ROLE CONTAINER
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Reads a role.
         *
         * @param roleKeyOrId
         * @param inherited whether to check inherited role containers
         *
         * @chainable role
         */
        readRole: function(roleKeyOrId, inherited)
        {
            var params = {};

            if (inherited)
            {
                params.inherited = true;
            }

            var uriFunction = function()
            {
                return this.getUri() + "/roles/" + roleKeyOrId;
            };

            var chainable = this.getFactory().role(this.getCluster(), this);
            return this.chainGet(chainable, uriFunction, params);
        },

        /**
         * Lists roles.
         *
         * @param inherited whether to draw from inherited role containers
         *
         * @chainable map of teams
         */
        listRoles: function(inherited)
        {
            var params = {};

            if (inherited)
            {
                params.inherited = true;
            }

            var uriFunction = function()
            {
                return this.getUri() + "/roles";
            };

            var chainable = this.getFactory().roleMap(this.getCluster(), this);
            return this.chainGet(chainable, uriFunction, params);
        },

        /**
         * Creates a role.
         *
         * @param roleKey
         * @param object
         *
         * @chainable team
         */
        createRole: function(roleKey, object)
        {
            if (!object)
            {
                object = {};
            }
            object.roleKey = roleKey;

            var uriFunction = function()
            {
                return this.getUri() + "/roles";
            };

            var self = this;

            var chainable = this.getFactory().role(this.getPlatform(), this, roleKey);
            return this.chainPostResponse(chainable, uriFunction, {}, object).then(function() {
                this.subchain(self).readRole(roleKey).then(function() {
                    Gitana.copyInto(chainable, this);
                });
            });
        },

        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // END OF ROLE CONTAINER
        //
        //////////////////////////////////////////////////////////////////////////////////////////





        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // COMMON DATA STORE THINGS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        getMaxSize: function()
        {
            return this.get("maxSize");
        },

        getSize: function()
        {
            return this.get("size");
        },

        getObjectCount: function()
        {
            return this.get("objectcount");
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.ContainedDataStore = Gitana.DataStore.extend(
    /** @lends Gitana.ContainedDataStore.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.DataStore
         *
         * @class ContainedDataStore
         *
         * @param {Gitana.DataStore} container
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(container, object)
        {
            this.base(container.getDriver(), object);


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.getContainer = function()
            {
                return container;
            };

            this.getContainerId = function()
            {
                return container.getId();
            };

        },

        /**
         * Delete
         *
         * @chained container datastore
         *
         * @public
         */
        del: function()
        {
            var uriFunction = function()
            {
                return this.getUri();
            };

            // NOTE: pass control back to the container datastore instance
            return this.chainDelete(this.getContainer(), uriFunction);
        },

        /**
         * Reload
         *
         * @chained this
         *
         * @public
         */
        reload: function()
        {
            var uriFunction = function()
            {
                return this.getUri();
            };

            return this.chainReload(null, uriFunction);
        },

        /**
         * Update
         *
         * @chained this
         *
         * @public
         */
        update: function()
        {
            var uriFunction = function()
            {
                return this.getUri();
            };

            return this.chainUpdate(null, uriFunction);
        },


        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // TRANSFER
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Exports an archive.
         *
         * @chained job
         *
         * @param {Object} settings
         */
        exportArchive: function(settings)
        {
            var self = this;

            var vaultId = settings.vault;
            if (!Gitana.isString(vaultId))
            {
                vaultId = vaultId.getId();
            }
            var groupId = settings.group;
            var artifactId = settings.artifact;
            var versionId = settings.version;
            var configuration = (settings.configuration ? settings.configuration : {});
            var synchronous = (settings.async ? false : true);

            // we continue the chain with a job
            var chainable = this.getFactory().job(this.getCluster(), "export");

            // fire off import and job queue checking
            return this.link(chainable).then(function() {

                var chain = this;

                // create
                this.getDriver().gitanaPost(self.getUri() + "/export?vault=" + vaultId + "&group=" + groupId + "&artifact=" + artifactId + "&version=" + versionId + "&schedule=ASYNCHRONOUS", {}, configuration, function(response) {

                    Gitana.handleJobCompletion(chain, self.getCluster(), response.getId(), synchronous);

                }, function(http) {
                    self.httpError(http);
                });

                // NOTE: we return false to tell the chain that we'll manually call next()
                return false;
            });
        },

        /**
         * Imports an archive.
         *
         * @chained job
         *
         * @param {Object} settings
         */
        importArchive: function(settings)
        {
            var self = this;

            var vaultId = settings.vault;
            if (!Gitana.isString(vaultId))
            {
                vaultId = vaultId.getId();
            }
            var groupId = settings.group;
            var artifactId = settings.artifact;
            var versionId = settings.version;
            var configuration = (settings.configuration ? settings.configuration : {});
            var synchronous = (settings.async ? false : true);

            // we continue the chain with a job
            var chainable = this.getFactory().job(this.getCluster(), "import");

            // fire off import and job queue checking
            return this.link(chainable).then(function() {

                var chain = this;

                // create
                this.getDriver().gitanaPost(self.getUri() + "/import?vault=" + vaultId + "&group=" + groupId + "&artifact=" + artifactId + "&version=" + versionId + "&schedule=ASYNCHRONOUS", {}, configuration, function(response) {

                    Gitana.handleJobCompletion(chain, self.getCluster(), response.getId(), synchronous);

                }, function(http) {
                    self.httpError(http);
                });

                // NOTE: we return false to tell the chain that we'll manually call next()
                return false;
            });

        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;

    Gitana.BinaryAttachment = Gitana.AbstractPersistable.extend(
    /** @lends Gitana.BinaryAttachment.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPersistable
         *
         * @class Binary Attachment
         *
         * @param {Object} persistable gitana object
         * @param {Object} attachment
         */
        constructor: function(persistable, attachment)
        {
            this.base(persistable.getDriver(), attachment);

            this.objectType = function() { return "Gitana.BinaryAttachment"; };

            this.persistable = function() {
                return persistable;
            };
        },

        getId: function()
        {
            return this.attachmentId;
        },

        getLength: function()
        {
            return this.length;
        },

        getContentType: function()
        {
            return this.contentType;
        },

        getFilename: function()
        {
            return this.filename;
        },

        getUri: function()
        {
            return this.persistable().getUri() + "/attachments/" + this.getId();
        },

        getDownloadUri: function()
        {
            return this.getDriver().baseURL + this.getUri();
        },

        getPreviewUri: function(name, config)
        {
            if (!config)
            {
                config = {};
            }

            config.attachment = this.attachmentId;

            return this.persistable().getPreviewUri(name, config);
        },

        /**
         * Deletes the attachment, hands back control to the persistable.
         *
         * @chained persistable
         */
        del: function()
        {
            var self = this;

            var result = this.subchain(this.persistable());

            // our work (first in chain)
            result.subchain(self).then(function() {

                var chain = this;

                // delete the attachment
                this.getDriver().gitanaDelete(this.getUri(), null, function() {

                    chain.next();

                }, function(http) {
                    self.httpError(http);
                });

                return false;
            });

            return result;
        },

        /**
         * Downloads the attachment.
         *
         * @chained attachment
         * @param callback
         */
        download: function(callback)
        {
            var self = this;

            return this.then(function() {

                var chain = this;

                // download
                this.getDriver().gitanaDownload(this.getUri(), null, function(data) {
                    callback.call(self, data);
                    chain.next();
                }, function(http) {
                    self.httpError(http);
                });

                return false;
            });
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;

    Gitana.BinaryAttachmentMap = Gitana.AbstractMap.extend(
    /** @lends Gitana.BinaryAttachmentMap.prototype */
    {
        constructor: function(persistable, object)
        {
            this.objectType = function() { return "Gitana.BinaryAttachmentMap"; };

            this.__persistable = (function() {
                var _persistable = persistable;
                return function(p) {
                    if (!Gitana.isUndefined(p)) { _persistable = p; }
                    return _persistable;
                };
            })();

            if (!object)
            {
                object = this.__persistable().getSystemMetadata()["attachments"];
            }

            // must come at end because loading of object requires persistable() method
            this.base(this.__persistable().getDriver(), object);
        },

        /**
         * Override to include:
         *
         *   __persistable
         *
         * @param otherObject
         */
        chainCopyState: function(otherObject)
        {
            this.base(otherObject);

            if (otherObject.__persistable) {
                this.__persistable(otherObject.__persistable());
            }
        },

        /**
         * @override
         */
        clone: function()
        {
            return new Gitana.BinaryAttachmentMap(this.__persistable(), this);
        },

        /**
         * @param json
         */
        buildObject: function(attachment)
        {
            return new Gitana.BinaryAttachment(this.__persistable(), attachment);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.AuditRecord = Gitana.AbstractObject.extend(
    /** @lends Gitana.AuditRecord.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractObject
         *
         * @class AuditRecord
         *
         * @param {Object} datastore
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(datastore, object)
        {
            this.base(datastore.getCluster(), object);

            this.objectType = function() { return "Gitana.AuditRecord"; };



            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            /**
             * Gets the Gitana Data Store object.
             *
             * @inner
             *
             * @returns {Gitana.DataStore} The Gitana DataStore object
             */
            this.getDataStore = function() { return datastore; };

            /**
             * Gets the Gitana Data Store id.
             *
             * @inner
             *
             * @returns {String} The Gitana DataStore id
             */
            this.getDataStoreId = function() { return datastore.getId(); };

        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return this.datastore.getUri() + "/audit";
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().auditRecord(this.getDataStore(), this);
        },

        /**
         * @returns {String} the scope of the audit record (i.e. "NODE")
         */
        getScope: function()
        {
            return this.get("scope");
        },

        /**
         * @returns {String} the action of the audit record ("CREATE", "READ", "UPDATE", "DELETE", "MOVE", "COPY", "EXISTS")
         */
        getAction: function()
        {
            return this.get("action");
        },

        /**
         * @returns {String} the principal for the audit record
         */
        getPrincipalId: function()
        {
            return this.get("principal");
        },

        /**
         * @returns {String} method that was invoked
         */
        getMethod: function()
        {
            return this.get("method");
        },

        /**
         * @returns {String} handler
         */
        getHandler: function()
        {
            return this.get("handler");
        },

        /**
         * @returns {Object} argument descriptors
         */
        getArgs: function()
        {
            return this.get("args");
        },

        /**
         * @returns {Object} return value descriptor
         */
        getReturn: function()
        {
            return this.get("return");
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.AuditRecordMap = Gitana.AbstractMap.extend(
    /** @lends Gitana.AuditRecordMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractMap
         *
         * @class Map of audit record objects
         *
         * @param {Object} datastore
         * @param [Object] object
         */
        constructor: function(datastore, object)
        {
            this.objectType = function() { return "Gitana.AuditRecordMap"; };

            this.getDatastore = function() {
                return datastore;
            };

            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(datastore.getDriver(), object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().auditRecordMap(this.getDatastore(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().auditRecord(this.getDatastore(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.Team = Gitana.AbstractObject.extend(
    /** @lends Gitana.Team.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractObject
         *
         * @class Team
         *
         * @param {Gitana.Cluster} cluster
         * @param {Object} teamable
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(cluster, teamable, object)
        {
            this.__teamable = (function() {
                var _teamable = null;
                return function(teamable) {
                    if (!Gitana.isUndefined(teamable)) { _teamable = teamable; }
                    return _teamable;
                };
            })();

            this.__teamable(teamable);

            this.objectType = function() { return "Gitana.Team"; };

            this.getCluster = function()
            {
                return cluster;
            };

            this.base(cluster.getDriver(), object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().team(this.getCluster(), this.__teamable(), this);
        },

        getUri: function()
        {
            return this.__teamable().getUri() + "/teams/" + this.getKey();
        },

        getType: function()
        {
            return "team";
        },

        /**
         * Delete
         *
         * @chained team
         *
         * @public
         */
        del: function()
        {
            var uriFunction = function()
            {
                return this.getUri();
            };

            // NOTE: pass control back to the teamable
            return this.chainDelete(this.__teamable(), uriFunction);
        },

        /**
         * Reload
         *
         * @chained team
         *
         * @public
         */
        reload: function()
        {
            var uriFunction = function()
            {
                return this.getUri();
            };

            return this.chainReload(null, uriFunction);
        },

        /**
         * Update
         *
         * @chained team
         *
         * @public
         */
        update: function()
        {
            var uriFunction = function()
            {
                return this.getUri();
            };

            return this.chainUpdate(null, uriFunction);
        },

        /**
         * Adds a member to the team.
         *
         * @param {String|Object} either the principal object or the principal id
         *
         * @chained team
         */
        addMember: function(principal)
        {
            var self = this;

            var uriFunction = function()
            {
                var principalDomainQualifiedId = self.extractPrincipalDomainQualifiedId(principal);

                return this.getUri() + "/members/add?id=" + principalDomainQualifiedId;
            };

            return this.chainPostEmpty(null, uriFunction);
        },

        /**
         * Removes a member from the team.
         *
         * @param {String|Object} either the principal object or the principal id
         *
         * @chained team
         */
        removeMember: function(principal)
        {
            var principalDomainQualifiedId = this.extractPrincipalDomainQualifiedId(principal);

            var uriFunction = function()
            {
                return this.getUri() + "/members/remove?id=" + principalDomainQualifiedId;
            };

            return this.chainPostEmpty(null, uriFunction);
        },

        /**
         * Lists members of a team
         *
         * @param pagination
         *
         * @chained principal map
         */
        listMembers: function(pagination)
        {
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return this.getUri() + "/members";
            };

            var chainable = new Gitana.TeamMemberMap(this);
            return this.chainGet(chainable, uriFunction, params);
        },

        /**
         * Grants an authority to this team.
         *
         * @param authorityId
         *
         * @chained team
         */
        grant: function(authorityId)
        {
            var uriFunction = function()
            {
                return this.getUri() + "/authorities/" + authorityId + "/grant";
            };

            return this.chainPostEmpty(null, uriFunction);
        },

        /**
         * Revokes an authority from this team.
         *
         * @param authorityId
         *
         * @chained team
         */
        revoke: function(authorityId)
        {
            var uriFunction = function()
            {
                return this.getUri() + "/authorities/" + authorityId + "/revoke";
            };

            return this.chainPostEmpty(null, uriFunction);
        },

        /**
         * Loads the authorities for this team and fires them into a callback.
         *
         * @param callback
         *
         * @chained team
         */
        loadAuthorities: function(callback)
        {
            var uriFunction = function()
            {
                return this.getUri() + "/authorities";
            };

            return this.chainGetResponse(this, uriFunction).then(function(response) {
                callback.call(this, response["authorities"]);
            });
        },


        //////////////////////////////////////////////////////////////////////////////////////
        //
        // ACCESSORS
        //
        //////////////////////////////////////////////////////////////////////////////////////

        /**
         * Returns the team key
         */
        getKey: function()
        {
            return this.get("key");
        },

        getGroupId: function()
        {
            return this.get("groupId");
        },

        getRoleKeys: function()
        {
            return this.get("roleKeys");
        }



    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.TeamMap = Gitana.AbstractMap.extend(
    /** @lends Gitana.TeamMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractMap
         *
         * @class Map of teams
         *
         * @param {Gitana.Cluster} cluster Gitana cluster instance.
         * @param {Object} teamable
         * @param [Object] object
         */
        constructor: function(cluster, teamable, object)
        {
            this.__teamable = (function() {
                var _teamable = null;
                return function(teamable) {
                    if (!Gitana.isUndefined(teamable)) { _teamable = teamable; }
                    return _teamable;
                };
            })();

            this.__teamable(teamable);

            this.objectType = function() { return "Gitana.TeamMap"; };

            this.getCluster = function()
            {
                return cluster;
            };

            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(cluster.getDriver(), object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().teamMap(this.getCluster(), this.__teamable(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().team(this.getCluster(), this.__teamable(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.TeamMember = Gitana.AbstractObject.extend(
    /** @lends Gitana.TeamMember.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractObject
         *
         * @class TeamMember
         *
         * @param {Gitana.Cluster} cluster
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(team, object)
        {
            this.base(team.getDriver(), object);

            this.objectType = function() { return "Gitana.TeamMember"; };



            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.getTeam = function() { return team; };
            this.getCluster = function() { return team.getCluster(); };
            this.getClusterId = function() { return team.getClusterId(); };
        }

        /*,

        domain: function()
        {
            var self = this;

            var result = this.subchain(new Gitana.Domain({
                "_doc": this.domainId
            }));

            return result.then(function() {
                // TODO: read the domain and populate
            });
        },

        principal: function()
        {
            var self = this;

            // domain
            var domain = new Gitana.Domain({
                ""
            })
            // temp web host
            var webhost = new Gitana.WebHost(this.getPlatform());

            // we hand back a deployed application and preload some work
            var chainable = this.getFactory().deployedApplication(webhost);
            return this.chainPost(chainable, uriFunction).then(function() {

                // load the real web host
                var webhostId = self["deployments"][deploymentKey]["webhost"];
                this.subchain(this.getPlatform()).readWebHost(webhostId).then(function() {
                    webhost.loadFrom(this);
                });

            });
        }
        */
    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.TeamMemberMap = Gitana.AbstractMap.extend(
    /** @lends Gitana.TeamMemberMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractMap
         *
         * @class Map of team members
         *
         * @param {Gitana.Team} team
         * @param [Object] object
         */
        constructor: function(team, object)
        {
            this.objectType = function() { return "Gitana.TeamMemberMap"; };

            this.getTeam = function()
            {
                return team;
            };

            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(team.getDriver(), object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return new Gitana.TeamMemberMap(this.getTeam(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return new Gitana.TeamMember(this.getTeam(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.Activity = Gitana.AbstractObject.extend(
    /** @lends Gitana.Activity.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractObject
         *
         * @class Activity
         *
         * @param {Gitana.DataStore} datastore
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(datastore, object)
        {
            this.base(datastore.getDriver(), object);

            this.objectType = function() { return "Gitana.Activity"; };

            this.getDataStore = function()
            {
                return datastore;
            };
        },

        getUri: function()
        {
            return this.getDataStore().getUri() + "/activities/" + this.getId();
        },

        /**
         * @override
         */
        clone: function()
        {
            return new Gitana.Activity(this.getDataStore(), this);
        },

        /**
         * Delete
         *
         * @chained datastore
         *
         * @public
         */
        del: function()
        {
            var uriFunction = function()
            {
                return this.getUri();
            };

            // NOTE: pass control back to the datastore
            return this.chainDelete(this.getDataStore(), uriFunction);
        },

        /**
         * Reload
         *
         * @chained security group
         *
         * @public
         */
        reload: function()
        {
            var uriFunction = function()
            {
                return this.getUri();
            };

            return this.chainReload(null, uriFunction);
        },

        /**
         * Update
         *
         * @chained security group
         *
         * @public
         */
        update: function()
        {
            var uriFunction = function()
            {
                return this.getUri();
            };

            return this.chainUpdate(null, uriFunction);
        },


        //////////////////////////////////////////////////////////////////////////////////////
        //
        // ACCESSORS
        //
        //////////////////////////////////////////////////////////////////////////////////////

        getType: function()
        {
            return this.get("type");
        },

        getTimestamp: function()
        {
            return this.get("timestamp");
        },


        // user

        getUserDomainId: function()
        {
            return this.get("userDomainId");
        },

        getUserId: function()
        {
            return this.get("userId");
        },

        getUserTitle: function()
        {
            return this.get("userTitle");
        },

        getUserEmail: function()
        {
            return this.get("userEmail");
        },

        getUserName: function()
        {
            return this.get("userName");
        },


        // object

        getObjectDataStoreTypeId: function()
        {
            return this.get("objectDatastoreTypeId");
        },

        getObjectDataStoreId: function()
        {
            return this.get("objectDatastoreId");
        },

        getObjectDataStoreTitle: function()
        {
            return this.get("objectDatastoreTitle");
        },

        getObjectTypeId: function()
        {
            return this.get("objectTypeId");
        },

        getObjectId: function()
        {
            return this.get("objectId");
        },

        getObjectTitle: function()
        {
            return this.get("objectTitle");
        },


        // other

        getOtherDataStoreTypeId: function()
        {
            return this.get("otherDatastoreTypeId");
        },

        getOtherDataStoreId: function()
        {
            return this.get("otherDatastoreId");
        },

        getOtherDataStoreTitle: function()
        {
            return this.get("otherDatastoreTitle");
        },

        getOtherTypeId: function()
        {
            return this.get("otherTypeId");
        },

        getOtherId: function()
        {
            return this.get("otherId");
        },

        getOtherTitle: function()
        {
            return this.get("otherTitle");
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.ActivityMap = Gitana.AbstractMap.extend(
    /** @lends Gitana.ActivityMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractMap
         *
         * @class Map of activities
         *
         * @param {Object} datastore Gitana datastore
         * @param [Object] object
         */
        constructor: function(datastore, object)
        {
            this.objectType = function() { return "Gitana.ActivityMap"; };

            this.getDataStore = function()
            {
                return datastore;
            };

            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(datastore.getDriver(), object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().activityMap(this.getDataStore(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().activity(this.getDataStore(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.Role = Gitana.AbstractObject.extend(
    /** @lends Gitana.Role.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractObject
         *
         * @class Role
         *
         * @param {Gitana.Cluster} cluster
         * @param {Object} roleContainer
         * @param {String} roleKey
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(cluster, roleContainer, object)
        {
            this.base(cluster.getDriver(), object);

            this.objectType = function() { return "Gitana.Role"; };

            this.roleContainer = roleContainer;

            this.getCluster = function()
            {
                return cluster;
            };
        },

        getUri: function()
        {
            return this.roleContainer.getUri() + "/roles/" + this.getId();
        },

        getType: function()
        {
            return "role";
        },

        /**
         * Delete
         *
         * @chained team
         *
         * @public
         */
        del: function()
        {
            var uriFunction = function()
            {
                return this.getUri();
            };

            // NOTE: pass control back to the role container
            return this.chainDelete(this.roleContainer, uriFunction);
        },

        /**
         * Reload
         *
         * @chained role
         *
         * @public
         */
        reload: function()
        {
            var uriFunction = function()
            {
                return this.getUri();
            };

            return this.chainReload(null, uriFunction);
        },

        /**
         * Update
         *
         * @chained team
         *
         * @public
         */
        update: function()
        {
            var uriFunction = function()
            {
                return this.getUri();
            };

            return this.chainUpdate(null, uriFunction);
        },

        //////////////////////////////////////////////////////////////////////////////////////
        //
        // ACCESSORS
        //
        //////////////////////////////////////////////////////////////////////////////////////

        /**
         * Returns the role key
         */
        getRoleKey: function()
        {
            return this.roleKey;
        },

        getPermissions: function()
        {
            return this.object["permissions"];
        }
    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.RoleMap = Gitana.AbstractMap.extend(
    /** @lends Gitana.RoleMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractMap
         *
         * @class Map of roles
         *
         * @param {Gitana.Cluster} cluster Gitana cluster instance.
         * @param {Object} role container
         * @param [Object] object
         */
        constructor: function(cluster, roleContainer, object)
        {
            this.objectType = function() { return "Gitana.RoleMap"; };

            this.getCluster = function()
            {
                return cluster;
            };

            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(cluster.getDriver(), object);

            this.roleContainer = roleContainer;
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().roleMap(this.getCluster(), this.roleContainer, this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().role(this.getCluster(), this.roleContainer, json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.Cluster = Gitana.DataStore.extend(
    /** @lends Gitana.Cluster.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.DataStore
         *
         * @class Cluster
         *
         * @param {Gitana.Driver} driver
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(driver, object)
        {
            this.objectType = function() { return "Gitana.Cluster"; };

            this.base(driver, object);
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "";
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_CLUSTER;
        },

        /**
         * @override
         */
        clone: function()
        {
            return new Gitana.Cluster(this.getDriver(), this);
        },

        /**
         * Loads the contained types for a type as a string array and passes it into a callback function.
         *
         * @param type
         * @param callback
         * @return this
         */
        loadContainedTypes: function(type, callback)
        {
            var uriFunction = function()
            {
                return "/tools/types/contained/" + type;
            };

            return this.chainPostResponse(this, uriFunction).then(function(response) {
                callback.call(this, response["types"]);
            });
        },



        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // JOB METHODS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Queries for jobs.
         *
         * @chained job map
         *
         * @param {Object} query Query for finding a job.
         * @param [Object] pagination pagination (optional)
         */
        queryJobs: function(query, pagination)
        {
            var chainable = this.getFactory().jobMap(this);

            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            return this.chainPost(chainable, "/jobs/query", params, query);
        },

        /**
         * Read a job.
         *
         * @chained job
         *
         * @param {String} jobId
         */
        readJob: function(jobId)
        {
            var chainable = this.getFactory().job(this);

            return this.chainGet(chainable, "/jobs/" + jobId);
        },

        /**
         * Kills a job
         *
         * @chained server
         *
         * @param {String} jobId
         */
        killJob: function(jobId)
        {
            return this.chainPostEmpty(null, "/jobs/" + jobId + "/kill");
        },

        /**
         * Queries for unstarted jobs.
         *
         * @chained job map
         *
         * @param {Object} query Query for finding a job.
         * @param [Object] pagination pagination (optional)
         */
        queryUnstartedJobs: function(query, pagination)
        {
            var chainable = this.getFactory().jobMap(this);

            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            return this.chainPost(chainable, "/jobs/unstarted/query", params, query);
        },

        /**
         * Queries for running jobs.
         *
         * @chained job map
         *
         * @param {Object} query Query for finding a job.
         * @param [Object] pagination pagination (optional)
         */
        queryRunningJobs: function(query, pagination)
        {
            var chainable = this.getFactory().jobMap(this);

            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            return this.chainPost(chainable, "/jobs/running/query", params, query);
        },

        /**
         * Queries for failed jobs.
         *
         * @chained job map
         *
         * @param {Object} query Query for finding a job.
         * @param [Object] pagination pagination (optional)
         */
        queryFailedJobs: function(query, pagination)
        {
            var chainable = this.getFactory().jobMap(this);

            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            return this.chainPost(chainable, "/jobs/failed/query", params, query);
        },

        /**
         * Queries for waiting jobs.
         *
         * @chained job map
         *
         * @param {Object} query Query for finding a job.
         * @param [Object] pagination pagination (optional)
         */
        queryWaitingJobs: function(query, pagination)
        {
            var chainable = this.getFactory().jobMap(this);

            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            return this.chainPost(chainable, "/jobs/waiting/query", params, query);
        },

        /**
         * Queries for finished jobs.
         *
         * @chained job map
         *
         * @param {Object} query Query for finding a job.
         * @param [Object] pagination pagination (optional)
         */
        queryFinishedJobs: function(query, pagination)
        {
            var chainable = this.getFactory().jobMap(this);

            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            return this.chainPost(chainable, "/jobs/finished/query", params, query);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.Job = Gitana.AbstractObject.extend(
    /** @lends Gitana.Job.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractObject
         *
         * @class Job
         *
         * @param {Gitana.Cluster} cluster
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(cluster, object)
        {
            this.base(cluster.getDriver(), object);

            this.objectType = function() { return "Gitana.Job"; };

            this.getCluster = function()
            {
                return cluster;
            };
        },

        /**
         * @override
         */
        clone: function()
        {
            return new Gitana.Job(this.getCluster(), this);
        },

        /**
         * @returns {String} the type id of the job
         */
        getType: function()
        {
            return this.get("type");
        },

        /**
         * @returns {String} the id of the principal that this job will run as
         */
        getRunAsPrincipalId: function()
        {
            return this.get("runAsPrincipal");
        },

        /**
         * @returns {String} the domain of the principal that this job will run as
         */
        getRunAsPrincipalDomainId: function()
        {
            return this.get("runAsPrincipalDomain");
        },

        /**
         * @returns {String} the state of the job
         */
        getState: function()
        {
            return this.get("state");
        },

        /**
         * @returns {String} the platform id
         */
        getPlatformId: function()
        {
            return this.get("platformId");
        },

        /**
         * @returns {Number} the priority of the job
         */
        getPriority: function()
        {
            return this.get("priority");
        },

        /**
         * @returns {Number} the number of attempts made to run this job
         */
        getAttempts: function()
        {
            return this.get("attempts");
        },

        /**
         * @returns {Object} when the job is scheduled to start (or null)
         */
        getScheduledStartTime: function()
        {
            return this.get("schedule_start_ms");
        },

        /**
         * @returns [Array] array of status log objects
         */
        getLogEntries: function()
        {
            return this.get("log_entries");
        },

        getCurrentThread: function()
        {
            return this.get("current_thread");
        },

        getCurrentServer: function()
        {
            return this.get("current_server");
        },

        getCurrentServerTimeStamp: function()
        {
            return this.get("current_server_timestamp");
        },

        getSubmittedBy: function()
        {
            return this.get("submitted_by");
        },

        getSubmittedTimestamp: function()
        {
            return this.get("submitted_timestamp");
        },

        getStarted: function()
        {
            return this.get("started");
        },

        getStartedBy: function()
        {
            return this.get("started_by");
        },

        getStartedTimestamp: function()
        {
            return this.get("started_timestamp");
        },

        getStopped: function()
        {
            return this.get("stopped");
        },

        getStoppedTimestamp: function()
        {
            return this.get("stopped_timestamp");
        },

        getPaused: function()
        {
            return this.get("paused");
        },

        getPausedBy: function()
        {
            return this.get("paused_by");
        },

        getPausedTimestamp: function()
        {
            return this.get("paused_timestamp");
        }
    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.JobMap = Gitana.AbstractMap.extend(
    /** @lends Gitana.JobMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractMap
         *
         * @class Map of jobs
         *
         * @param {Gitana.Cluster} cluster Gitana cluster instance.
         * @param [Object] object
         */
        constructor: function(cluster, object)
        {
            this.objectType = function() { return "Gitana.JobMap"; };

            this.getCluster = function()
            {
                return cluster;
            };

            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(cluster.getDriver(), object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().jobMap(this.getCluster(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().job(this.getCluster(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.LogEntry = Gitana.AbstractObject.extend(
    /** @lends Gitana.LogEntry.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractObject
         *
         * @class LogEntry
         *
         * @param {Gitana.Platform} platform
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(platform, object)
        {
            this.base(platform.getDriver(), object);

            this.objectType = function() { return "Gitana.LogEntry"; };

            this.getPlatform = function()
            {
                return platform;
            };
        },

        /**
         * @override
         */
        clone: function()
        {
            return new Gitana.LogEntry(this.getPlatform(), this);
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_LOG_ENTRY;
        },

        /**
         * @returns {String} the id of the principal that logged this entry
         */
        getPrincipalId: function()
        {
            return this.get("principalId");
        },

        /**
         * @returns {String} the id of the repository against which this log entry was logged (or null)
         */
        getRepositoryId: function()
        {
            return this.get("repositoryId");
        },

        /**
         * @returns {String} the id of the branch against which this log entry was logged (or null)
         */
        getBranchId: function()
        {
            return this.get("branchId");
        },

        /**
         * @returns {String} log level
         */
        getLevel: function()
        {
            return this.get("level");
        },

        /**
         * @returns {String} thread id
         */
        getThread: function()
        {
            return this.get("thread");
        },

        /**
         * @returns {Object} timestamp
         */
        getTimestamp: function()
        {
            return this.get("timestamp");
        },

        /**
         * @returns {String} message
         */
        getMessage: function()
        {
            return this.get("message");
        },

        /**
         * @returns {String} filename
         */
        getFilename: function()
        {
            return this.get("filename");
        },

        /**
         * @returns {String} method
         */
        getMethod: function()
        {
            return this.get("method");
        },

        /**
         * @returns {Number} line number
         */
        getLineNumber: function()
        {
            return this.get("line");
        },

        /**
         * @returns {Object} class descriptor
         */
        getClassDescriptor: function()
        {
            return this.get("class");
        },

        /**
         * @returns [Array] throwables
         */
        getThrowables: function()
        {
            return this.get("throwables");
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.LogEntryMap = Gitana.AbstractMap.extend(
    /** @lends Gitana.LogEntryMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractMap
         *
         * @class Map of log entries
         *
         * @param {Gitana.Platform} platform Gitana server instance.
         * @param [Object] object
         */
        constructor: function(platform, object)
        {
            this.objectType = function() { return "Gitana.LogEntryMap"; };

            this.getPlatform = function()
            {
                return platform;
            };

            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(platform.getDriver(), object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().logEntryMap(this.getPlatform(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().logEntry(this.getPlatform(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.CopyJob = Gitana.Job.extend(
    /** @lends Gitana.CopyJob.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractObject
         *
         * @class CopyJob
         *
         * @param {Gitana.Cluster} cluster
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(cluster, object)
        {
            this.base(cluster, object);

            this.objectType = function() { return "Gitana.CopyJob"; };
        },

        /**
         * @override
         */
        clone: function()
        {
            return new Gitana.CopyJob(this.getCluster(), this);
        },

        getImports: function()
        {
            var importObjects = [];

            var array = this.get("imports");
            for (var i = 0; i < array.length; i++)
            {
                var object = array[i];

                var sources = object["sources"];
                var targets = object["targest"];

                var importObject = {
                    "sources": object["sources"],
                    "targets": object["targets"],
                    getType: function()
                    {
                        return this.targets[this.targets.length - 1]["typeId"];
                    },
                    getSourceId: function()
                    {
                        return this.sources[this.sources.length - 1]["id"];
                    },
                    getTargetId: function()
                    {
                        return this.targets[this.targets.length - 1]["id"];
                    }
                };
                importObjects.push(importObject);
            }

            return importObjects;
        },

        getSingleImportTargetId: function()
        {
            var targetId = null;

            var importObjects = this.getImports();
            if (importObjects.length > 0)
            {
                targetId = importObjects[0].getTargetId();
            }

            return targetId;
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.TransferImportJob = Gitana.Job.extend(
    /** @lends Gitana.TransferImportJob.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractObject
         *
         * @class TransferImportJob
         *
         * @param {Gitana.Cluster} cluster
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(cluster, object)
        {
            this.base(cluster, object);

            this.objectType = function() { return "Gitana.TransferImportJob"; };
        },

        /**
         * @override
         */
        clone: function()
        {
            return new Gitana.TransferExportJob(this.getCluster(), this);
        },

        getImports: function()
        {
            var importObjects = [];

            var array = this.get("imports");
            for (var i = 0; i < array.length; i++)
            {
                var object = array[i];

                var sources = object["sources"];
                var targets = object["targest"];

                var importObject = {
                    "sources": object["sources"],
                    "targets": object["targets"],
                    getType: function()
                    {
                        return this.targets[this.targets.length - 1]["typeId"];
                    },
                    getSourceId: function()
                    {
                        return this.sources[this.sources.length - 1]["id"];
                    },
                    getTargetId: function()
                    {
                        return this.targets[this.targets.length - 1]["id"];
                    }
                };
                importObjects.push(importObject);
            }

            return importObjects;
        },

        getSingleImportTargetId: function()
        {
            var targetId = null;

            var importObjects = this.getImports();
            if (importObjects.length > 0)
            {
                targetId = importObjects[0].getTargetId();
            }

            return targetId;
        }
    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.TransferExportJob = Gitana.Job.extend(
    /** @lends Gitana.TransferExportJob.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractObject
         *
         * @class TransferExportJob
         *
         * @param {Gitana.Cluster} cluster
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(cluster, object)
        {
            this.base(cluster, object);

            this.objectType = function() { return "Gitana.TransferExportJob"; };
        },

        /**
         * @override
         */
        clone: function()
        {
            return new Gitana.TransferExportJob(this.getCluster(), this);
        },

        getImports: function()
        {
            var importObjects = [];

            var array = this.get("imports");
            for (var i = 0; i < array.length; i++)
            {
                var object = array[i];

                var sources = object["sources"];
                var targets = object["targest"];

                var importObject = {
                    "sources": object["sources"],
                    "targets": object["targets"],
                    getType: function()
                    {
                        return this.targets[this.targets.length - 1]["typeId"];
                    },
                    getSourceId: function()
                    {
                        return this.sources[this.sources.length - 1]["id"];
                    },
                    getTargetId: function()
                    {
                        return this.targets[this.targets.length - 1]["id"];
                    }
                };
                importObjects.push(importObject);
            }

            return importObjects;
        },

        getSingleImportTargetId: function()
        {
            var targetId = null;

            var importObjects = this.getImports();
            if (importObjects.length > 0)
            {
                targetId = importObjects[0].getTargetId();
            }

            return targetId;
        }
    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.Platform = Gitana.ContainedDataStore.extend(
    /** @lends Gitana.Platform.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.DataStore
         *
         * @class Platform
         *
         * @param {Gitana.Cluster} cluster
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(cluster, object)
        {
            this.objectType = function() { return "Gitana.Platform"; };

            this.base(cluster, object);


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.getCluster = function()
            {
                return cluster;
            };

            this.getClusterId = function()
            {
                return cluster.getId();
            };

        },

        /**
         * This method is provided to make the platform datastore compatible for teams.
         */
        getPlatform: function()
        {
            return this;
        },

        /**
         * Reads the cluster.
         *
         * @chained cluster
         */
        readCluster: function()
        {
            return this.subchain(this.getCluster());
        },

        /**
         * @OVERRIDE
         */
            getUri: function()
        {
            return "";
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_PLATFORM;
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().platform(this.getCluster(), this);
        },

        /** @Override **/
        del: function()
        {
            // not implemented
            return this;
        },

        /** @Override **/
        reload: function()
        {
            var uriFunction = function()
            {
                return this.getUri() + "/";
            };

            return this.chainReload(null, uriFunction);
        },

        /** @Override **/
        update: function()
        {
            var uriFunction = function()
            {
                return this.getUri() + "/";
            };

            return this.chainUpdate(null, uriFunction);
        },

        /**
         * Hands back the primary domain instance for this platform.
         *
         * @chained domain
         */
        readPrimaryDomain: function()
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/domains/primary";
            };

            var chainable = this.getFactory().domain(this);
            return this.chainGet(chainable, uriFunction);
        },

        /**
         * Loads information about the platform.
         *
         * @param callback
         */
        loadInfo: function(callback)
        {
            var uriFunction = function()
            {
                return "/info";
            };

            return this.chainGetResponse(this, uriFunction, {}).then(function(response) {
                callback(response);
            });
        },



        /////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // REPOSITORIES
        //
        /////////////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists repositories.
         *
         * @chained repository map
         *
         * @param [Object] pagination pagination (optional)
         */
        listRepositories: function(pagination)
        {
            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var chainable = this.getFactory().repositoryMap(this);
            return this.chainGet(chainable, "/repositories", params);
        },

        /**
         * Read a repository.
         *
         * @chained repository
         *
         * @param {String} repositoryId the repository id
         */
        readRepository: function(repositoryId)
        {
            var chainable = this.getFactory().repository(this);
            return this.chainGet(chainable, "/repositories/" + repositoryId);
        },

        /**
         * Create a repository
         *
         * @chained repository
         *
         * @param [Object] object JSON object
         */
        createRepository: function(object)
        {
            var chainable = this.getFactory().repository(this);
            return this.chainCreate(chainable, object, "/repositories");
        },

        /**
         * Queries for a repository.
         *
         * @chained repository map
         *
         * @param {Object} query Query for finding a repository.
         * @param [Object] pagination pagination (optional)
         */
        queryRepositories: function(query, pagination)
        {
            var chainable = this.getFactory().repositoryMap(this);

            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            return this.chainPost(chainable, "/repositories/query", params, query);
        },

        /**
         * Performs a bulk check of permissions against permissioned objects of type repository.
         *
         * Example of checks array:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "domainId": "<domainId>", (optional)
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>"
         * }]
         *
         * The callback receives an array of results, example:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "domainId": "<domainId>", (optional)
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>",
         *    "result": true
         * }]
         *
         * The order of elements in the array will be the same for checks and results.
         *
         * @param checks
         * @param callback
         */
        checkRepositoryPermissions: function(checks, callback)
        {
            var uriFunction = function()
            {
                return "/repositories/permissions/check";
            };

            var object = {
                "checks": checks
            };

            return this.chainPostResponse(this, uriFunction, {}, object).then(function(response) {
                callback.call(this, response["results"]);
            });
        },



        /////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // DOMAINS
        //
        /////////////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists domains.
         *
         * @chained domain map
         *
         * @param [Object] pagination pagination (optional)
         */
        listDomains: function(pagination)
        {
            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var chainable = this.getFactory().domainMap(this);
            return this.chainGet(chainable, "/domains", params);
        },

        /**
         * Read a domain.
         *
         * @chained domain
         *
         * @param {String} domainId the domain id
         */
        readDomain: function(domainId)
        {
            var chainable = this.getFactory().domain(this);
            return this.chainGet(chainable, "/domains/" + domainId);
        },

        /**
         * Create a domain
         *
         * @chained domain
         *
         * @param [Object] object JSON object
         */
        createDomain: function(object)
        {
            var chainable = this.getFactory().domain(this);
            return this.chainCreate(chainable, object, "/domains");
        },

        /**
         * Queries for a domain.
         *
         * @chained domain map
         *
         * @param {Object} query Query for finding a domain.
         * @param [Object] pagination pagination (optional)
         */
        queryDomains: function(query, pagination)
        {
            var chainable = this.getFactory().domainMap(this);

            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            return this.chainPost(chainable, "/domains/query", params, query);
        },

        /**
         * Performs a bulk check of permissions against permissioned objects of type domain.
         *
         * Example of checks array:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>"
         * }]
         *
         * The callback receives an array of results, example:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>",
         *    "result": true
         * }]
         *
         * The order of elements in the array will be the same for checks and results.
         *
         * @param checks
         * @param callback
         */
        checkDomainPermissions: function(checks, callback)
        {
            var uriFunction = function()
            {
                return "/domains/permissions/check";
            };

            var object = {
                "checks": checks
            };

            return this.chainPostResponse(this, uriFunction, {}, object).then(function(response) {
                callback.call(this, response["results"]);
            });
        },



        /////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // VAULTS
        //
        /////////////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists vaults.
         *
         * @chained vault map
         *
         * @param [Object] pagination pagination (optional)
         */
        listVaults: function(pagination)
        {
            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var chainable = this.getFactory().vaultMap(this);
            return this.chainGet(chainable, "/vaults", params);
        },

        /**
         * Read a vault.
         *
         * @chained vault
         *
         * @param {String} vaultId the vault id
         */
        readVault: function(vaultId)
        {
            var chainable = this.getFactory().vault(this);
            return this.chainGet(chainable, "/vaults/" + vaultId);
        },

        /**
         * Create a vault
         *
         * @chained vault
         *
         * @param [Object] object JSON object
         */
        createVault: function(object)
        {
            var chainable = this.getFactory().vault(this);
            return this.chainCreate(chainable, object, "/vaults");
        },

        /**
         * Queries for a vault.
         *
         * @chained vault map
         *
         * @param {Object} query Query for finding a vault.
         * @param [Object] pagination pagination (optional)
         */
        queryVaults: function(query, pagination)
        {
            var chainable = this.getFactory().vaultMap(this);

            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            return this.chainPost(chainable, "/vaults/query", params, query);
        },

        /**
         * Performs a bulk check of permissions against permissioned objects of type vault.
         *
         * Example of checks array:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>"
         * }]
         *
         * The callback receives an array of results, example:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>",
         *    "result": true
         * }]
         *
         * The order of elements in the array will be the same for checks and results.
         *
         * @param checks
         * @param callback
         */
        checkVaultPermissions: function(checks, callback)
        {
            var uriFunction = function()
            {
                return "/vaults/permissions/check";
            };

            var object = {
                "checks": checks
            };

            return this.chainPostResponse(this, uriFunction, {}, object).then(function(response) {
                callback.call(this, response["results"]);
            });
        },



        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // AUTHENTICATION METHODS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Logs in as the given user.
         *
         * This delegates a call to the underlying driver.
         *
         * @param {Object} config login config
         * @param [Function] authentication failure handler
         */
        authenticate: function(config, authFailureHandler)
        {
            return this.getDriver().authenticate(config, authFailureHandler);
        },

        /**
         * Clears authentication against the server.
         *
         * @chained server
         *
         * @public
         */
        logout: function()
        {
            var self = this;

            return this.subchain().then(function() {

                var platformCacheKey = this.getDriver().platformCacheKey;
                if (platformCacheKey)
                {
                    Gitana.disconnect(platformCacheKey);
                }

                this.getDriver().clearAuthentication();

                delete this.getDriver().platformCacheKey;
            });
        },



        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // STACKS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists the stacks.
         *
         * @param pagination
         *
         * @chained stack map
         */
        listStacks: function(pagination)
        {
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var chainable = this.getFactory().stackMap(this);
            return this.chainGet(chainable, "/stacks", params);
        },

        /**
         * Reads a stack.
         *
         * @param stackId
         *
         * @chained stack
         */
        readStack: function(stackId)
        {
            var chainable = this.getFactory().stack(this);
            return this.chainGet(chainable, "/stacks/" + stackId);
        },

        /**
         * Create a stack
         *
         * @chained stack
         *
         * @param [Object] object JSON object
         */
        createStack: function(object)
        {
            if (!object)
            {
                object = {};
            }

            var chainable = this.getFactory().stack(this);
            return this.chainCreate(chainable, object, "/stacks");
        },

        /**
         * Queries for stacks.
         *
         * @chained stack map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryStacks: function(query, pagination)
        {
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return "/stacks/query";
            };

            var chainable = this.getFactory().stackMap(this);
            return this.chainPost(chainable, uriFunction, params, query);
        },

        /**
         * Finds a stack for a given data store.
         *
         * @param datastoreType
         * @param datastoreId
         *
         * @chained stack
         */
        findStackForDataStore: function(datastoreType, datastoreId)
        {
            var chainable = this.getFactory().stack(this);
            return this.chainGet(chainable, "/stacks/find/" + datastoreType + "/" + datastoreId);
        },


        /**
         * Performs a bulk check of permissions against permissioned objects of type stack.
         *
         * Example of checks array:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>"
         * }]
         *
         * The callback receives an array of results, example:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>",
         *    "result": true
         * }]
         *
         * The order of elements in the array will be the same for checks and results.
         *
         * @param checks
         * @param callback
         */
        checkStackPermissions: function(checks, callback)
        {
            var uriFunction = function()
            {
                return "/stacks/permissions/check";
            };

            var object = {
                "checks": checks
            };

            return this.chainPostResponse(this, uriFunction, {}, object).then(function(response) {
                callback.call(this, response["results"]);
            });
        },






        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // PROJECTS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists the projects.
         *
         * @param pagination
         *
         * @chained stack map
         */
        listProjects: function(pagination)
        {
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var chainable = this.getFactory().projectMap(this);
            return this.chainGet(chainable, "/projects", params);
        },

        /**
         * Reads a project.
         *
         * @param projectId
         *
         * @chained project
         */
        readProject: function(projectId)
        {
            var chainable = this.getFactory().project(this);
            return this.chainGet(chainable, "/projects/" + projectId);
        },

        /**
         * Create a project
         *
         * @chained project
         *
         * @param [Object] object JSON object
         */
        createProject: function(object)
        {
            if (!object)
            {
                object = {};
            }

            var chainable = this.getFactory().project(this);
            return this.chainCreate(chainable, object, "/projects");
        },

        /**
         * Queries for projects.
         *
         * @chained project map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryProjects: function(query, pagination)
        {
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return "/projects/query";
            };

            var chainable = this.getFactory().projectMap(this);
            return this.chainPost(chainable, uriFunction, params, query);
        },

        /**
         * Performs a bulk check of permissions against permissioned objects of type project.
         *
         * Example of checks array:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>"
         * }]
         *
         * The callback receives an array of results, example:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>",
         *    "result": true
         * }]
         *
         * The order of elements in the array will be the same for checks and results.
         *
         * @param checks
         * @param callback
         */
        checkProjectPermissions: function(checks, callback)
        {
            var uriFunction = function()
            {
                return "/projects/permissions/check";
            };

            var object = {
                "checks": checks
            };

            return this.chainPostResponse(this, uriFunction, {}, object).then(function(response) {
                callback.call(this, response["results"]);
            });
        },

        /////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // PROJECT TYPES
        //
        /////////////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists the project types available for this platform.
         *
         * @chained project type map
         *
         * @param [Object] pagination pagination (optional)
         */
        listProjectTypes: function(pagination)
        {
            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var chainable = this.getFactory().projectMap(this);
            return this.chainGet(chainable, "/projecttypes", params);
        },





        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // LOGS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Queries for log entries.
         *
         * @chained log entry map
         *
         * @param {Object} query Query for finding log entries.
         * @param [Object] pagination pagination (optional)
         */
        queryLogEntries: function(query, pagination)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/logs/query";
            };

            if (!query)
            {
                query = {};
            }

            var chainable = this.getFactory().logEntryMap(this.getCluster());

            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            return this.chainPost(chainable, uriFunction, params, query);
        },

        /**
         * Read a log entry.
         *
         * @chained job
         *
         * @param {String} jobId
         */
        readLogEntry: function(logEntryId)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/logs/" + logEntryId;
            };

            var chainable = this.getFactory().logEntry(this.getCluster());

            return this.chainGet(chainable, uriFunction);
        },



        /////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // REGISTRARS
        //
        /////////////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists registrars.
         *
         * @chained registrar map
         *
         * @param [Object] pagination pagination (optional)
         */
        listRegistrars: function(pagination)
        {
            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var chainable = this.getFactory().registrarMap(this);
            return this.chainGet(chainable, "/registrars", params);
        },

        /**
         * Read a registrar.
         *
         * @chained registrar
         *
         * @param {String} registrarId the registrar id
         */
        readRegistrar: function(registrarId)
        {
            var chainable = this.getFactory().registrar(this);
            return this.chainGet(chainable, "/registrars/" + registrarId);
        },

        /**
         * Create a registrar
         *
         * @chained registrar
         *
         * @param [Object] object JSON object
         */
        createRegistrar: function(object)
        {
            var chainable = this.getFactory().registrar(this);
            return this.chainCreate(chainable, object, "/registrars");
        },

        /**
         * Queries for a registrar.
         *
         * @chained registrar map
         *
         * @param {Object} query Query for finding a vault.
         * @param [Object] pagination pagination (optional)
         */
        queryRegistrars: function(query, pagination)
        {
            var chainable = this.getFactory().registrarMap(this);

            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            return this.chainPost(chainable, "/registrars/query", params, query);
        },

        /**
         * Performs a bulk check of permissions against permissioned objects of type vault.
         *
         * Example of checks array:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>"
         * }]
         *
         * The callback receives an array of results, example:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>",
         *    "result": true
         * }]
         *
         * The order of elements in the array will be the same for checks and results.
         *
         * @param checks
         * @param callback
         */
        checkRegistrarPermissions: function(checks, callback)
        {
            var uriFunction = function()
            {
                return "/registrars/permissions/check";
            };

            var object = {
                "checks": checks
            };

            return this.chainPostResponse(this, uriFunction, {}, object).then(function(response) {
                callback.call(this, response["results"]);
            });
        },



        /////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // APPLICATIONS
        //
        /////////////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists applications.
         *
         * @chained application map
         *
         * @param [Object] pagination pagination (optional)
         */
        listApplications: function(pagination)
        {
            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var chainable = this.getFactory().applicationMap(this);
            return this.chainGet(chainable, "/applications", params);
        },

        /**
         * Read an application.
         *
         * @chained application
         *
         * @param {String} applicationId the application id
         */
        readApplication: function(applicationId)
        {
            var uriFunction = function() {
                return "/applications/" + applicationId;
            };

            var chainable = this.getFactory().application(this);
            return this.chainGet(chainable, uriFunction);
        },

        /**
         * Create an application
         *
         * @chained application
         *
         * @param [Object] object JSON object
         */
        createApplication: function(object)
        {
            var chainable = this.getFactory().application(this);
            return this.chainCreate(chainable, object, "/applications");
        },

        /**
         * Queries for an application.
         *
         * @chained application map
         *
         * @param {Object} query Query for finding a vault.
         * @param [Object] pagination pagination (optional)
         */
        queryApplications: function(query, pagination)
        {
            var chainable = this.getFactory().applicationMap(this);

            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            return this.chainPost(chainable, "/applications/query", params, query);
        },

        /**
         * Performs a bulk check of permissions against permissioned objects of type vault.
         *
         * Example of checks array:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>"
         * }]
         *
         * The callback receives an array of results, example:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>",
         *    "result": true
         * }]
         *
         * The order of elements in the array will be the same for checks and results.
         *
         * @param checks
         * @param callback
         */
        checkApplicationPermissions: function(checks, callback)
        {
            var uriFunction = function()
            {
                return "/applications/permissions/check";
            };

            var object = {
                "checks": checks
            };

            return this.chainPostResponse(this, uriFunction, {}, object).then(function(response) {
                callback.call(this, response["results"]);
            });
        },

        /////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // APPLICATION TYPES
        //
        /////////////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists the application types available for this platform.
         *
         * @chained application type map
         *
         * @param [Object] pagination pagination (optional)
         */
        listApplicationTypes: function(pagination)
        {
            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var chainable = this.getFactory().applicationMap(this);
            return this.chainGet(chainable, "/applicationtypes", params);
        },




        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // CLIENTS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists the clients.
         *
         * @param pagination
         *
         * @chained client map
         */
        listClients: function(pagination)
        {
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var chainable = this.getFactory().clientMap(this);
            return this.chainGet(chainable, "/clients", params);
        },

        /**
         * Reads a client.
         *
         * @param clientId
         *
         * @chained client
         */
        readClient: function(clientId)
        {
            var chainable = this.getFactory().client(this);
            return this.chainGet(chainable, "/clients/" + clientId);
        },

        /**
         * Create a client
         *
         * @chained client
         *
         * @param [Object] object JSON object
         */
        createClient: function(object)
        {
            if (!object)
            {
                object = {};
            }

            var chainable = this.getFactory().client(this);
            return this.chainCreate(chainable, object, "/clients");
        },

        /**
         * Queries for clients.
         *
         * @chained client map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryClients: function(query, pagination)
        {
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return "/clients/query";
            };

            var chainable = this.getFactory().clientMap(this);
            return this.chainPost(chainable, uriFunction, params, query);
        },

        /**
         * Performs a bulk check of permissions against permissioned objects of type stack.
         *
         * Example of checks array:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>"
         * }]
         *
         * The callback receives an array of results, example:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>",
         *    "result": true
         * }]
         *
         * The order of elements in the array will be the same for checks and results.
         *
         * @param checks
         * @param callback
         */
        checkClientPermissions: function(checks, callback)
        {
            var uriFunction = function()
            {
                return "/clients/permissions/check";
            };

            var object = {
                "checks": checks
            };

            return this.chainPostResponse(this, uriFunction, {}, object).then(function(response) {
                callback.call(this, response["results"]);
            });
        },



        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // AUTHENTICATION GRANTS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Reads an authentication grant.
         *
         * @param authenticationGrantId
         *
         * @chained authentication grant
         */
        readAuthenticationGrant: function(authenticationGrantId)
        {
            var chainable = this.getFactory().authenticationGrant(this);
            return this.chainGet(chainable, "/auth/grants/" + authenticationGrantId);
        },

        /**
         * Create an authentication grant
         *
         * @chained authentication grant
         *
         * @param [Object] object JSON object
         */
        createAuthenticationGrant: function(object)
        {
            if (!object)
            {
                object = {};
            }

            var chainable = this.getFactory().authenticationGrant(this);
            return this.chainCreate(chainable, object, "/auth/grants");
        },

        /**
         * Queries for authentication grants.
         *
         * @chained authentication grant map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryAuthenticationGrants: function(query, pagination)
        {
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return "/auth/grants/query";
            };

            var chainable = this.getFactory().authenticationGrantMap(this);
            return this.chainPost(chainable, uriFunction, params, query);
        },

        /**
         * Performs a bulk check of permissions against permissioned objects of type stack.
         *
         * Example of checks array:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>"
         * }]
         *
         * The callback receives an array of results, example:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>",
         *    "result": true
         * }]
         *
         * The order of elements in the array will be the same for checks and results.
         *
         * @param checks
         * @param callback
         */
        checkAuthenticationGrantPermissions: function(checks, callback)
        {
            var uriFunction = function()
            {
                return "/auth/grants/permissions/check";
            };

            var object = {
                "checks": checks
            };

            return this.chainPostResponse(this, uriFunction, {}, object).then(function(response) {
                callback.call(this, response["results"]);
            });
        },



        /////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // DIRECTORIES
        //
        /////////////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists directories.
         *
         * @chained directory map
         *
         * @param [Object] pagination pagination (optional)
         */
        listDirectories: function(pagination)
        {
            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var chainable = this.getFactory().directoryMap(this);
            return this.chainGet(chainable, "/directories", params);
        },

        /**
         * Read a directory.
         *
         * @chained directory
         *
         * @param {String} directoryId the directory id
         */
        readDirectory: function(directoryId)
        {
            var chainable = this.getFactory().directory(this);
            return this.chainGet(chainable, "/directories/" + directoryId);
        },

        /**
         * Create a directory.
         *
         * @chained directory
         *
         * @param [Object] object JSON object
         */
        createDirectory: function(object)
        {
            var chainable = this.getFactory().directory(this);
            return this.chainCreate(chainable, object, "/directories");
        },

        /**
         * Queries for a directory.
         *
         * @chained directory map
         *
         * @param {Object} query Query for finding a directory.
         * @param [Object] pagination pagination (optional)
         */
        queryDirectories: function(query, pagination)
        {
            var chainable = this.getFactory().directoryMap(this);

            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            return this.chainPost(chainable, "/directories/query", params, query);
        },

        /**
         * Performs a bulk check of permissions against permissioned objects of type directory.
         *
         * Example of checks array:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>"
         * }]
         *
         * The callback receives an array of results, example:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>",
         *    "result": true
         * }]
         *
         * The order of elements in the array will be the same for checks and results.
         *
         * @param checks
         * @param callback
         */
        checkDirectoryPermissions: function(checks, callback)
        {
            var uriFunction = function()
            {
                return "/directories/permissions/check";
            };

            var object = {
                "checks": checks
            };

            return this.chainPostResponse(this, uriFunction, {}, object).then(function(response) {
                callback.call(this, response["results"]);
            });
        },




        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // BILLING PROVIDER CONFIGURATIONS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists the billing provider configurations.
         *
         * @param pagination
         *
         * @chained billing provider configuration map
         */
        listBillingProviderConfigurations: function(pagination)
        {
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var chainable = this.getFactory().billingProviderConfigurationMap(this);
            return this.chainGet(chainable, "/billing/configurations", params);
        },

        /**
         * Reads a billing provider configuration.
         *
         * @param billingProviderConfigurationId
         *
         * @chained billing provider configuration
         */
        readBillingProviderConfiguration: function(billingProviderConfigurationId)
        {
            var chainable = this.getFactory().billingProviderConfiguration(this);
            return this.chainGet(chainable, "/billing/configurations/" + billingProviderConfigurationId);
        },

        /**
         * Create a billing provider configuration.
         *
         * @chained billing provider configuration
         *
         * @param {String} providerId
         * @param [Object] object JSON object
         */
        createBillingProviderConfiguration: function(providerId, object)
        {
            if (!object)
            {
                object = {};
            }
            object["providerId"] = providerId;

            var chainable = this.getFactory().billingProviderConfiguration(this);
            return this.chainCreate(chainable, object, "/billing/configurations");
        },

        /**
         * Queries for billing provider configurations.
         *
         * @chained billing provider configuration map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryBillingProviderConfigurations: function(query, pagination)
        {
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return "/billing/configurations/query";
            };

            var chainable = this.getFactory().billingProviderConfigurationMap(this);
            return this.chainPost(chainable, uriFunction, params, query);
        },

        /**
         * Performs a bulk check of permissions against permissioned objects of type billing provider configuration.
         *
         * Example of checks array:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>"
         * }]
         *
         * The callback receives an array of results, example:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>",
         *    "result": true
         * }]
         *
         * The order of elements in the array will be the same for checks and results.
         *
         * @param checks
         * @param callback
         */
        checkBillingProviderConfigurationPermissions: function(checks, callback)
        {
            var uriFunction = function()
            {
                return "/billing/configurations/permissions/check";
            };

            var object = {
                "checks": checks
            };

            return this.chainPostResponse(this, uriFunction, {}, object).then(function(response) {
                callback.call(this, response["results"]);
            });
        },


        /////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // WEB HOSTS
        //
        /////////////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists web hosts.
         *
         * @chained web host map
         *
         * @param [Object] pagination pagination (optional)
         */
        listWebHosts: function(pagination)
        {
            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var chainable = this.getFactory().webhostMap(this);
            return this.chainGet(chainable, "/webhosts", params);
        },

        /**
         * Read a web host
         *
         * @chained web host
         *
         * @param {String} webhostId the web host id
         */
        readWebHost: function(webhostId)
        {
            var chainable = this.getFactory().webhost(this);
            return this.chainGet(chainable, "/webhosts/" + webhostId);
        },

        /**
         * Create a web host.
         *
         * @chained web host
         *
         * @param [Object] object JSON object
         */
        createWebHost: function(object)
        {
            var chainable = this.getFactory().webhost(this);
            return this.chainCreate(chainable, object, "/webhosts");
        },

        /**
         * Queries for web hosts.
         *
         * @chained web host map
         *
         * @param {Object} query Query for finding web hosts.
         * @param [Object] pagination pagination (optional)
         */
        queryWebHosts: function(query, pagination)
        {
            var chainable = this.getFactory().webhostMap(this);

            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            return this.chainPost(chainable, "/webhosts/query", params, query);
        },

        /**
         * Performs a bulk check of permissions against permissioned objects of type web host.
         *
         * Example of checks array:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>"
         * }]
         *
         * The callback receives an array of results, example:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>",
         *    "result": true
         * }]
         *
         * The order of elements in the array will be the same for checks and results.
         *
         * @param checks
         * @param callback
         */
        checkWebHostPermissions: function(checks, callback)
        {
            var uriFunction = function()
            {
                return "/webhosts/permissions/check";
            };

            var object = {
                "checks": checks
            };

            return this.chainPostResponse(this, uriFunction, {}, object).then(function(response) {
                callback.call(this, response["results"]);
            });
        },



        /////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // WARE HOUSES
        //
        /////////////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists warehouses
         *
         * @chained warehouse map
         *
         * @param [Object] pagination pagination (optional)
         */
        listWarehouses: function(pagination)
        {
            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var chainable = this.getFactory().warehouseMap(this);
            return this.chainGet(chainable, "/warehouses", params);
        },

        /**
         * Read a warehouse
         *
         * @chained warehouse
         *
         * @param {String} warehouseId
         */
        readWarehouse: function(warehouseId)
        {
            var chainable = this.getFactory().warehouse(this);
            return this.chainGet(chainable, "/warehouses/" + warehouseId);
        },

        /**
         * Create a warehouse.
         *
         * @chained warehouse
         *
         * @param [Object] object JSON object
         */
        createWarehouse: function(object)
        {
            var chainable = this.getFactory().warehouse(this);
            return this.chainCreate(chainable, object, "/warehouses");
        },

        /**
         * Queries for warehouses
         *
         * @chained warehouse map
         *
         * @param {Object} query Query for finding warehouses.
         * @param [Object] pagination pagination (optional)
         */
        queryWarehouses: function(query, pagination)
        {
            var chainable = this.getFactory().warehouseMap(this);

            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            return this.chainPost(chainable, "/warehouses/query", params, query);
        },

        /**
         * Performs a bulk check of permissions against permissioned objects of type warehouse
         *
         * Example of checks array:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>"
         * }]
         *
         * The callback receives an array of results, example:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>",
         *    "result": true
         * }]
         *
         * The order of elements in the array will be the same for checks and results.
         *
         * @param checks
         * @param callback
         */
        checkWarehousePermissions: function(checks, callback)
        {
            var uriFunction = function()
            {
                return "/warehouses/permissions/check";
            };

            var object = {
                "checks": checks
            };

            return this.chainPostResponse(this, uriFunction, {}, object).then(function(response) {
                callback.call(this, response["results"]);
            });
        },



        //////////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // CURRENT TENANT ATTACHMENTS
        //
        //////////////////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Hands back a map of attachments for the platform's parent tenant.
         *
         * @chained attachment map
         *
         * @public
         */
        listTenantAttachments: function()
        {
            var self = this;

            // we bind the attachment map to a modified copy of platform with the URI adjusted
            // so that it forms "/tenant/attachments/<attachmentId>" for any lookups
            var pseudoTenant = this.clone();
            pseudoTenant.getUri = function () {
                return "/tenant";
            };

            var result = this.subchain(new Gitana.BinaryAttachmentMap(pseudoTenant));
            result.then(function() {

                var chain = this;

                self.getDriver().gitanaGet(self.getUri() + "/tenant/attachments", null, {}, function(response) {
                    chain.handleResponse(response);
                    chain.next();
                });

                return false;
            });

            return result;
        },

        /**
         * Picks off a single attachment from this platform's parent tenant
         *
         * @chained attachment
         *
         * @param attachmentId
         */
        tenantAttachment: function(attachmentId)
        {
            return this.listTenantAttachments().select(attachmentId);
        },

        /**
         * Creates an attachment to this platform's parent tenant.
         *
         * When using this method from within the JS driver, it really only works for text-based content such
         * as JSON or text.
         *
         * @chained attachment
         *
         * @param attachmentId (use null or false for default attachment)
         * @param contentType
         * @param data
         */
        tenantAttach: function(attachmentId, contentType, data)
        {
            var self = this;

            var tenant = this.clone();
            tenant.getUri = function () {
                return "/tenant";
            };

            // the thing we're handing back
            var result = this.subchain(new Gitana.BinaryAttachment(tenant));

            // preload some work onto a subchain
            result.subchain().then(function() {

                // upload the attachment
                var uploadUri = self.getUri() + "/tenant/attachments/" + attachmentId;
                this.chainUpload(this, uploadUri, null, contentType, data).then(function() {

                    // read back attachment information and plug onto result
                    this.subchain(self).listTenantAttachments().then(function() {
                        this.select(attachmentId).then(function() {
                            result.handleResponse(this);
                        });
                    });
                });
            });

            return result;
        },

        /**
         * Deletes an attachment from this platform's parent tenant.
         *
         * @param attachmentId
         */
        tenantUnattach: function(attachmentId)
        {
            return this.subchain().then(function() {

                this.chainDelete(this, this.getUri() + "/tenant/attachments/" + attachmentId).then(function() {

                    // TODO

                });
            });
        },

        /**
         * Generates a URI to a preview resource.
         */
        getTenantPreviewUri: Gitana.Methods.getPreviewUri("tenant/preview"),


        /**
         * Connects to a specific application on the platform.  Preloads any application data and stack information
         * and then fires into a callback with context set to application helper.
         *
         * @param settings
         * @param callback
         */
        app: function(settings, callback)
        {
            var self = this;

            // support for null appkey
            if (Gitana.isFunction(settings)) {
                callback = settings;
                settings = null;
            }

            if (Gitana.isString(settings)) {
                settings = { "application": settings };
            }

            // build preload config
            var config = {
                "application": null,
                "appCacheKey": null
            };
            Gitana.copyKeepers(config, Gitana.loadDefaultConfig());
            Gitana.copyKeepers(config, self.getDriver().getOriginalConfiguration());
            Gitana.copyKeepers(config, settings);

            // is this app context already cached?
            //var cacheKey = self.getId() + "/" + config.application;
            var cacheKey = config.appCacheKey;
            if (cacheKey)
            {
                if (Gitana.APPS && Gitana.APPS[cacheKey])
                {
                    callback.call(Chain(Gitana.APPS[cacheKey]));
                    return;
                }
            }

            if (!config.application) {
                callback.call(self, new Error("No application configured"));
                return;
            }

            // load and cache
            var helper = new Gitana.AppHelper(self, config);
            if (!Gitana.APPS) {
                Gitana.APPS = {};
            }

            helper.init.call(helper, function(err) {

                if (err)
                {
                    callback(err);
                    return;
                }

                if (cacheKey)
                {
                    Gitana.APPS[cacheKey] = helper;
                }

                callback.call(Chain(helper));
            });
        },



        /**
         * Retrieves authorities and permissions for multiple reference/principal combinations.
         *
         * Example of entries array:
         *
         * [{
         *    "permissioned": "<permissionedReference>",
         *    "principalId": "<principalId>"
         * }]
         *
         * The callback receives an array of results, example:
         *
         * [{
         *    "permissioned": "<permissionedReference>",
         *    "principalId": "<principalId>",
         *    "authorities": [...],
         *    "permissions": [...]
         * }]
         *
         * The order of elements in the array will be the same for checks and results.
         *
         * @param checks
         * @param callback
         */
        accessLookups: function(entries, callback)
        {
            var uriFunction = function()
            {
                return "/access/lookup";
            };

            var object = {
                "entries": entries
            };

            return this.chainPostResponse(this, uriFunction, {}, object).then(function(response) {
                callback.call(this, response["entries"]);
            });
        },

        /**
         * Retrieves authorities and permissions for multiple reference/principal combinations.
         *
         * Example of entries array:
         *
         * [{
         *    "permissioned": "<permissionedReference>",
         *    "principalId": "<principalId>"
         * }]
         *
         * The callback receives an array of results, example:
         *
         * [{
         *    "permissioned": "<permissionedReference>",
         *    "principalId": "<principalId>",
         *    "permissionId|authorityId": "<permissionId|authorityId>",
         *    "hasPermission|hasAuthority": true | false
         * }]
         *
         * The order of elements in the array will be the same for checks and results.
         *
         * @param checks
         * @param callback
         */
        accessChecks: function(entries, callback)
        {
            var uriFunction = function()
            {
                return "/access/check";
            };

            var object = {
                "entries": entries
            };

            return this.chainPostResponse(this, uriFunction, {}, object).then(function(response) {
                callback.call(this, response["entries"]);
            });
        },

        /**
         * Reads one or more referenceable objects by reference id.
         *
         * Example of entries array:
         *
         * [{
         *    "ref": "<reference>"
         * }]
         *
         * The callback receives an array of results, example:
         *
         * [{
         *    "ref": "<reference>",
         *    "entry": { ... object }
         * }]
         *
         * The order of elements in the array will be the same for checks and results.
         *
         * @param checks
         * @param callback
         */
        referenceReads: function(entries, callback)
        {
            var uriFunction = function()
            {
                return "/ref/read";
            };

            var object = {
                "entries": entries
            };

            return this.chainPostResponse(this, uriFunction, {}, object).then(function(response) {
                callback.call(this, response["entries"]);
            });
        },

        ///////////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // ADMIN
        //
        ///////////////////////////////////////////////////////////////////////////////////////////////////////

        adminIndexDatastores: function()
        {
            var self = this;

            return this.then(function() {

                var chain = this;

                // call
                var uri = self.getUri() + "/admin/index";
                self.getDriver().gitanaPost(uri, null, {}, function(response) {
                    chain.next();
                });

                // NOTE: we return false to tell the chain that we'll manually call next()
                return false;
            });
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.AbstractPlatformDataStore = Gitana.ContainedDataStore.extend(
    /** @lends Gitana.AbstractPlatformDataStore.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.DataStore
         *
         * @class AbstractPlatformDataStore
         *
         * @param {Gitana.Platform} platform
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(platform, object)
        {
            this.base(platform, object);


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.getPlatform = function()
            {
                return platform;
            };

            this.getPlatformId = function()
            {
                return platform.getId();
            };

            this.getCluster = function()
            {
                return platform.getCluster();
            };

            this.getClusterId = function()
            {
                return platform.getClusterId();
            };

        },



        //////////////////////////////////////////////////////////////////////////////////////////////
        //
        // COPY
        //
        //////////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Copies this object into the target.
         *
         * @chained job
         *
         * @param target
         * @param asynchronous
         */
        copy: function(target, asynchronous)
        {
            var self = this;

            var payload = {
                "sources": Gitana.toCopyDependencyChain(this),
                "targets": Gitana.toCopyDependencyChain(target)
            };

            // we continue the chain with a job
            var chainable = this.getFactory().job(this.getCluster(), "copy");

            // fire off copy and job queue checking
            return this.link(chainable).then(function() {

                var chain = this;

                // create
                this.getDriver().gitanaPost("/tools/copy?schedule=ASYNCHRONOUS", {}, payload, function(response) {

                    Gitana.handleJobCompletion(chain, self.getCluster(), response.getId(), !asynchronous);

                }, function(http) {
                    self.httpError(http);
                });

                // NOTE: we return false to tell the chain that we'll manually call next()
                return false;
            });
        },

        /**
         * Finds the stack for this data store.
         *
         * @param datastoreType
         * @param datastoreId
         *
         * @chained stack
         */
        findStack: function()
        {
            return this.subchain(this.getPlatform()).findStackForDataStore(this.getType(), this.getId());
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.AbstractPlatformObject = Gitana.AbstractSelfableACLObject.extend(
    /** @lends Gitana.AbstractPlatformObject.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractSelfableACLObject
         *
         * @class AbstractPlatformObject
         *
         * @param {Gitana.Platform} platform
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(platform, object)
        {
            this.base(platform.getDriver(), object);


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.getPlatform = function()
            {
                return platform;
            };

            this.getPlatformId = function()
            {
                return platform.getId();
            };

            this.getCluster = function()
            {
                return platform.getCluster();
            };

            this.getClusterId = function()
            {
                return platform.getClusterId();
            };

        },


        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // TRANSFER
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Exports an archive.
         *
         * @chained job
         *
         * @param {Object} settings
         */
        exportArchive: function(settings)
        {
            var self = this;

            var vaultId = settings.vault;
            if (!Gitana.isString(vaultId))
            {
                vaultId = vaultId.getId();
            }
            var groupId = settings.group;
            var artifactId = settings.artifact;
            var versionId = settings.version;
            var configuration = (settings.configuration ? settings.configuration : {});
            var synchronous = (settings.async ? false : true);

            // we continue the chain with a job
            var chainable = this.getFactory().job(this.getCluster(), "export");

            // fire off import and job queue checking
            return this.link(chainable).then(function() {

                var chain = this;

                // create
                this.getDriver().gitanaPost(self.getUri() + "/export?vault=" + vaultId + "&group=" + groupId + "&artifact=" + artifactId + "&version=" + versionId + "&schedule=ASYNCHRONOUS", {}, configuration, function(response) {

                    Gitana.handleJobCompletion(chain, self.getCluster(), response.getId(), synchronous);

                }, function(http) {
                    self.httpError(http);
                });

                // NOTE: we return false to tell the chain that we'll manually call next()
                return false;
            });
        },

        /**
         * Imports an archive.
         *
         * @chained job
         *
         * @param {Object} settings
         */
        importArchive: function(settings)
        {
            var self = this;

            var vaultId = settings.vault;
            if (!Gitana.isString(vaultId))
            {
                vaultId = vaultId.getId();
            }
            var groupId = settings.group;
            var artifactId = settings.artifact;
            var versionId = settings.version;
            var configuration = (settings.configuration ? settings.configuration : {});
            var synchronous = (settings.async ? false : true);

            // we continue the chain with a job
            var chainable = this.getFactory().job(this.getCluster(), "import");

            // fire off import and job queue checking
            return this.link(chainable).then(function() {

                var chain = this;

                // create
                this.getDriver().gitanaPost(self.getUri() + "/import?vault=" + vaultId + "&group=" + groupId + "&artifact=" + artifactId + "&version=" + versionId + "&schedule=ASYNCHRONOUS", {}, configuration, function(response) {

                    Gitana.handleJobCompletion(chain, self.getCluster(), response.getId(), synchronous);

                }, function(http) {
                    self.httpError(http);
                });

                // NOTE: we return false to tell the chain that we'll manually call next()
                return false;
            });

        },


        //////////////////////////////////////////////////////////////////////////////////////////////
        //
        // COPY
        //
        //////////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Copies this object into the target.
         *
         * @chained job
         *
         * @param target
         * @param asynchronous
         */
        copy: function(target, asynchronous)
        {
            var self = this;

            var payload = {
                "sources": Gitana.toCopyDependencyChain(this),
                "targets": Gitana.toCopyDependencyChain(target)
            };

            // we continue the chain with a job
            var chainable = this.getFactory().job(this.getCluster(), "copy");

            // fire off copy and job queue checking
            return this.link(chainable).then(function() {

                var chain = this;

                // create
                this.getDriver().gitanaPost("/tools/copy?schedule=ASYNCHRONOUS", {}, payload, function(response) {

                    Gitana.handleJobCompletion(chain, self.getCluster(), response.getId(), !asynchronous);

                }, function(http) {
                    self.httpError(http);
                });

                // NOTE: we return false to tell the chain that we'll manually call next()
                return false;
            });
        }


    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.AbstractPlatformObjectMap = Gitana.AbstractMap.extend(
    /** @lends Gitana.AbstractPlatformObjectMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractMap
         *
         * @class AbstractPlatformObjectMap
         *
         * @param {Gitana.Platform} platform Gitana platform instance.
         * @param [Object] object
         */
        constructor: function(platform, object)
        {
            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.getPlatform = function()
            {
                return platform;
            };

            this.getPlatformId = function()
            {
                return platform.getId();
            };

            this.getCluster = function()
            {
                return platform.getCluster();
            };

            this.getClusterId = function()
            {
                return platform.getClusterId();
            };

            // NOTE: call this last
            this.base(platform.getDriver(), object);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.Stack = Gitana.AbstractPlatformObject.extend(
    /** @lends Gitana.Stack.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObject
         *
         * @class Stack
         *
         * @param {Gitana.Platform} platform
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(platform, object)
        {
            this.base(platform, object);

            this.objectType = function() { return "Gitana.Stack"; };
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_STACK;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/stacks/" + this.getId();
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().stack(this.getPlatform(), this);
        },

        getKey: function()
        {
            return this.get("key");
        },





        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // TEAMABLE
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Reads a team.
         *
         * @param teamKey
         *
         * @chainable team
         */
        readTeam: function(teamKey)
        {
            var uriFunction = function()
            {
                return this.getUri() + "/teams/" + teamKey;
            };

            var chainable = this.getFactory().team(this.getPlatform(), this);
            return this.chainGet(chainable, uriFunction);
        },

        /**
         * Lists teams.
         *
         * @chainable map of teams
         */
        listTeams: function()
        {
            var uriFunction = function()
            {
                return this.getUri() + "/teams";
            };

            var chainable = this.getFactory().teamMap(this.getCluster(), this);
            return this.chainGet(chainable, uriFunction);
        },

        /**
         * Creates a team.
         *
         * @param teamKey
         * @param object
         *
         * @chainable team
         */
        createTeam: function(teamKey, object)
        {
            if (!object)
            {
                object = {};
            }

            var uriFunction = function()
            {
                return this.getUri() + "/teams?key=" + teamKey;
            };

            var self = this;

            var chainable = this.getFactory().team(this.getPlatform(), this);
            return this.chainPostResponse(chainable, uriFunction, {}, object).then(function() {

                var chain = this;

                Chain(self).readTeam(teamKey).then(function() {
                    chain.handleResponse(this);
                    chain.next();
                });

                // we manually advance the chain
                return false;
            });
        },

        /**
         * Gets the owners team
         *
         * @chained team
         */
        readOwnersTeam: function()
        {
            return this.readTeam("owners");
        },

        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // END OF TEAMABLE
        //
        //////////////////////////////////////////////////////////////////////////////////////////




        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // ROLE CONTAINER
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Reads a role.
         *
         * @param roleKeyOrId
         * @param inherited whether to check inherited role containers
         *
         * @chainable role
         */
        readRole: function(roleKeyOrId, inherited)
        {
            var params = {};

            if (inherited)
            {
                params.inherited = true;
            }

            var uriFunction = function()
            {
                return this.getUri() + "/roles/" + roleKeyOrId;
            };

            var chainable = this.getFactory().role(this.getCluster(), this);
            return this.chainGet(chainable, uriFunction, params);
        },

        /**
         * Lists roles.
         *
         * @param inherited whether to draw from inherited role containers
         *
         * @chainable map of teams
         */
        listRoles: function(inherited)
        {
            var params = {};

            if (inherited)
            {
                params.inherited = true;
            }

            var uriFunction = function()
            {
                return this.getUri() + "/roles";
            };

            var chainable = this.getFactory().roleMap(this.getCluster(), this);
            return this.chainGet(chainable, uriFunction, params);
        },

        /**
         * Creates a role.
         *
         * @param roleKey
         * @param object
         *
         * @chainable team
         */
        createRole: function(roleKey, object)
        {
            if (!object)
            {
                object = {};
            }
            object.roleKey = roleKey;

            var uriFunction = function()
            {
                return this.getUri() + "/roles";
            };

            var self = this;

            var chainable = this.getFactory().role(this.getPlatform(), this, roleKey);
            return this.chainPostResponse(chainable, uriFunction, {}, object).then(function() {
                this.subchain(self).readRole(roleKey).then(function() {
                    Gitana.copyInto(chainable, this);
                });
            });
        },

        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // END OF ROLE CONTAINER
        //
        //////////////////////////////////////////////////////////////////////////////////////////






        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // ATTACHMENTS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Hands back an attachments map.
         *
         * @chained attachment map
         *
         * @param local
         *
         * @public
         */
        listAttachments: Gitana.Methods.listAttachments(),

        /**
         * Picks off a single attachment
         *
         * @chained attachment
         *
         * @param attachmentId
         */
        attachment: function(attachmentId)
        {
            return this.listAttachments().select(attachmentId);
        },

        /**
         * Creates an attachment.
         *
         * When using this method from within the JS driver, it really only works for text-based content such
         * as JSON or text.
         *
         * @chained attachment
         *
         * @param attachmentId (use null or false for default attachment)
         * @param contentType
         * @param data
         */
        attach: Gitana.Methods.attach(),

        /**
         * Deletes an attachment.
         *
         * @param attachmentId
         */
        unattach: Gitana.Methods.unattach(),

        /**
         * Generates a URI to a preview resource.
         */
        getPreviewUri: Gitana.Methods.getPreviewUri(),



        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // LOGS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Queries for log entries.
         *
         * @chained log entry map
         *
         * @param {Object} query Query for finding log entries.
         * @param [Object] pagination pagination (optional)
         */
        queryLogEntries: function(query, pagination)
        {
            var self = this;
            var uriFunction = function()
            {
                return self.getUri() + "/logs/query";
            };

            if (!query)
            {
                query = {};
            }

            var chainable = this.getFactory().logEntryMap(this.getCluster());

            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            return this.chainPost(chainable, uriFunction, params, query);
        },

        /**
         * Read a log entry.
         *
         * @chained log entry
         *
         * @param {String} jobId
         */
        readLogEntry: function(logEntryId)
        {
            var self = this;
            var uriFunction = function()
            {
                return self.getUri() + "/logs/" + logEntryId;
            };

            var chainable = this.getFactory().logEntry(this.getCluster());

            return this.chainGet(chainable, uriFunction);
        },



        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // STACK OPERATIONS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Assigns a data store to the stack
         * It takes datastore and key (optional) as input or a json object than contains
         * datastore type, id and key (optional)
         *
         * @chained this
         *
         * @param {Gitana.DataStore} datastore a platform datastore
         * @param {String} key optional key
         */
        assignDataStore: function(datastore, key)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/datastores/assign";
            };

            var args = Gitana.makeArray(arguments);

            var params;

            if (args.length == 1)
            {
                var arg = args.shift();

                if (arg.getType && arg.getId)
                {
                    params = {
                        "type": arg.getType(),
                        "id": arg.getId()
                    };
                }
                else
                {
                    params = arg;
                }
            }
            else
            {
                datastore = args.shift();
                key = args.shift();
                params = {
                    "type": datastore.getType(),
                    "id": datastore.getId()
                };

                if (key)
                {
                    params["key"] = key;
                }
            }

            return this.chainPostEmpty(null, uriFunction, params);
        },

        /**
         * Unassigns a data store from the stack
         *
         * @chained this
         *
         * @param {String} key optional key
         */
        unassignDataStore: function(key)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/datastores/unassign";
            };

            var params = {
                "key": key
            };

            return this.chainPostEmpty(null, uriFunction, params);

        },

        /**
         * Lists the data stores in this stack.
         *
         * @chained datastore map
         *
         * @param pagination
         */
        listDataStores: function(pagination)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/datastores";
            };

            var chainable = this.getFactory().platformDataStoreMap(this.getPlatform());

            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            return this.chainGet(chainable, uriFunction, params);
        },

        /**
         * Lists the data stores in this stack.
         *
         * @chained datastore map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryDataStores: function(query, pagination)
        {
            var self = this;

            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return self.getUri() + "/datastores/query";
            };

            var chainable = this.getFactory().platformDataStoreMap(this.getPlatform());

            return this.chainPost(chainable, uriFunction, params, query);
        },

        /**
         * Checks whether a datastore exists for the given key on this stack.
         * This passes the result (true/false) to the chaining function.
         *
         * @chained this
         *
         * @param {String} key the datastore key
         * @param {Function} callback
         */
        existsDataStore: function(key, callback)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/datastores/exists?key=" + key;
            };

            return this.chainPostResponse(this, uriFunction).then(function(response) {
                callback.call(this, response["exists"]);
            });
        },

        /**
         * Reads a data store for this stack by its key.
         *
         * @chained this
         *
         * @param {String} key the datastore key
         * @param [callback] a callback receiver to grab the actual typed object once retrieved
         */
        readDataStore: function(key, callback)
        {
            var self = this;

            return this.then(function() {

                var chain = this;

                Chain(self).queryDataStores().then(function() {

                    var datastore = this[key];
                    datastore["_doc"] = datastore["datastoreId"];
                    delete datastore["datastoreTypeId"];

                    if (callback)
                    {
                        callback.call(datastore);
                    }

                    chain.next();
                });

                // NOTE: we return false to tell the chain that we'll manually call next()
                return false;
            });
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.StackMap = Gitana.AbstractPlatformObjectMap.extend(
    /** @lends Gitana.StackMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractMap
         *
         * @class Map of stacks
         *
         * @param {Gitana.Platform} platform Gitana platform instance.
         * @param [Object] object
         */
        constructor: function(platform, object)
        {
            this.objectType = function() { return "Gitana.StackMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(platform, object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().stackMap(this.getPlatform(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().stack(this.getPlatform(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.Client = Gitana.AbstractPlatformObject.extend(
    /** @lends Gitana.Client.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObject
         *
         * @class Client
         *
         * @param {Gitana.Platform} platform
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(platform, object)
        {
            this.base(platform, object);

            this.objectType = function() { return "Gitana.Client"; };
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_CLIENT;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/clients/" + this.getId();
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().client(this.getPlatform(), this);
        },

        /**
         * Gets the authorized grant types for the client
         */
        getAuthorizedGrantTypes: function()
        {
            return this.get("authorizedGrantTypes");
        },

        /**
         * Gets the scope for the client
         */
        getScope: function()
        {
            return this.get("scope");
        },

        /**
         * Gets the allow open driver authentication option for the client
         */
        getAllowOpenDriverAuthentication: function()
        {
            return this.get("allowOpenDriverAuthentication");
        },

        /**
         * Returns whether the client is enabled or not
         */
        getEnabled: function()
        {
            return this.get("enabled");
        },

        /**
         * Lists the authentication grants for this client
         *
         * @param pagination
         *
         * @chained authentication grant map
         */
        listAuthenticationGrants: function(pagination)
        {
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            params.clientId = this.getId();

            var chainable = this.getFactory().authenticationGrantMap(this.getPlatform());
            return this.chainGet(chainable, "/auth/grants", params);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.ClientMap = Gitana.AbstractPlatformObjectMap.extend(
    /** @lends Gitana.ClientMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractMap
         *
         * @class Map of clients
         *
         * @param {Gitana.Platform} platform Gitana platform instance.
         * @param [Object] object
         */
        constructor: function(platform, object)
        {
            this.objectType = function() { return "Gitana.ClientMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(platform, object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().clientMap(this.getPlatform(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().client(this.getPlatform(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.AuthenticationGrant = Gitana.AbstractPlatformObject.extend(
    /** @lends Gitana.AuthenticationGrant.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObject
         *
         * @class AuthenticationGrant
         *
         * @param {Gitana.Platform} platform
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(platform, object)
        {
            this.base(platform, object);

            this.objectType = function() { return "Gitana.AuthenticationGrant"; };
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_AUTHENTICATION_GRANT;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/auth/grants/" + this.getId();
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().authenticationGrant(this.getPlatform(), this);
        },


        ///////////////////////////////
        // AUTH GRANT OPERATIONS
        ///////////////////////////////

        getKey: function()
        {
            return this.get("key");
        },

        getSecret: function()
        {
            return this.get("secret");
        },

        getPrincipalDomainId: function()
        {
            return this.get("principalDomainId");
        },

        getPrincipalId: function()
        {
            return this.get("principalId");
        },

        getClientId: function()
        {
            return this.get("clientId");
        },

        getEnabled: function()
        {
            return this.get("enabled");
        },

        getAllowOpenDriverAuthentication: function()
        {
            return this.get("allowOpenDriverAuthentication");
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.AuthenticationGrantMap = Gitana.AbstractPlatformObjectMap.extend(
    /** @lends Gitana.AuthenticationGrantMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractMap
         *
         * @class Map of authentication grants
         *
         * @param {Gitana.Platform} platform Gitana platform instance.
         * @param [Object] object
         */
        constructor: function(platform, object)
        {
            this.objectType = function() { return "Gitana.AuthenticationGrantMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(platform, object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().authenticationGrantMap(this.getPlatform(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().authenticationGrant(this.getPlatform(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.PlatformDataStoreMap = Gitana.AbstractMap.extend(
    /** @lends Gitana.PlatformDataStoreMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractMap
         *
         * @class Map of platform datastore objects
         *
         * @param {Gitana} platform Gitana platform
         * @param {Object} object
         */
        constructor: function(platform, object)
        {
            this.objectType = function() { return "Gitana.PlatformDataStoreMap"; };

            this.getPlatform = function()
            {
                return platform;
            };

            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(platform.getDriver(), object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().platformDataStoreMap(this.getPlatform(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().platformDataStore(this.getPlatform(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.BillingProviderConfiguration = Gitana.AbstractPlatformObject.extend(
    /** @lends Gitana.BillingProviderConfiguration.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObject
         *
         * @class BillingProviderConfiguration
         *
         * @param {Gitana.Platform} platform
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(platform, object)
        {
            this.base(platform, object);

            this.objectType = function() { return "Gitana.BillingProviderConfiguration"; };
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_BILLING_PROVIDER_CONFIGURATION;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/billing/configurations/" + this.getId();
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().billingProviderConfiguration(this.getPlatform(), this);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.BillingProviderConfigurationMap = Gitana.AbstractPlatformObjectMap.extend(
    /** @lends Gitana.BillingProviderConfigurationMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractMap
         *
         * @class Map of billing provider configurations
         *
         * @param {Gitana.Platform} platform Gitana platform instance.
         * @param [Object] object
         */
        constructor: function(platform, object)
        {
            this.objectType = function() { return "Gitana.BillingProviderConfigurationMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(platform, object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().billingProviderConfigurationMap(this.getPlatform(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().billingProviderConfiguration(this.getPlatform(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.Project = Gitana.AbstractPlatformObject.extend(
    /** @lends Gitana.Project.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObject
         *
         * @class Project
         *
         * @param {Gitana.Platform} platform
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(platform, object)
        {
            this.base(platform, object);

            this.objectType = function() { return "Gitana.Project"; };
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_PROJECT;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/projects/" + this.getId();
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().project(this.getPlatform(), this);
        },




        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // ATTACHMENTS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Hands back an attachments map.
         *
         * @chained attachment map
         *
         * @param local
         *
         * @public
         */
        listAttachments: Gitana.Methods.listAttachments(),

        /**
         * Picks off a single attachment
         *
         * @chained attachment
         *
         * @param attachmentId
         */
        attachment: function(attachmentId)
        {
            return this.listAttachments().select(attachmentId);
        },

        /**
         * Creates an attachment.
         *
         * When using this method from within the JS driver, it really only works for text-based content such
         * as JSON or text.
         *
         * @chained attachment
         *
         * @param attachmentId (use null or false for default attachment)
         * @param contentType
         * @param data
         */
        attach: Gitana.Methods.attach(),

        /**
         * Deletes an attachment.
         *
         * @param attachmentId
         */
        unattach: Gitana.Methods.unattach(),

        /**
         * Generates a URI to a preview resource.
         */
        getPreviewUri: Gitana.Methods.getPreviewUri(),

        /**
         * Reads the stack for the project, if it exists.
         *
         * @chained stack
         */
        readStack: function()
        {
            return this.subchain(this.getPlatform()).readStack(this["stackId"]);
        },

        ///////////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // ADMIN
        //
        ///////////////////////////////////////////////////////////////////////////////////////////////////////

        adminMaintenance: function()
        {
            var self = this;

            return this.then(function() {

                var chain = this;

                // call
                var uri = self.getUri() + "/admin/maintenance";
                self.getDriver().gitanaPost(uri, null, {}, function(response) {
                    chain.next();
                });

                // NOTE: we return false to tell the chain that we'll manually call next()
                return false;
            });
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.ProjectMap = Gitana.AbstractPlatformObjectMap.extend(
    /** @lends Gitana.ProjectMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractMap
         *
         * @class Map of stacks
         *
         * @param {Gitana.Platform} platform Gitana platform instance.
         * @param [Object] object
         */
        constructor: function(platform, object)
        {
            this.objectType = function() { return "Gitana.ProjectMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(platform, object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().projectMap(this.getPlatform(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().project(this.getPlatform(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.ClientMethods =
    {
        getKey: function()
        {
            return this.get("key");
        },

        getSecret: function()
        {
            return this.get("secret");
        },

        getDomainUrls: function()
        {
            return this.get("domainUrls");
        },

        getIsTenantDefault: function()
        {
            return this.get("isTenantDefault");
        },

        getDefaultTenantId: function()
        {
            return this.get("defaultTenantId");
        },

        getAuthorizedGrantTypes: function()
        {
            return this.get("authorizedGrantTypes");
        },

        getScope: function()
        {
            return this.get("scope");
        },

        getRegisteredRedirectUri: function()
        {
            return this.get("registeredRedirectUri");
        },

        getAllowOpenDriverAuthentication: function()
        {
            return this.get("allowOpenDriverAuthentication");
        },

        getEnabled: function()
        {
            return this.get("enabled");
        },

        getAllowAutoApprovalForImplicitFlow: function()
        {
            return this.get("allowAutoApprovalForImplicitFlow");
        }
    };

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.Application = Gitana.AbstractPlatformDataStore.extend(
    /** @lends Gitana.Application.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObject
         *
         * @class Application
         *
         * @param {Gitana.Platform} platform
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(platform, object)
        {
            this.objectType = function() { return "Gitana.Application"; };

            this.base(platform, object);
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/applications/" + this.getId();
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_APPLICATION;
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().application(this.getPlatform(), this);
        },

        /**
         * Lists the auto-client mappings maintained for this application.
         *
         * @param callback the callback function
         * @param pagination
         *
         * @chained this
         */
        listAutoClientMappingObjects: function(callback, pagination)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/autoclientmappings";
            };

            // parameters
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            return this.chainGetResponse(this, uriFunction, params).then(function(response) {
                callback.call(this, response["rows"]);
            });
        },

        /**
         * Lists the trusted domain mappings maintained for this application.
         *
         * @param callback the callback function
         * @param pagination
         *
         * @chained this
         */
        listTrustedDomainMappingObjects: function(callback, pagination)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/trusteddomainmappings";
            };

            // parameters
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            return this.chainGetResponse(this, uriFunction, params).then(function(response) {
                callback.call(this, response["rows"]);
            });
        },


        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // SETTINGS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Create settings
         *
         * @chained settings
         *
         * @param [Object] object JSON object
         */
        createSettings: function(object)
        {
            var self = this;

            // Makes sure we have an empty settings key
            if (object["settings"] == null)
            {
                object["settings"] = {};
            }

            var uriFunction = function()
            {
                return self.getUri() + "/settings";
            };

            var chainable = this.getFactory().settings(this);
            return this.chainCreate(chainable, object, uriFunction);
        },

        /**
         * Lists the settings.
         *
         * @param pagination
         *
         * @chained settings map
         */
        listSettings: function(pagination)
        {
            var self = this;

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return self.getUri() + "/settings";
            };

            var chainable = this.getFactory().settingsMap(this);
            return this.chainGet(chainable, uriFunction, params);
        },

        /**
         * Reads an setting.
         *
         * @param settingId
         *
         * @chained settings
         */
        readSettings: function(settingId)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/settings/" + settingId;
            };

            var chainable = this.getFactory().settings(this);
            return this.chainGet(chainable, uriFunction);
        },

        /**
         * Queries for settings.
         *
         * @chained settings map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        querySettings: function(query, pagination)
        {
            var self = this;

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return self.getUri() + "/settings/query";
            };

            var chainable = this.getFactory().settingsMap(this);
            return this.chainPost(chainable, uriFunction, params, query);
        },

        /**
         * Reads the application settings for the given scope and key.
         * If the settings doesn't exist, creates an empty one.
         *
         * @param {String} scope (optional)
         * @param {String} key (optional)
         */
        readApplicationSettings: function(scope,  key)
        {
            var self = this;

            if (scope == null)
            {
                scope = "application";
            }

            if (key == null)
            {
                key = "application";
            }

            var object = {
                "scope" : scope,
                "key" : key
            };

            var result = this.subchain(new Gitana.Settings(this, object));
            return result.then(function() {

                var chain = this;
                var driver = self.getDriver();
                var createUri = self.getUri() + "/settings";
                var queryUri = self.getUri()  + "/settings/query";

                driver.gitanaPost(queryUri, {}, object, function(response) {
                    var settings = new Gitana.SettingsMap(self);
                    settings.handleResponse(response);
                    if (settings.__keys().length > 0)
                    {
                        var obj = settings[settings.__keys()[0]];
                        chain.loadFrom(obj);
                        chain.next();
                    }
                    else
                    {
                        object["settings"] = {};
                        driver.gitanaPost(createUri, null, object, function(status) {
                            driver.gitanaGet(createUri + "/" + status.getId(), null, {}, function(response) {
                                chain.handleResponse(response);
                                chain.next();
                            }, function(http) {
                                self.httpError(http);
                            });
                        }, function(http) {
                            self.httpError(http);
                        });
                    }
                }, function(http) {
                    self.httpError(http);
                });

                return false;
            });
        },

        /**
         * Reads the principal settings. It takes either a single Gitana.DomainPrincipal parameter
         * or a domain Id parameter and a principal Id parameter.
         */
        readApplicationPrincipalSettings: function()
        {
            var args = Gitana.makeArray(arguments);

            if (args.length == 1)
            {
                var principal = args.shift();
                return this.readApplicationSettings("principal", principal.getDomainQualifiedId());
            }
            else if (args.length == 2)
            {
                var domainId = args.shift();
                var principalId = args.shift();
                return this.readApplicationSettings("principal", domainId + "/" + principalId);
            }

        },

        /**
         * Performs a bulk check of permissions against permissioned objects of type settings.
         *
         * Example of checks array:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>"
         * }]
         *
         * The callback receives an array of results, example:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>",
         *    "result": true
         * }]
         *
         * The order of elements in the array will be the same for checks and results.
         *
         * @param checks
         * @param callback
         */
        checkSettingPermissions: function(checks, callback)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/settings/permissions/check";
            };

            var object = {
                "checks": checks
            };

            return this.chainPostResponse(this, uriFunction, {}, object).then(function(response) {
                callback.call(this, response["results"]);
            });
        },




        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // REGISTRATIONS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Create registration
         *
         * @chained registration
         *
         * @param [Object] object JSON object
         */
        createRegistration: function(object)
        {
            var self = this;

            var chainable = this.getFactory().registration(this);

            var uriFunction = function()
            {
                return self.getUri() + "/registrations";
            };

            return this.chainCreate(chainable, object, uriFunction);
        },

        /**
         * Lists the registrations.
         *
         * @param pagination
         *
         * @chained registration map
         */
        listRegistrations: function(pagination)
        {
            var self = this;

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return self.getUri() + "/registrations";
            };

            var chainable = this.getFactory().registrationMap(this);
            return this.chainGet(chainable, uriFunction, params);
        },

        /**
         * Reads a registration.
         *
         * @param registrationId
         *
         * @chained registration
         */
        readRegistration: function(registrationId)
        {
            var self = this;

            var chainable = this.getFactory().registration(this);

            var uriFunction = function()
            {
                return self.getUri() + "/registrations/" + registrationId;
            };

            return this.chainGet(chainable, uriFunction);
        },

        /**
         * Queries for registrations.
         *
         * @chained registration map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryRegistrations: function(query, pagination)
        {
            var self = this;

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return self.getUri() + "/registrations/query";
            };

            var chainable = this.getFactory().registrationMap(this);
            return this.chainPost(chainable, uriFunction, params, query);
        },

        /**
         * Performs a bulk check of permissions against permissioned objects of type registration.
         *
         * Example of checks array:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>"
         * }]
         *
         * The callback receives an array of results, example:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>",
         *    "result": true
         * }]
         *
         * The order of elements in the array will be the same for checks and results.
         *
         * @param checks
         * @param callback
         */
        checkRegistrationPermissions: function(checks, callback)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/registrations/permissions/check";
            };

            var object = {
                "checks": checks
            };

            return this.chainPostResponse(this, uriFunction, {}, object).then(function(response) {
                callback.call(this, response["results"]);
            });
        },




        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // EMAIL PROVIDERS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Create email provider
         *
         * @chained email provider
         *
         * @param [Object] object JSON object
         */
        createEmailProvider: function(object)
        {
            var self = this;

            var chainable = this.getFactory().emailProvider(this);

            var uriFunction = function()
            {
                return self.getUri() + "/emailproviders";
            };

            return this.chainCreate(chainable, object, uriFunction);
        },

        /**
         * Lists the email providers.
         *
         * @param pagination
         *
         * @chained email provider map
         */
        listEmailProviders: function(pagination)
        {
            var self = this;

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return self.getUri() + "/emailproviders";
            };

            var chainable = this.getFactory().emailProviderMap(this);
            return this.chainGet(chainable, uriFunction, params);
        },

        /**
         * Reads an email provider.
         *
         * @param emailProviderId
         *
         * @chained emailProvider
         */
        readEmailProvider: function(emailProviderId)
        {
            var self = this;

            var chainable = this.getFactory().emailProvider(this);

            var uriFunction = function()
            {
                return self.getUri() + "/emailproviders/" + emailProviderId;
            };

            return this.chainGet(chainable, uriFunction);
        },

        /**
         * Queries for email providers.
         *
         * @chained email provider map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryEmailProviders: function(query, pagination)
        {
            var self = this;

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return self.getUri() + "/emailproviders/query";
            };

            var chainable = this.getFactory().emailProviderMap(this);
            return this.chainPost(chainable, uriFunction, params, query);
        },

        /**
         * Performs a bulk check of permissions against permissioned objects of type emailprovider.
         *
         * Example of checks array:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>"
         * }]
         *
         * The callback receives an array of results, example:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>",
         *    "result": true
         * }]
         *
         * The order of elements in the array will be the same for checks and results.
         *
         * @param checks
         * @param callback
         */
        checkEmailProviderPermissions: function(checks, callback)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/emailproviders/permissions/check";
            };

            var object = {
                "checks": checks
            };

            return this.chainPostResponse(this, uriFunction, {}, object).then(function(response) {
                callback.call(this, response["results"]);
            });
        },






        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // EMAILS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Create email
         *
         * @chained email
         *
         * @param [Object] object JSON object
         */
        createEmail: function(object)
        {
            var self = this;

            var chainable = this.getFactory().email(this);

            var uriFunction = function()
            {
                return self.getUri() + "/emails";
            };

            return this.chainCreate(chainable, object, uriFunction);
        },

        /**
         * Lists the emails.
         *
         * @param pagination
         *
         * @chained email map
         */
        listEmails: function(pagination)
        {
            var self = this;

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return self.getUri() + "/emails";
            };

            var chainable = this.getFactory().emailMap(this);
            return this.chainGet(chainable, uriFunction, params);
        },

        /**
         * Reads an email.
         *
         * @param emailId
         *
         * @chained email
         */
        readEmail: function(emailId)
        {
            var self = this;

            var chainable = this.getFactory().email(this);

            var uriFunction = function()
            {
                return self.getUri() + "/emails/" + emailId;
            };

            return this.chainGet(chainable, uriFunction);
        },

        /**
         * Queries for emails.
         *
         * @chained email map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryEmails: function(query, pagination)
        {
            var self = this;

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return self.getUri() + "/emails/query";
            };

            var chainable = this.getFactory().emailMap(this);
            return this.chainPost(chainable, uriFunction, params, query);
        },

        /**
         * Performs a bulk check of permissions against permissioned objects of type email.
         *
         * Example of checks array:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>"
         * }]
         *
         * The callback receives an array of results, example:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>",
         *    "result": true
         * }]
         *
         * The order of elements in the array will be the same for checks and results.
         *
         * @param checks
         * @param callback
         */
        checkEmailPermissions: function(checks, callback)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/emails/permissions/check";
            };

            var object = {
                "checks": checks
            };

            return this.chainPostResponse(this, uriFunction, {}, object).then(function(response) {
                callback.call(this, response["results"]);
            });
        },



        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // DEPLOYMENT
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Deploys the application to the environment described by the deployment key.
         *
         * @chained deployed application
         *
         * @param deploymentKey
         */
        deploy: function(deploymentKey)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/deploy/" + deploymentKey;
            };

            // temp web host
            var webhost = new Gitana.WebHost(this.getPlatform());

            // we hand back a deployed application and preload some work
            var chainable = this.getFactory().deployedApplication(webhost);
            return this.chainPost(chainable, uriFunction).then(function() {

                // load the real web host
                var webhostId = self["deployments"][deploymentKey]["webhost"];
                this.subchain(this.getPlatform()).readWebHost(webhostId).then(function() {
                    webhost.loadFrom(this);
                });

            });
        },

        /**
         * Finds the deployed application instance for a given target deployment key.
         *
         * @chained deployed application
         *
         * @param deploymentKey
         */
        findDeployedApplication: function(deploymentKey)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/deployed/" + deploymentKey;
            };

            // temp web host
            var webhost = new Gitana.WebHost(this.getPlatform());

            // we hand back a deployed application and preload some work
            var chainable = this.getFactory().deployedApplication(webhost);
            return this.chainGet(chainable, uriFunction).then(function() {

                // load the real web host
                var webhostId = self["deployments"][deploymentKey]["webhost"];
                this.subchain(this.getPlatform()).readWebHost(webhostId).then(function() {
                    webhost.loadFrom(this);
                });

            });
        },

        /**
         * Retrieves information about a deployed application.
         *
         * @param deploymentKey
         */
        loadDeploymentInfo: function(deploymentKey, callback)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/deployed/" + deploymentKey + "/info";
            };

            return this.chainGetResponse(this, uriFunction, {}).then(function(response) {
                callback(response.info);
            });
        },

        refreshDeploymentKeys: function(deploymentKey)
        {
            var self = this;

            return this.then(function() {

                var chain = this;

                // call
                var uri = self.getUri() + "/deployments/" + deploymentKey + "/refreshkeys";
                self.getDriver().gitanaPost(uri, null, {}, function(response) {
                    chain.next();
                });

                // NOTE: we return false to tell the chain that we'll manually call next()
                return false;
            });
        }


    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.ApplicationMap = Gitana.AbstractPlatformObjectMap.extend(
    /** @lends Gitana.ApplicationMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObjectMap
         *
         * @class Map of application objects
         *
         * @param {Gitana.Platform} platform Gitana platform
         * @param {Object} object
         */
        constructor: function(platform, object)
        {
            this.objectType = function() { return "Gitana.ApplicationMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(platform, object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().applicationMap(this.getPlatform(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().application(this.getPlatform(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.Settings = Gitana.AbstractPlatformObject.extend(
    /** @lends Gitana.Settings.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObject
         *
         * @class Settings
         *
         * @param {Gitana.Application} application
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(application, object)
        {
            this.base(application.getPlatform(), object);

            this.objectType = function() { return "Gitana.Settings"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            /**
             * Gets the Gitana Application object.
             *
             * @inner
             *
             * @returns {Gitana.Application} The Gitana Application object
             */
            this.getApplication = function() { return application; };

            /**
             * Gets the Gitana Application id.
             *
             * @inner
             *
             * @returns {String} The Gitana Application id
             */
            this.getApplicationId = function() { return application.getId(); };
        },

        /**
         * @override
         */
        clone: function()
        {
            return new Gitana.Settings(this.getApplication(), this);
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_SETTINGS;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/applications/" + this.getApplicationId() + "/settings/" + this.getId();
        },

        /**
         * Returns all settings.
         */
        getSettings: function()
        {
            return this["settings"];
        },

        /**
         * Gets setting by key.
         * @param key Setting key
         */
        getSetting: function(key)
        {
            return (this.getSettings() ? this.getSettings()[key] : null);
        },

        /**
         * Sets setting.
         * 
         * @param key Setting key
         * @param val Setting value
         */
        setSetting: function(key, val)
        {
            if (!this.getSettings())
            {
                this["settings"] = {};
            }

            this["settings"][key] = val;
        },

        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // ATTACHMENTS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Hands back an attachments map.
         *
         * @chained attachment map
         *
         * @param local
         *
         * @public
         */
        listAttachments: Gitana.Methods.listAttachments(),

        /**
         * Picks off a single attachment
         *
         * @chained attachment
         *
         * @param attachmentId
         */
        attachment: function(attachmentId)
        {
            return this.listAttachments().select(attachmentId);
        },

        /**
         * Creates an attachment.
         *
         * When using this method from within the JS driver, it really only works for text-based content such
         * as JSON or text.
         *
         * @chained attachment
         *
         * @param attachmentId (use null or false for default attachment)
         * @param contentType
         * @param data
         */
        attach: Gitana.Methods.attach(),

        /**
         * Deletes an attachment.
         *
         * @param attachmentId
         */
        unattach: Gitana.Methods.unattach(),

        /**
         * Generates a URI to a preview resource.
         */
        getPreviewUri: Gitana.Methods.getPreviewUri()

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.SettingsMap = Gitana.AbstractPlatformObjectMap.extend(
    /** @lends Gitana.SettingsMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObjectMap
         *
         * @class SettingsMap
         *
         * @param {Gitana.Application} application Gitana application instance.
         * @param [Object] object
         */
        constructor: function(application, object)
        {
            this.objectType = function() { return "Gitana.SettingsMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            /**
             * Gets the Gitana Application object.
             *
             * @inner
             *
             * @returns {Gitana.Application} The Gitana Application object
             */
            this.getApplication = function() { return application; };

            /**
             * Gets the Gitana Application id.
             *
             * @inner
             *
             * @returns {String} The Gitana Application id
             */
            this.getApplicationId = function() { return application.getId(); };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(application.getPlatform(), object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().settingsMap(this.getApplication(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().settings(this.getApplication(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.Email = Gitana.AbstractPlatformObject.extend(
    /** @lends Gitana.Email.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObject
         *
         * @class Email
         *
         * @param {Gitana.Application} application
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(application, object)
        {
            this.base(application.getPlatform(), object);

            this.objectType = function() { return "Gitana.Email"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            /**
             * Gets the Gitana Application object.
             *
             * @inner
             *
             * @returns {Gitana.Application} The Gitana Application object
             */
            this.getApplication = function() { return application; };

            /**
             * Gets the Gitana Application id.
             *
             * @inner
             *
             * @returns {String} The Gitana Application id
             */
            this.getApplicationId = function() { return application.getId(); };
        },

        /**
         * @override
         */
        clone: function()
        {
            return new Gitana.Email(this.getApplication(), this);
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_EMAIL;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/applications/" + this.getApplicationId() + "/emails/" + this.getId();
        },

        /**
         * Sends this email using the given email provider.
         *
         * @param emailProvider
         *
         * @chained this
         *
         * @return this
         */
        send: function(emailProvider)
        {
            return this.then(function() {
                this.subchain(emailProvider).send(this);
            });
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.EmailMap = Gitana.AbstractPlatformObjectMap.extend(
    /** @lends Gitana.EmailMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObjectMap
         *
         * @class EmailMap
         *
         * @param {Gitana.Application} application Gitana application instance.
         * @param [Object] object
         */
        constructor: function(application, object)
        {
            this.objectType = function() { return "Gitana.EmailMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            /**
             * Gets the Gitana Application object.
             *
             * @inner
             *
             * @returns {Gitana.Application} The Gitana Application object
             */
            this.getApplication = function() { return application; };

            /**
             * Gets the Gitana Application id.
             *
             * @inner
             *
             * @returns {String} The Gitana Application id
             */
            this.getApplicationId = function() { return application.getId(); };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(application.getPlatform(), object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().emailMap(this.getApplication(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().email(this.getApplication(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.EmailProvider = Gitana.AbstractPlatformObject.extend(
    /** @lends Gitana.EmailProvider.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObject
         *
         * @class EmailProvider
         *
         * @param {Gitana.Application} application
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(application, object)
        {
            this.base(application.getPlatform(), object);

            this.objectType = function() { return "Gitana.EmailProvider"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            /**
             * Gets the Gitana Application object.
             *
             * @inner
             *
             * @returns {Gitana.Application} The Gitana Application object
             */
            this.getApplication = function() { return application; };

            /**
             * Gets the Gitana Application id.
             *
             * @inner
             *
             * @returns {String} The Gitana Application id
             */
            this.getApplicationId = function() { return application.getId(); };
        },

        /**
         * @override
         */
        clone: function()
        {
            return new Gitana.EmailProvider(this.getApplication(), this);
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_EMAIL_PROVIDER;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/applications/" + this.getApplicationId() + "/emailproviders/" + this.getId();
        },

        /**
         * Sends the given email using this email provider.
         *
         * @param email
         * @return {*}
         */
        send: function(email)
        {
            var self = this;

            var emailId = null;
            if (Gitana.isString(email))
            {
                emailId = email;
            }
            else
            {
                emailId = email.getId();
            }

            var uriFunction = function()
            {
                return self.getUri() + "/send?email=" + emailId;
            };

            return this.chainPostEmpty(null, uriFunction);
        },

        /**
         * Tests whether the email provider works.
         *
         * @param from
         * @param to
         * @returns {*}
         */
        test: function(from, to)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/test?from=" + from + "&to=" + to;
            };

            return this.chainPostEmpty(null, uriFunction);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.EmailProviderMap = Gitana.AbstractPlatformObjectMap.extend(
    /** @lends Gitana.EmailProviderMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObjectMap
         *
         * @class EmailProviderMap
         *
         * @param {Gitana.Application} application Gitana application instance.
         * @param [Object] object
         */
        constructor: function(application, object)
        {
            this.objectType = function() { return "Gitana.EmailProviderMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            /**
             * Gets the Gitana Application object.
             *
             * @inner
             *
             * @returns {Gitana.Application} The Gitana Application object
             */
            this.getApplication = function() { return application; };

            /**
             * Gets the Gitana Application id.
             *
             * @inner
             *
             * @returns {String} The Gitana Application id
             */
            this.getApplicationId = function() { return application.getId(); };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(application.getPlatform(), object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().emailProviderMap(this.getApplication(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().emailProvider(this.getApplication(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.Registration = Gitana.AbstractPlatformObject.extend(
    /** @lends Gitana.Registration.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObject
         *
         * @class Registration
         *
         * @param {Gitana.Application} application
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(application, object)
        {
            this.base(application.getPlatform(), object);

            this.objectType = function() { return "Gitana.Registration"; };

            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            /**
             * Gets the Gitana Application object.
             *
             * @inner
             *
             * @returns {Gitana.Application} The Gitana Application object
             */
            this.getApplication = function() { return application; };

            /**
             * Gets the Gitana Application id.
             *
             * @inner
             *
             * @returns {String} The Gitana Application id
             */
            this.getApplicationId = function() { return application.getId(); };
        },

        /**
         * @override
         */
        clone: function()
        {
            return new Gitana.Registration(this.getApplication(), this);
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_REGISTRATION;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/applications/" + this.getApplicationId() + "/registrations/" + this.getId();
        },

        sendConfirmationEmail: function()
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/send/confirmation";
            };

            return this.chainPostEmpty(this, uriFunction, {}, this);
        },

        sendWelcomeEmail: function()
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/send/welcome";
            };

            return this.chainPostEmpty(this, uriFunction, {}, this);
        },

        confirm: function(newUserPassword, paymentMethodObject)
        {
            if (!paymentMethodObject)
            {
                paymentMethodObject = {};
            }

            var params = {
                "password": newUserPassword
            };

            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/confirm";
            };

            return this.chainPostEmpty(this, uriFunction, params, paymentMethodObject);
        }
    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.RegistrationMap = Gitana.AbstractPlatformObjectMap.extend(
    /** @lends Gitana.RegistrationMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObjectMap
         *
         * @class RegistrationMap
         *
         * @param {Gitana.Application} application Gitana application instance.
         * @param [Object] object
         */
        constructor: function(application, object)
        {
            this.objectType = function() { return "Gitana.RegistrationMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            /**
             * Gets the Gitana Application object.
             *
             * @inner
             *
             * @returns {Gitana.Application} The Gitana Application object
             */
            this.getApplication = function() { return application; };

            /**
             * Gets the Gitana Application id.
             *
             * @inner
             *
             * @returns {String} The Gitana Application id
             */
            this.getApplicationId = function() { return application.getId(); };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(application.getPlatform(), object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().registrationMap(this.getApplication(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().registration(this.getApplication(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.Warehouse = Gitana.AbstractPlatformDataStore.extend(
    /** @lends Gitana.Warehouse.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObject
         *
         * @class Warehouse
         *
         * @param {Gitana.Platform} platform
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(platform, object)
        {
            this.objectType = function() { return "Gitana.Warehouse"; };

            this.base(platform, object);
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/warehouses/" + this.getId();
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_WAREHOUSE;
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().warehouse(this.getPlatform(), this);
        },



        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // INTERACTIONS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists the interactions.
         *
         * @param pagination
         *
         * @chained interaction map
         */
        listInteractions: function(pagination)
        {
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var chainable = this.getFactory().interactionMap(this);
            return this.chainGet(chainable, this.getUri() + "/interactions", params);
        },

        /**
         * Reads an interaction.
         *
         * @param interactionId
         *
         * @chained interaction
         */
        readInteraction: function(interactionId)
        {
            var chainable = this.getFactory().interaction(this);
            return this.chainGet(chainable, this.getUri() + "/interactions/" + interactionId);
        },

        /**
         * Queries for interactions.
         *
         * @chained interaction map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryInteractions: function(query, pagination)
        {
            var self = this;

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return self.getUri() + "/interactions/query";
            };

            var chainable = this.getFactory().interactionMap(this);
            return this.chainPost(chainable, uriFunction, params, query);
        },



        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // INTERACTION APPLICATIONS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists the interaction applications.
         *
         * @param pagination
         *
         * @chained interaction application map
         */
        listInteractionApplications: function(pagination)
        {
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var chainable = this.getFactory().interactionApplicationMap(this);
            return this.chainGet(chainable, this.getUri() + "/applications", params);
        },

        /**
         * Reads an interaction application.
         *
         * @param interactionApplicationId
         *
         * @chained interaction application
         */
        readInteractionApplication: function(interactionApplicationId)
        {
            var chainable = this.getFactory().interactionApplication(this);
            return this.chainGet(chainable, this.getUri() + "/applications/" + interactionApplicationId);
        },

        /**
         * Queries for interaction applications.
         *
         * @chained interaction application map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryInteractionApplications: function(query, pagination)
        {
            var self = this;

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return self.getUri() + "/applications/query";
            };

            var chainable = this.getFactory().interactionApplicationMap(this);
            return this.chainPost(chainable, uriFunction, params, query);
        },



        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // INTERACTION SESSIONS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists the interaction sessions.
         *
         * @param pagination
         *
         * @chained interaction session map
         */
        listInteractionSessions: function(pagination)
        {
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var chainable = this.getFactory().interactionSessionMap(this);
            return this.chainGet(chainable, this.getUri() + "/sessions", params);
        },

        /**
         * Reads an interaction session.
         *
         * @param interactionSessionId
         *
         * @chained interaction session
         */
        readInteractionSession: function(interactionSessionId)
        {
            var chainable = this.getFactory().interactionSession(this);
            return this.chainGet(chainable, this.getUri() + "/sessions/" + interactionSessionId);
        },

        /**
         * Queries for interaction sessions.
         *
         * @chained interaction session map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryInteractionSessions: function(query, pagination)
        {
            var self = this;

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return self.getUri() + "/sessions/query";
            };

            var chainable = this.getFactory().interactionSessionMap(this);
            return this.chainPost(chainable, uriFunction, params, query);
        },

        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // INTERACTION PAGES
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists the interaction pages.
         *
         * @param pagination
         *
         * @chained interaction page map
         */
        listInteractionPages: function(pagination)
        {
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var chainable = this.getFactory().interactionPageMap(this);
            return this.chainGet(chainable, this.getUri() + "/pages", params);
        },

        /**
         * Reads an interaction page.
         *
         * @param interactionPageId
         *
         * @chained interaction page
         */
        readInteractionPage: function(interactionPageId)
        {
            var chainable = this.getFactory().interactionPage(this);
            return this.chainGet(chainable, this.getUri() + "/pages/" + interactionPageId);
        },

        /**
         * Queries for interaction pages.
         *
         * @chained interaction page map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryInteractionPages: function(query, pagination)
        {
            var self = this;

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return self.getUri() + "/pages/query";
            };

            var chainable = this.getFactory().interactionPageMap(this);
            return this.chainPost(chainable, uriFunction, params, query);
        },

        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // INTERACTION NODES
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists the interaction nodes.
         *
         * @param pagination
         *
         * @chained interaction node map
         */
        listInteractionNodes: function(pagination)
        {
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var chainable = this.getFactory().interactionNodeMap(this);
            return this.chainGet(chainable, this.getUri() + "/nodes", params);
        },

        /**
         * Reads an interaction node.
         *
         * @param interactionNodeId
         *
         * @chained interaction node
         */
        readInteractionNode: function(interactionNodeId)
        {
            var chainable = this.getFactory().interactionNode(this);
            return this.chainGet(chainable, this.getUri() + "/nodes/" + interactionNodeId);
        },

        /**
         * Queries for interaction nodes.
         *
         * @chained interaction node map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryInteractionNodes: function(query, pagination)
        {
            var self = this;

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return self.getUri() + "/nodes/query";
            };

            var chainable = this.getFactory().interactionNodeMap(this);
            return this.chainPost(chainable, uriFunction, params, query);
        },

        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // INTERACTION USERS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists the interaction users.
         *
         * @param pagination
         *
         * @chained interaction user map
         */
        listInteractionUsers: function(pagination)
        {
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var chainable = this.getFactory().interactionUserMap(this);
            return this.chainGet(chainable, this.getUri() + "/users", params);
        },

        /**
         * Reads an interaction user.
         *
         * @param interactionUserId
         *
         * @chained interaction user
         */
        readInteractionUser: function(interactionUserId)
        {
            var chainable = this.getFactory().interactionUser(this);
            return this.chainGet(chainable, this.getUri() + "/users/" + interactionUserId);
        },

        /**
         * Queries for interaction users.
         *
         * @chained interaction user map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryInteractionUsers: function(query, pagination)
        {
            var self = this;

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return self.getUri() + "/users/query";
            };

            var chainable = this.getFactory().interactionUserMap(this);
            return this.chainPost(chainable, uriFunction, params, query);
        },


        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // INTERACTION CONTINENTS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists the interaction continents.
         *
         * @param pagination
         *
         * @chained interaction continent map
         */
        listInteractionContinents: Gitana.Methods.listInteractionObjects("interactionContinentMap", "continents"),

        /**
         * Reads an interaction continent.
         *
         * @param interactionContinentId
         *
         * @chained interaction continent
         */
        readInteractionContinent: Gitana.Methods.readInteractionObject("interactionContinent", "continents"),

        /**
         * Queries for interaction continents.
         *
         * @chained interaction continent map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryInteractionContinents: Gitana.Methods.queryInteractionObjects("interactionContinentMap", "continents"),



        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // INTERACTION COUNTRIES
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists the interaction countries.
         *
         * @param pagination
         *
         * @chained interaction country map
         */
        listInteractionCountries: Gitana.Methods.listInteractionObjects("interactionCountryMap", "countries"),

        /**
         * Reads an interaction country.
         *
         * @param interactionCountryId
         *
         * @chained interaction country
         */
        readInteractionCountry: Gitana.Methods.readInteractionObject("interactionCountry", "countries"),

        /**
         * Queries for interaction countries.
         *
         * @chained interaction country map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryInteractionCountries: Gitana.Methods.queryInteractionObjects("interactionCountryMap", "countries"),


        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // INTERACTION CITIES
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists the interaction cities.
         *
         * @param pagination
         *
         * @chained interaction city map
         */
        listInteractionCities: Gitana.Methods.listInteractionObjects("interactionCityMap", "cities"),

        /**
         * Reads an interaction city.
         *
         * @param interactionCityId
         *
         * @chained interaction city
         */
        readInteractionCity: Gitana.Methods.readInteractionObject("interactionCity", "cities"),

        /**
         * Queries for interaction cities.
         *
         * @chained interaction city map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryInteractionCities: Gitana.Methods.queryInteractionObjects("interactionCityMap", "cities"),


        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // INTERACTION REGIONS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists the interaction regions.
         *
         * @param pagination
         *
         * @chained interaction region map
         */
        listInteractionRegions: Gitana.Methods.listInteractionObjects("interactionRegionMap", "regions"),

        /**
         * Reads an interaction region.
         *
         * @param interactionRegionId
         *
         * @chained interaction region
         */
        readInteractionRegion: Gitana.Methods.readInteractionObject("interactionRegion", "regions"),

        /**
         * Queries for interaction regions.
         *
         * @chained interaction region map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryInteractionRegions: Gitana.Methods.queryInteractionObjects("interactionRegionMap", "regions"),


        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // INTERACTION POSTAL CODES
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists the interaction postal codes.
         *
         * @param pagination
         *
         * @chained interaction postal code map
         */
        listInteractionPostalCodes: Gitana.Methods.listInteractionObjects("interactionPostalCodeMap", "postalcodes"),

        /**
         * Reads an interaction postal code.
         *
         * @param interactionPostalCodeId
         *
         * @chained interaction postal code
         */
        readInteractionPostalCode: Gitana.Methods.readInteractionObject("interactionPostalCode", "postalcodes"),

        /**
         * Queries for interaction postal codes.
         *
         * @chained interaction postal code map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryInteractionPostalCodes: Gitana.Methods.queryInteractionObjects("interactionPostalCodeMap", "postalcodes"),


        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // INTERACTION USER AGENTS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists the interaction user agents.
         *
         * @param pagination
         *
         * @chained interaction user agent map
         */
        listInteractionUserAgents: Gitana.Methods.listInteractionObjects("interactionUserAgentMap", "useragents"),

        /**
         * Reads an interaction user agent.
         *
         * @param interactionUserAgentId
         *
         * @chained interaction user agent
         */
        readInteractionUserAgent: Gitana.Methods.readInteractionObject("interactionUserAgent", "useragents"),

        /**
         * Queries for interaction user agents
         *
         * @chained interaction user agent map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryInteractionUserAgents: Gitana.Methods.queryInteractionObjects("interactionUserAgentMap", "useragents"),


        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // INTERACTION OPERATING SYSTEMS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists the interaction operating systems.
         *
         * @param pagination
         *
         * @chained interaction operating system map
         */
        listInteractionOperatingSystems: Gitana.Methods.listInteractionObjects("interactionOperatingSystemMap", "operatingsystems"),

        /**
         * Reads an interaction operating system.
         *
         * @param interactionOperatingSystemId
         *
         * @chained interaction operating system
         */
        readInteractionOperatingSystems: Gitana.Methods.readInteractionObject("interactionOperatingSystem", "operatingsystems"),

        /**
         * Queries for interaction operating systems.
         *
         * @chained interaction operating system map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryInteractionOperatingSystems: Gitana.Methods.queryInteractionObjects("interactionOperatingSystemMap", "operatingsystems"),


        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // INTERACTION DEVICES
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists the interaction devices.
         *
         * @param pagination
         *
         * @chained interaction device map
         */
        listInteractionDevices: Gitana.Methods.listInteractionObjects("interactionDeviceMap", "devices"),

        /**
         * Reads an interaction device.
         *
         * @param interactionDeviceId
         *
         * @chained interaction device
         */
        readInteractionDevice: Gitana.Methods.readInteractionObject("interactionDevice", "devices"),

        /**
         * Queries for interaction devices.
         *
         * @chained interaction device map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryInteractionDevices: Gitana.Methods.queryInteractionObjects("interactionDeviceMap", "devices"),



        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // INTERACTION REPORTS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists the interaction reports.
         *
         * @param pagination (optional)
         *
         * @chained interaction report map
         */
        listInteractionReports: function(pagination)
        {
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var chainable = this.getFactory().interactionReportMap(this);
            return this.chainGet(chainable, this.getUri() + "/reports", params);
        },

        /**
         * Reads an interaction report.
         *
         * @param interactionReportId
         *
         * @chained interaction report
         */
        readInteractionReport: function(interactionReportId)
        {
            var chainable = this.getFactory().interactionReport(this);
            return this.chainGet(chainable, this.getUri() + "/reports/" + interactionReportId);
        },

        /**
         * Queries for interaction reports.
         *
         * @param query
         * @param pagination (optional)
         *
         * @chained interaction report map
         */
        queryInteractionReports: function(query, pagination)
        {
            var self = this;

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return self.getUri() + "/reports/query";
            };

            var chainable = this.getFactory().interactionReportMap(this);
            return this.chainPost(chainable, uriFunction, params, query);
        },

        /**
         * Loads information about the warehouse.
         *
         * @param callback
         */
        loadInfo: function(callback)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/info";
            };

            return this.chainGetResponse(this, uriFunction, {}).then(function(response) {
                callback(response);
            });
        },

        /**
         * Resets the warehouse.  This requires ADMIN, MANAGER or OWNER authorities against the warehouse.
         *
         * @returns {*}
         */
        reset: function()
        {
            var self = this;

            return this.then(function() {

                var chain = this;

                // call
                var uri = self.getUri() + "/reset";
                self.getDriver().gitanaPost(uri, null, {}, function(response) {
                    chain.next();
                });

                // NOTE: we return false to tell the chain that we'll manually call next()
                return false;
            });
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.WarehouseMap = Gitana.AbstractPlatformObjectMap.extend(
    /** @lends Gitana.WarehouseMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObjectMap
         *
         * @class Map of warehouse objects
         *
         * @param {Gitana.Platform} platform Gitana platform
         * @param {Object} object
         */
        constructor: function(platform, object)
        {
            this.objectType = function() { return "Gitana.WarehouseMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(platform, object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().warehouseMap(this.getPlatform(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().warehouse(this.getPlatform(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.AbstractWarehouseObject = Gitana.AbstractPlatformObject.extend(
    /** @lends Gitana.AbstractWarehouseObject.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObject
         *
         * @class Abstract base class for Warehouse objects
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object
         */
        constructor: function(warehouse, object)
        {
            this.base(warehouse.getPlatform(), object);


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            /**
             * Gets the Gitana Warehouse object.
             *
             * @inner
             *
             * @returns {Gitana.Warehouse} The Gitana Warehouse object
             */
            this.getWarehouse = function() { return warehouse; };

            /**
             * Gets the Gitana Warehouse id.
             *
             * @inner
             *
             * @returns {String} The Gitana Warehouse id
             */
            this.getWarehouseId = function() { return warehouse.getId(); };
        }
    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.AbstractWarehouseObjectMap = Gitana.AbstractPlatformObjectMap.extend(
    /** @lends Gitana.AbstractWarehouseObjectMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractMap
         *
         * @class AbstractWarehouseObjectMap
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object
         */
        constructor: function(warehouse, object)
        {
            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.getWarehouse = function()
            {
                return warehouse;
            };

            this.getWarehouseId = function()
            {
                return warehouse.getId();
            };

            // NOTE: call this last
            this.base(warehouse.getPlatform(), object);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.AbstractReportableWarehouseObject = Gitana.AbstractWarehouseObject.extend(
    /** @lends Gitana.AbstractReportableWarehouseObject.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractWarehouseObject
         *
         * @class Abstract base class for Reportable Warehouse objects
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object
         */
        constructor: function(warehouse, object)
        {
            this.base(warehouse, object);

            // TO BE OVERRIDDEN BY SUBCLASSES
            this.interactionObjectTypeId = null;
        },

        /**
         * Lists the interaction reports.
         *
         * @param pagination (optional)
         *
         * @chained interaction report map
         */
        listReports: function(pagination)
        {
            return this.queryReports({}, pagination);
        },

        /**
         * Reads an interaction report.
         *
         * @param interactionReportKeyOrId
         *
         * @chained interaction report
         */
        readReport: function(interactionReportKey)
        {
            return this.queryReports({"key": interactionReportKey}).keepOne();
        },

        /**
         * Queries for interaction reports.
         *
         * @parma query
         * @param pagination (optional)
         *
         * @chained interaction report map
         */
        queryReports: function(query, pagination)
        {
            if (!query)
            {
                query = {};
            }
            query["objectTypeId"] = this.interactionObjectTypeId;
            query["objectId"] = this.getId();

            return this.subchain(this.getWarehouse()).queryInteractionReports(query, pagination);
        }
    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.Interaction = Gitana.AbstractWarehouseObject.extend(
    /** @lends Gitana.Interaction.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObject
         *
         * @class Interaction
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(warehouse, object)
        {
            this.base(warehouse, object);

            this.objectType = function() { return "Gitana.Interaction"; };
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_INTERACTION;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/warehouses/" + this.getWarehouseId() + "/interactions/" + this.getId();
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().interaction(this.getWarehouse(), this);
        },





        //////////////////////////////////////////////////////////////////////////////////////////////
        //
        // METHODS
        //
        //////////////////////////////////////////////////////////////////////////////////////////////

        getInteractionApplicationId: function()
        {
            return this.get("interactionApplicationId");
        },

        getInteractionSessionId: function()
        {
            return this.get("interactionSessionId");
        },

        getInteractionPageId: function()
        {
            return this.get("interactionPageId");
        },

        getInteractionUserId: function()
        {
            return this.get("interactionUserId");
        },

        getInteractionNodeId: function()
        {
            return this.get("interactionNodeId");
        },

        getSourceUserAgent: function()
        {
            return this["source"]["user-agent"];
        },

        getSourceHost: function()
        {
            return this["source"]["host"];
        },

        getSourceIP: function()
        {
            return this["source"]["ip"];
        },

        getEventType: function()
        {
            return this["event"]["type"];
        },

        getEventX: function()
        {
            return this["event"]["x"];
        },

        getEventY: function()
        {
            return this["event"]["y"];
        },

        getEventOffsetX: function()
        {
            return this["event"]["offsetX"];
        },

        getEventOffsetY: function()
        {
            return this["event"]["offsetY"];
        },

        getApplicationHost: function()
        {
            return this["application"]["host"];
        },

        getApplicationUrl: function()
        {
            return this["application"]["url"];
        },

        getApplicationUri: function()
        {
            return this["application"]["uri"];
        },

        getElementId: function()
        {
            return this["element"]["id"];
        },

        getElementType: function()
        {
            return this["element"]["type"];
        },

        getElementPath: function()
        {
            return this["element"]["path"];
        },

        getNodeRepositoryId: function()
        {
            return this["node"]["repositoryId"];
        },

        getNodeBranchId: function()
        {
            return this["node"]["branchId"];
        },

        getNodeId: function()
        {
            return this["node"]["id"];
        },

        getTimestampStart: function()
        {
            return this["timestamp"]["start"];
        },

        getTimestampEnd: function()
        {
            return this["timestamp"]["end"];
        },

        getTimestampMs: function()
        {
            return this["timestamp"]["ms"];
        },

        getPrincipalDomainId: function()
        {
            return this["principal"]["domainId"];
        },

        getPrincipalId: function()
        {
            return this["principal"]["id"];
        }
    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.InteractionMap = Gitana.AbstractWarehouseObjectMap.extend(
    /** @lends Gitana.InteractionMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractWarehouseObjectMap
         *
         * @class InteractionMap
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object
         */
        constructor: function(warehouse, object)
        {
            this.objectType = function() { return "Gitana.InteractionMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(warehouse, object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().interactionMap(this.getWarehouse(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().interaction(this.getWarehouse(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.InteractionApplication = Gitana.AbstractReportableWarehouseObject.extend(
    /** @lends Gitana.InteractionApplication.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractReportableWarehouseObject
         *
         * @class InteractionApplication
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(warehouse, object)
        {
            this.base(warehouse, object);

            this.objectType = function() { return "Gitana.InteractionApplication"; };
            this.interactionObjectTypeId = "application";
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_INTERACTION_APPLICATION;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/warehouses/" + this.getWarehouseId() + "/applications/" + this.getId();
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().interactionApplication(this.getWarehouse(), this);
        },

        getTimestampStart: function()
        {
            return this.get("timestamp")["start"];
        },

        getTimestampEnd: function()
        {
            return this.get("timestamp")["end"];
        },



        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // INTERACTIONS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists the interactions.
         *
         * @param pagination
         *
         * @chained interaction map
         */
        listInteractions: function(pagination)
        {
            return this.queryInteractions(null, pagination);
        },

        /**
         * Queries for interactions.
         *
         * @chained interaction map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryInteractions: function(query, pagination)
        {
            if (!query)
            {
                query = {};
            }
            query["interactionApplicationId"] = this.getId();

            return this.subchain(this.getWarehouse()).queryInteractions(query, pagination);
        },

        /**
         * Lists the sessions.
         *
         * @param pagination
         *
         * @chained interaction map
         */
        listSessions: function(pagination)
        {
            return this.querySessions(null, pagination);
        },

        /**
         * Queries for sessions.
         *
         * @chained interaction map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        querySessions: function(query, pagination)
        {
            if (!query)
            {
                query = {};
            }
            query["interactionApplicationId"] = this.getId();

            return this.subchain(this.getWarehouse()).queryInteractionSessions(query, pagination);
        },

        /**
         * Lists the pages.
         *
         * @param pagination
         *
         * @chained interaction map
         */
        listPages: function(pagination)
        {
            return this.queryPages(null, pagination);
        },

        /**
         * Queries for pages.
         *
         * @chained interaction map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryPages: function(query, pagination)
        {
            if (!query)
            {
                query = {};
            }
            query["interactionApplicationId"] = this.getId();

            return this.subchain(this.getWarehouse()).queryInteractionPages(query, pagination);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.InteractionApplicationMap = Gitana.AbstractWarehouseObjectMap.extend(
    /** @lends Gitana.InteractionApplicationMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractWarehouseObjectMap
         *
         * @class InteractionApplicationMap
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object
         */
        constructor: function(warehouse, object)
        {
            this.objectType = function() { return "Gitana.InteractionApplicationMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(warehouse, object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().interactionApplicationMap(this.getWarehouse(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().interactionApplication(this.getWarehouse(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.InteractionSession = Gitana.AbstractReportableWarehouseObject.extend(
    /** @lends Gitana.InteractionSession.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractReportableWarehouseObject
         *
         * @class InteractionSession
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(warehouse, object)
        {
            this.base(warehouse, object);

            this.objectType = function() { return "Gitana.InteractionSession"; };
            this.interactionObjectTypeId = "session";
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_INTERACTION_SESSION;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/warehouses/" + this.getWarehouseId() + "/sessions/" + this.getId();
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().interactionSession(this.getWarehouse(), this);
        },

        getInteractionApplicationId: function()
        {
            return this.get("interactionApplicationId");
        },

        getTimestampStart: function()
        {
            return this.get("timestamp")["start"];
        },

        getTimestampEnd: function()
        {
            return this.get("timestamp")["end"];
        },



        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // INTERACTIONS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists the interactions.
         *
         * @param pagination
         *
         * @chained interaction map
         */
        listInteractions: function(pagination)
        {
            return this.queryInteractions(null, pagination);
        },

        /**
         * Queries for interactions.
         *
         * @chained interaction map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryInteractions: function(query, pagination)
        {
            if (!query)
            {
                query = {};
            }
            query["interactionSessionId"] = this.getId();

            return this.subchain(this.getWarehouse()).queryInteractions(query, pagination);
        }


    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.InteractionSessionMap = Gitana.AbstractWarehouseObjectMap.extend(
    /** @lends Gitana.InteractionSessionMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractWarehouseObjectMap
         *
         * @class InteractionSessionMap
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object
         */
        constructor: function(warehouse, object)
        {
            this.objectType = function() { return "Gitana.InteractionSessionMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(warehouse, object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().interactionSessionMap(this.getWarehouse(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().interactionSession(this.getWarehouse(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.InteractionPage = Gitana.AbstractReportableWarehouseObject.extend(
    /** @lends Gitana.InteractionPage.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractReportableWarehouseObject
         *
         * @class InteractionPage
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(warehouse, object)
        {
            this.base(warehouse, object);

            this.objectType = function() { return "Gitana.InteractionPage"; };
            this.interactionObjectTypeId = "page";
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_INTERACTION_PAGE;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/warehouses/" + this.getWarehouseId() + "/pages/" + this.getId();
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().interactionPage(this.getWarehouse(), this);
        },

        getInteractionApplicationId: function()
        {
            return this.get("interactionApplicationId");
        },

        getPageUri: function()
        {
            return this.get("uri");
        },

        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // ATTACHMENTS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Hands back an attachments map.
         *
         * @chained attachment map
         *
         * @param local
         *
         * @public
         */
        listAttachments: Gitana.Methods.listAttachments(),

        /**
         * Picks off a single attachment
         *
         * @chained attachment
         *
         * @param attachmentId
         */
        attachment: function(attachmentId)
        {
            return this.listAttachments().select(attachmentId);
        },

        /**
         * Creates an attachment.
         *
         * When using this method from within the JS driver, it really only works for text-based content such
         * as JSON or text.
         *
         * @chained attachment
         *
         * @param attachmentId (use null or false for default attachment)
         * @param contentType
         * @param data
         */
        attach: Gitana.Methods.attach(),

        /**
         * Deletes an attachment.
         *
         * @param attachmentId
         */
        unattach: Gitana.Methods.unattach(),

        /**
         * Generates a URI to a preview resource.
         */
        getPreviewUri: Gitana.Methods.getPreviewUri(),


        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // INTERACTIONS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists the interactions.
         *
         * @param pagination
         *
         * @chained interaction map
         */
        listInteractions: function(pagination)
        {
            return this.queryInteractions(null, pagination);
        },

        /**
         * Queries for interactions.
         *
         * @chained interaction map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryInteractions: function(query, pagination)
        {
            if (!query)
            {
                query = {};
            }
            query["interactionPageId"] = this.getId();

            return this.subchain(this.getWarehouse()).queryInteractions(query, pagination);
        },


        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // CAPTURE
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Captures information about the targeted page including snapshot and DOM info.
         * If existing capture information is in place, it is overwritten.
         *
         * Note that this call is asynchronous - a job is started on the server to perform the capture.
         * The results will not be available until the job completes.
         *
         * @chained this
         *
         * @public
         */
        capture: function()
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/capture";
            };

            return this.chainPostEmpty(null, uriFunction);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.InteractionPageMap = Gitana.AbstractWarehouseObjectMap.extend(
    /** @lends Gitana.InteractionPageMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractWarehouseObjectMap
         *
         * @class InteractionPageMap
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object
         */
        constructor: function(warehouse, object)
        {
            this.objectType = function() { return "Gitana.InteractionPageMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(warehouse, object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().interactionPageMap(this.getWarehouse(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().interactionPage(this.getWarehouse(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.InteractionNode = Gitana.AbstractReportableWarehouseObject.extend(
    /** @lends Gitana.InteractionNode.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractReportableWarehouseObject
         *
         * @class InteractionNode
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(warehouse, object)
        {
            this.base(warehouse, object);

            this.objectType = function() { return "Gitana.InteractionNode"; };
            this.interactionObjectTypeId = "node";
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_INTERACTION_NODE;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/warehouses/" + this.getWarehouseId() + "/nodes/" + this.getId();
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().interactionNode(this.getWarehouse(), this);
        },

        getRepositoryId: function()
        {
            return this.get("repositoryId");
        },

        getBranchId: function()
        {
            return this.get("branchId");
        },

        getNodeId: function()
        {
            return this.get("nodeId");
        },


        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // ATTACHMENTS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Hands back an attachments map.
         *
         * @chained attachment map
         *
         * @param local
         *
         * @public
         */
        listAttachments: Gitana.Methods.listAttachments(),

        /**
         * Picks off a single attachment
         *
         * @chained attachment
         *
         * @param attachmentId
         */
        attachment: function(attachmentId)
        {
            return this.listAttachments().select(attachmentId);
        },

        /**
         * Creates an attachment.
         *
         * When using this method from within the JS driver, it really only works for text-based content such
         * as JSON or text.
         *
         * @chained attachment
         *
         * @param attachmentId (use null or false for default attachment)
         * @param contentType
         * @param data
         */
        attach: Gitana.Methods.attach(),

        /**
         * Deletes an attachment.
         *
         * @param attachmentId
         */
        unattach: Gitana.Methods.unattach(),

        /**
         * Generates a URI to a preview resource.
         */
        getPreviewUri: Gitana.Methods.getPreviewUri(),


        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // INTERACTIONS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists the interactions.
         *
         * @param pagination
         *
         * @chained interaction map
         */
        listInteractions: function(pagination)
        {
            return this.queryInteractions(null, pagination);
        },

        /**
         * Queries for interactions.
         *
         * @chained interaction map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryInteractions: function(query, pagination)
        {
            if (!query)
            {
                query = {};
            }
            query["interactionNodeId"] = this.getId();

            return this.subchain(this.getWarehouse()).queryInteractions(query, pagination);
        },


        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // CAPTURE
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Captures information about the targeted node including snapshot info.
         * If existing capture information is in place, it is overwritten.
         *
         * Note that this call is asynchronous - a job is started on the server to perform the capture.
         * The results will not be available until the job completes.
         *
         * @chained this
         *
         * @public
         */
        capture: function()
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/capture";
            };

            return this.chainPostEmpty(null, uriFunction);
        }


    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.InteractionNodeMap = Gitana.AbstractWarehouseObjectMap.extend(
    /** @lends Gitana.InteractionNodeMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractWarehouseObjectMap
         *
         * @class InteractionNodeMap
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object
         */
        constructor: function(warehouse, object)
        {
            this.objectType = function() { return "Gitana.InteractionNodeMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(warehouse, object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().interactionNodeMap(this.getWarehouse(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().interactionNode(this.getWarehouse(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.InteractionUser = Gitana.AbstractReportableWarehouseObject.extend(
    /** @lends Gitana.InteractionUser.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractReportableWarehouseObject
         *
         * @class InteractionUser
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(warehouse, object)
        {
            this.base(warehouse, object);

            this.objectType = function() { return "Gitana.InteractionUser"; };
            this.interactionObjectTypeId = "user";
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_INTERACTION_SESSION;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/warehouses/" + this.getWarehouseId() + "/users/" + this.getId();
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().interactionUser(this.getWarehouse(), this);
        },


        getKey: function()
        {
            return this.get("key");
        },



        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // INTERACTIONS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists the interactions.
         *
         * @param pagination
         *
         * @chained interaction map
         */
        listInteractions: function(pagination)
        {
            return this.queryInteractions(null, pagination);
        },

        /**
         * Queries for interactions.
         *
         * @chained interaction map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryInteractions: function(query, pagination)
        {
            if (!query)
            {
                query = {};
            }
            query["interactionUserId"] = this.getId();

            return this.subchain(this.getWarehouse()).queryInteractions(query, pagination);
        }


    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.InteractionUserMap = Gitana.AbstractWarehouseObjectMap.extend(
    /** @lends Gitana.InteractionUserMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractWarehouseObjectMap
         *
         * @class InteractionUserMap
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object
         */
        constructor: function(warehouse, object)
        {
            this.objectType = function() { return "Gitana.InteractionUserMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(warehouse, object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().interactionUserMap(this.getWarehouse(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().interactionUser(this.getWarehouse(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.InteractionContinent = Gitana.AbstractReportableWarehouseObject.extend(
    /** @lends Gitana.InteractionContinent.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractReportableWarehouseObject
         *
         * @class InteractionContinent
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(warehouse, object)
        {
            this.base(warehouse, object);

            this.objectType = function() { return "Gitana.InteractionContinent"; };
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_INTERACTION_CONTINENT;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/warehouses/" + this.getWarehouseId() + "/continents/" + this.getId();
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().interactionContinent(this.getWarehouse(), this);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.InteractionContinentMap = Gitana.AbstractWarehouseObjectMap.extend(
    /** @lends Gitana.InteractionContinentMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractWarehouseObjectMap
         *
         * @class InteractionContinentMap
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object
         */
        constructor: function(warehouse, object)
        {
            this.objectType = function() { return "Gitana.InteractionContinentMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(warehouse, object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().interactionContinentMap(this.getWarehouse(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().interactionContinent(this.getWarehouse(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.InteractionCountry = Gitana.AbstractReportableWarehouseObject.extend(
    /** @lends Gitana.InteractionCountry.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractReportableWarehouseObject
         *
         * @class InteractionCountry
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(warehouse, object)
        {
            this.base(warehouse, object);

            this.objectType = function() { return "Gitana.InteractionCountry"; };
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_INTERACTION_COUNTRY;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/warehouses/" + this.getWarehouseId() + "/countries/" + this.getId();
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().interactionCountry(this.getWarehouse(), this);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.InteractionCountryMap = Gitana.AbstractWarehouseObjectMap.extend(
    /** @lends Gitana.InteractionCountryMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractWarehouseObjectMap
         *
         * @class InteractionCountryMap
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object
         */
        constructor: function(warehouse, object)
        {
            this.objectType = function() { return "Gitana.InteractionCountryMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(warehouse, object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().interactionCountryMap(this.getWarehouse(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().interactionCountry(this.getWarehouse(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.InteractionCity = Gitana.AbstractReportableWarehouseObject.extend(
    /** @lends Gitana.InteractionCity.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractReportableWarehouseObject
         *
         * @class InteractionCity
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(warehouse, object)
        {
            this.base(warehouse, object);

            this.objectType = function() { return "Gitana.InteractionCity"; };
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_INTERACTION_CITY;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/warehouses/" + this.getWarehouseId() + "/cities/" + this.getId();
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().interactionCity(this.getWarehouse(), this);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.InteractionCityMap = Gitana.AbstractWarehouseObjectMap.extend(
    /** @lends Gitana.InteractionCityMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractWarehouseObjectMap
         *
         * @class InteractionCityMap
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object
         */
        constructor: function(warehouse, object)
        {
            this.objectType = function() { return "Gitana.InteractionCityMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(warehouse, object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().interactionCityMap(this.getWarehouse(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().interactionCity(this.getWarehouse(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.InteractionRegion = Gitana.AbstractReportableWarehouseObject.extend(
    /** @lends Gitana.InteractionRegion.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractReportableWarehouseObject
         *
         * @class InteractionRegion
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(warehouse, object)
        {
            this.base(warehouse, object);

            this.objectType = function() { return "Gitana.InteractionRegion"; };
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_INTERACTION_REGION;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/warehouses/" + this.getWarehouseId() + "/regions/" + this.getId();
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().interactionRegion(this.getWarehouse(), this);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.InteractionRegionMap = Gitana.AbstractWarehouseObjectMap.extend(
    /** @lends Gitana.InteractionRegionMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractWarehouseObjectMap
         *
         * @class InteractionRegionMap
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object
         */
        constructor: function(warehouse, object)
        {
            this.objectType = function() { return "Gitana.InteractionRegionMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(warehouse, object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().interactionRegionMap(this.getWarehouse(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().interactionRegion(this.getWarehouse(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.InteractionPostalCode = Gitana.AbstractReportableWarehouseObject.extend(
    /** @lends Gitana.InteractionPostalCode.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractReportableWarehouseObject
         *
         * @class InteractionPostalCode
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(warehouse, object)
        {
            this.base(warehouse, object);

            this.objectType = function() { return "Gitana.InteractionPostalCode"; };
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_INTERACTION_POSTALCODE;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/warehouses/" + this.getWarehouseId() + "/postalcodes/" + this.getId();
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().interactionPostalCode(this.getWarehouse(), this);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.InteractionPostalCodeMap = Gitana.AbstractWarehouseObjectMap.extend(
    /** @lends Gitana.InteractionPostalCodeMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractWarehouseObjectMap
         *
         * @class InteractionPostalCodeMap
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object
         */
        constructor: function(warehouse, object)
        {
            this.objectType = function() { return "Gitana.InteractionPostalCodeMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(warehouse, object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().interactionPostalCodeMap(this.getWarehouse(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().interactionPostalCode(this.getWarehouse(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.InteractionUserAgent = Gitana.AbstractReportableWarehouseObject.extend(
    /** @lends Gitana.InteractionUserAgent.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractReportableWarehouseObject
         *
         * @class InteractionUserAgent
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(warehouse, object)
        {
            this.base(warehouse, object);

            this.objectType = function() { return "Gitana.InteractionUserAgent"; };
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_INTERACTION_USERAGENT;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/warehouses/" + this.getWarehouseId() + "/useragents/" + this.getId();
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().interactionUserAgent(this.getWarehouse(), this);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.InteractionUserAgentMap = Gitana.AbstractWarehouseObjectMap.extend(
    /** @lends Gitana.InteractionUserAgentMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractWarehouseObjectMap
         *
         * @class InteractionUserAgentMap
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object
         */
        constructor: function(warehouse, object)
        {
            this.objectType = function() { return "Gitana.InteractionUserAgentMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(warehouse, object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().interactionUserAgentMap(this.getWarehouse(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().interactionUserAgent(this.getWarehouse(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.InteractionOperatingSystem = Gitana.AbstractReportableWarehouseObject.extend(
    /** @lends Gitana.InteractionOperatingSystem.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractReportableWarehouseObject
         *
         * @class InteractionOperatingSystem
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(warehouse, object)
        {
            this.base(warehouse, object);

            this.objectType = function() { return "Gitana.InteractionOperatingSystem"; };
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_INTERACTION_OPERATINGSYSTEM;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/warehouses/" + this.getWarehouseId() + "/operatingsystems/" + this.getId();
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().interactionOperatingSystem(this.getWarehouse(), this);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.InteractionOperatingSystemMap = Gitana.AbstractWarehouseObjectMap.extend(
    /** @lends Gitana.InteractionOperatingSystemMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractWarehouseObjectMap
         *
         * @class InteractionOperatingSystemMap
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object
         */
        constructor: function(warehouse, object)
        {
            this.objectType = function() { return "Gitana.InteractionOperatingSystemMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(warehouse, object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().interactionOperatingSystemMap(this.getWarehouse(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().interactionOperatingSystem(this.getWarehouse(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.InteractionDevice = Gitana.AbstractReportableWarehouseObject.extend(
    /** @lends Gitana.InteractionDevice.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractReportableWarehouseObject
         *
         * @class InteractionDevice
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(warehouse, object)
        {
            this.base(warehouse, object);

            this.objectType = function() { return "Gitana.InteractionDevice"; };
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_INTERACTION_DEVICE;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/warehouses/" + this.getWarehouseId() + "/devices/" + this.getId();
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().interactionDevice(this.getWarehouse(), this);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.InteractionDeviceMap = Gitana.AbstractWarehouseObjectMap.extend(
    /** @lends Gitana.InteractionDeviceMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractWarehouseObjectMap
         *
         * @class InteractionDeviceMap
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object
         */
        constructor: function(warehouse, object)
        {
            this.objectType = function() { return "Gitana.InteractionDeviceMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(warehouse, object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().interactionDeviceMap(this.getWarehouse(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().interactionDevice(this.getWarehouse(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.InteractionReport = Gitana.AbstractWarehouseObject.extend(
    /** @lends Gitana.InteractionReport.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractWarehouseObject
         *
         * @class InteractionReport
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(warehouse, object)
        {
            this.base(warehouse, object);

            this.objectType = function() { return "Gitana.InteractionReport"; };
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_INTERACTION_REPORT;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/warehouses/" + this.getWarehouseId() + "/reports/" + this.getId();
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().interactionReport(this.getWarehouse(), this);
        },

        getObjectTypeId: function()
        {
            return this.get("objectTypeId");
        },

        getObjectId: function()
        {
            return this.get("objectId");
        },

        getKey: function()
        {
            return this.get("key");
        },



        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // REPORT ENTRIES
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists the interaction report entries.
         *
         * @param pagination
         *
         * @chained interaction report entry map
         */
        listEntries: function(pagination)
        {
            var self = this;

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var chainable = this.getFactory().interactionReportEntryMap(self.getWarehouse());
            return this.chainGet(chainable, this.getUri() + "/entries", params);
        },

        /**
         * Reads an interaction report entry.
         *
         * @param interactionReportEntryId
         *
         * @chained interaction report entry
         */
        readEntry: function(interactionReportEntryId)
        {
            var self = this;

            var chainable = this.getFactory().interactionReportEntry(self.getWarehouse());
            return this.chainGet(chainable, this.getUri() + "/entries/" + interactionReportEntryId);
        },

        /**
         * Queries for interaction report entries.
         *
         * @chained interaction map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryEntries: function(query, pagination)
        {
            var self = this;

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return self.getUri() + "/entries/query";
            };

            var chainable = this.getFactory().interactionReportEntryMap(self.getWarehouse());
            return this.chainPost(chainable, uriFunction, params, query);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.InteractionReportMap = Gitana.AbstractWarehouseObjectMap.extend(
    /** @lends Gitana.InteractionReportMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractWarehouseObjectMap
         *
         * @class InteractionReportMap
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object
         */
        constructor: function(warehouse, object)
        {
            this.objectType = function() { return "Gitana.InteractionReportMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(warehouse, object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().interactionReportMap(this.getWarehouse(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().interactionReport(this.getWarehouse(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.InteractionReportEntry = Gitana.AbstractWarehouseObject.extend(
    /** @lends Gitana.InteractionReportEntry.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractWarehouseObject
         *
         * @class InteractionReportEntry
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(warehouse, object)
        {
            this.base(warehouse, object);

            this.objectType = function() { return "Gitana.InteractionReportEntry"; };
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_INTERACTION_REPORT_ENTRY;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/warehouses/" + this.getWarehouseId() + "/reports/" + this.getReportId() + "/entries/" + this.getId();
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().interactionReportEntry(this.getWarehouse(), this);
        },

        getReportId: function()
        {
            return this.get("reportId");
        },

        getKey: function()
        {
            return this.get("key");
        },

        getApplicationId: function()
        {
            return this.get("applicationId");
        },

        getApplicationTitle: function()
        {
            return this.get("applicationTitle");
        },

        getApplicationDescription: function()
        {
            return this.get("applicationDescription");
        },

        getSessionId: function()
        {
            return this.get("sessionId");
        },

        getSessionTitle: function()
        {
            return this.get("sessionTitle");
        },

        getSessionDescription: function()
        {
            return this.get("sessionDescription");
        },

        getPageId: function()
        {
            return this.get("pageId");
        },

        getPageUri: function()
        {
            return this.get("pageUri");
        },

        getPageTitle: function()
        {
            return this.get("pageTitle");
        },

        getPageDescription: function()
        {
            return this.get("pageDescription");
        },

        getNodeId: function()
        {
            return this.get("nodeId");
        },

        getNodeTargetRepositoryId: function()
        {
            return this.get("nodeTargetRepositoryId");
        },

        getNodeTargetBranchId: function()
        {
            return this.get("nodeTargetBranchId");
        },

        getNodeTargetId: function()
        {
            return this.get("nodeTargetId");
        },

        getNodeTitle: function()
        {
            return this.get("nodeTitle");
        },

        getNodeDescription: function()
        {
            return this.get("nodeDescription");
        },

        getUserId: function()
        {
            return this.get("userId");
        },

        getUserTitle: function()
        {
            return this.get("userTitle");
        },

        getUserDescription: function()
        {
            return this.get("userDescription");
        },

        getUserFirstName: function()
        {
            return this.get("userFirstName");
        },

        getUserLastName: function()
        {
            return this.get("userLastName");
        },

        getUserEmail: function()
        {
            return this.get("userEmail");
        },

        getUserName: function()
        {
            return this.get("userName");
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.InteractionReportEntryMap = Gitana.AbstractWarehouseObjectMap.extend(
    /** @lends Gitana.InteractionReportEntryMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractWarehouseObjectMap
         *
         * @class InteractionReportEntryMap
         *
         * @param {Gitana.Warehouse} warehouse
         * @param [Object] object
         */
        constructor: function(warehouse, object)
        {
            this.objectType = function() { return "Gitana.InteractionReportEntryMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(warehouse, object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().interactionReportEntryMap(this.getWarehouse(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().interactionReportEntry(this.getWarehouse(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.Directory = Gitana.AbstractPlatformDataStore.extend(
    /** @lends Gitana.Directory.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformDataStore
         *
         * @class Directory
         *
         * @param {Gitana.Platform} platform
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(platform, object)
        {
            this.objectType = function() { return "Gitana.Directory"; };

            this.base(platform, object);
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/directories/" + this.getId();
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_DIRECTORY;
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().directory(this.getPlatform(), this);
        },




        /////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // IDENTITIES
        //
        /////////////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Reads an identity.
         *
         * @chained identity
         *
         * @param {String} identityId the identity id
         */
        readIdentity: function(identityId)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/identities/" + identityId;
            };

            var chainable = this.getFactory().identity(this);
            return this.chainGet(chainable, uriFunction);
        },

        /**
         * Acquires a list of all identities.
         *
         * @chained identity map
         *
         * @param [Pagination] pagination pagination (optional)
         */
        listIdentities: function(pagination)
        {
            var self = this;

            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return self.getUri() + "/identities";
            };

            // get to work
            var chainable = this.getFactory().identityMap(this);

            // all groups
            return this.chainGet(chainable, uriFunction, params);
        },

        /**
         * Queries for identities.
         *
         * @chained identity map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryIdentities: function(query, pagination)
        {
            var self = this;

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return self.getUri() + "/identities/query";
            };

            var chainable = this.getFactory().identityMap(this);
            return this.chainPost(chainable, uriFunction, params, query);
        },

        /**
         * Performs a bulk check of permissions against permissioned objects of type identity.
         *
         * Example of checks array:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>"
         * }]
         *
         * The callback receives an array of results, example:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>",
         *    "result": true
         * }]
         *
         * The order of elements in the array will be the same for checks and results.
         *
         * @param checks
         * @param callback
         */
        checkIdentityPermissions: function(checks, callback)
        {
            var self = this;

            var object = {
                "checks": checks
            };

            var uriFunction = function()
            {
                return self.getUri() + "/identities/permissions/check";
            };

            return this.chainPostResponse(this, uriFunction, {}, object).then(function(response) {
                callback.call(this, response["results"]);
            });
        },


        /////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // CONNECTIONS
        //
        /////////////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Reads a connection.
         *
         * @chained connection
         *
         * @param {String} connectionId the connection id
         */
        readConnection: function(connectionId)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/connections/" + connectionId;
            };

            var chainable = this.getFactory().connection(this);
            return this.chainGet(chainable, uriFunction);
        },

        /**
         * Creates a connection.
         *
         * @chained connection
         *
         * @param [Object] object JSON object
         */
        createConnection: function(object)
        {
            var self = this;

            if (!object)
            {
                object = {};
            }

            var uriFunction = function()
            {
                return self.getUri() + "/connections";
            };

            var chainable = this.getFactory().connection(this, object);

            return this.chainCreate(chainable, object, uriFunction);
        },

        /**
         * Acquires a list of all connections.
         *
         * @chained identity map
         *
         * @param [Pagination] pagination pagination (optional)
         */
        listConnections: function(pagination)
        {
            var self = this;

            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return self.getUri() + "/connections";
            };

            // get to work
            var chainable = this.getFactory().connectionMap(this);

            // all groups
            return this.chainGet(chainable, uriFunction, params);
        },

        /**
         * Queries for connections.
         *
         * @chained identity map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryConnections: function(query, pagination)
        {
            var self = this;

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return self.getUri() + "/connections/query";
            };

            var chainable = this.getFactory().connectionMap(this);
            return this.chainPost(chainable, uriFunction, params, query);
        },

        /**
         * Performs a bulk check of permissions against permissioned objects of type connection.
         *
         * Example of checks array:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>"
         * }]
         *
         * The callback receives an array of results, example:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>",
         *    "result": true
         * }]
         *
         * The order of elements in the array will be the same for checks and results.
         *
         * @param checks
         * @param callback
         */
        checkConnectionPermissions: function(checks, callback)
        {
            var self = this;

            var object = {
                "checks": checks
            };

            var uriFunction = function()
            {
                return self.getUri() + "/connections/permissions/check";
            };

            return this.chainPostResponse(this, uriFunction, {}, object).then(function(response) {
                callback.call(this, response["results"]);
            });
        }



    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.DirectoryMap = Gitana.AbstractPlatformObjectMap.extend(
    /** @lends Gitana.DirectoryMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObjectMap
         *
         * @class Map of directory objects
         *
         * @param {Gitana.Platform} platform Gitana platform
         * @param {Object} object
         */
        constructor: function(platform, object)
        {
            this.objectType = function() { return "Gitana.DirectoryMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(platform, object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().directoryMap(this.getPlatform(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().directory(this.getPlatform(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.Identity = Gitana.AbstractPlatformObject.extend(
    /** @lends Gitana.Identity.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObject
         *
         * @class Identity
         *
         * @param {Gitana.Directory} directory
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(directory, object)
        {
            this.base(directory.getPlatform(), object);

            this.objectType = function() { return "Gitana.Identity"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.getDirectory = function()
            {
                return directory;
            };

            this.getDirectoryId = function()
            {
                return directory.getId();
            };
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_IDENTITY;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/directories/" + this.getDirectoryId() + "/identities/" + this.getId();
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().identity(this.getDirectory(), this);
        },

        /**
         * Changes the password for this identity.
         *
         * @param password
         * @param verifyPassword
         *
         * @chained this
         * @public
         */
        changePassword: function(password, verifyPassword)
        {
            var object = {
                "password": password,
                "verifyPassword": verifyPassword
            };

            return this.chainPostEmpty(null, this.getUri() + "/changepassword", {}, object);
        },

        /**
         * Retrieves a list of all of the users on any domain that have this identity applied to them.
         *
         * @param tenantId
         */
        findPolicyUsers: function(tenantId)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/policy/users";
            };

            var domain = new Gitana.Domain(this.getPlatform());

            var chainable = this.getFactory().domainPrincipalMap(domain);

            // prepare params
            var params = {};
            if (tenantId)
            {
                params.tenantId = tenantId;
            }

            return this.chainGet(chainable, uriFunction, params);
        },

        /**
         * Finds the user on a tenant platform that has this identity.
         * If multiple users have this identity, the first one is chosen.
         *
         * @param pagination
         */
        findPolicyUserForTenant: function(tenantId)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/policy/user";
            };

            var chainable = this.getFactory().domainPrincipal(this);

            // prepare params (with pagination)
            var params = {};
            params["tenantId"] = tenantId;

            return this.chainGet(chainable, uriFunction, params);
        },

        /**
         * Finds the user on a tenant platform that has this identity.
         * If multiple users have this identity, the first one is chosen.
         *
         * @param pagination
         */
        findPolicyUsersForTenant: function(tenantId)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/policy/users";
            };

            var chainable = this.getFactory().domainPrincipalMap(this);

            // prepare params (with pagination)
            var params = {};
            params["tenantId"] = tenantId;

            return this.chainGet(chainable, uriFunction, params);
        },

        /**
         * Retrieves the tenants that this identity participates in.
         * Optionally allows you to filter down to a particular registrar.
         *
         * @chained principal map
         *
         * @param [String] registrarId
         */
        findPolicyTenants: function(registrarId)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/policy/tenants";
            };

            var chainable = this.getFactory().tenantMap(this);

            // prepare params
            var params = {};
            if (registrarId)
            {
                params["registrarId"] = registrarId;
            }

            return this.chainGet(chainable, uriFunction, params);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.IdentityMap = Gitana.AbstractPlatformObjectMap.extend(
    /** @lends Gitana.IdentityMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObjectMap
         *
         * @class Map of identity objects
         *
         * @param {Gitana.Registrar} directory Gitana directory object
         * @param {Object} object
         */
        constructor: function(directory, object)
        {
            this.objectType = function() { return "Gitana.IdentityMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.getDirectory = function()
            {
                return directory;
            };

            this.getDirectoryId = function()
            {
                return directory.getId();
            };

            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(directory.getPlatform(), object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().identityMap(this.getDirectory(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().identity(this.getDirectory(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.Connection = Gitana.AbstractPlatformObject.extend(
    /** @lends Gitana.Connection.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObject
         *
         * @class Connection
         *
         * @param {Gitana.Directory} directory
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(directory, object)
        {
            this.base(directory.getPlatform(), object);

            this.objectType = function() { return "Gitana.Connection"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.getDirectory = function()
            {
                return directory;
            };

            this.getDirectoryId = function()
            {
                return directory.getId();
            };
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_CONNECTION;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/directories/" + this.getDirectoryId() + "/connections/" + this.getId();
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().connection(this.getDirectory(), this);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.ConnectionMap = Gitana.AbstractPlatformObjectMap.extend(
    /** @lends Gitana.ConnectionMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObjectMap
         *
         * @class Map of connection objects
         *
         * @param {Gitana.Registrar} directory Gitana directory object
         * @param {Object} object
         */
        constructor: function(directory, object)
        {
            this.objectType = function() { return "Gitana.ConnectionMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.getDirectory = function()
            {
                return directory;
            };

            this.getDirectoryId = function()
            {
                return directory.getId();
            };

            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(directory.getPlatform(), object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().connectionMap(this.getDirectory(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().connection(this.getDirectory(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.Domain = Gitana.AbstractPlatformDataStore.extend(
    /** @lends Gitana.Domain.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformDataStore
         *
         * @class Domain
         *
         * @param {Gitana.Platform} platform
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(platform, object)
        {
            this.base(platform, object);

            this.objectType = function() { return "Gitana.Domain"; };
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/domains/" + this.getId();
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_DOMAIN;
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().domain(this.getPlatform(), this);
        },


        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // PRINCIPALS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Acquires a list of all principals.
         *
         * @chained principal map
         *
         * @param [Pagination] pagination pagination (optional)
         */
        listPrincipals: function(pagination)
        {
            var self = this;

            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return self.getUri() + "/principals";
            };

            // get to work
            var chainable = this.getFactory().domainPrincipalMap(this);

            // all groups
            return this.chainGet(chainable, uriFunction, params);
        },

        /**
         * Reads a principal
         *
         * @chained principal
         *
         * @param {String} principalId the principal id
         */
        readPrincipal: function(principalId)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/principals/" + principalId;
            };

            var chainable = this.getFactory().domainPrincipal(this);

            return this.chainGet(chainable, uriFunction);
        },

        /**
         * Create a principal.
         *
         * @chained principal
         *
         * @param [Object] object JSON object
         */
        createPrincipal: function(object)
        {
            var self = this;

            if (!object)
            {
                object = {};
            }

            if (!object.name)
            {
                // TODO: error - requires name
                alert("missing name");
                return;
            }

            if (!object.type)
            {
                // TODO: error - requires type
                alert("missing type");
                return;
            }

            var uriFunction = function()
            {
                return self.getUri() + "/principals";
            };

            var chainable = this.getFactory().domainPrincipal(this, object);

            return this.chainCreate(chainable, object, uriFunction);
        },

        /**
         * Queries for principals.
         *
         * @chained principal map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryPrincipals: function(query, pagination)
        {
            var self = this;

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return self.getUri() + "/principals/query";
            };

            var chainable = this.getFactory().domainPrincipalMap(this);
            return this.chainPost(chainable, uriFunction, params, query);
        },


        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // GROUPS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Acquires a list of all groups in the domain.
         *
         * @chained group map
         *
         * @param [Object] pagination pagination (optional)
         */
        listGroups: function(pagination)
        {
            var query = {
                "type": "GROUP"
            };

            return this.queryPrincipals(query, pagination);
        },

        /**
         * Create a group.
         *
         * @chained group
         *
         * @param {String} groupId the group id
         * @param [Object] object JSON object
         */
        createGroup: function(object)
        {
            if (!object)
            {
                object = {};
            }
            object["type"] = "GROUP";

            return this.createPrincipal(object);
        },

        /**
         * Queries for groups.
         *
         * @chained principal map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryGroups: function(query, pagination)
        {
            if (!query)
            {
                query = {};
            }
            query["type"] = "GROUP";

            return this.queryPrincipals(query, pagination);
        },


        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // USERS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Acquires a list of all users.
         *
         * @chained user map
         *
         * @param [Object] pagination pagination (optional)
         */
        listUsers: function(pagination)
        {
            var query = {
                "type": "USER"
            };

            return this.queryPrincipals(query, pagination);
        },

        /**
         * Create a user.
         *
         * @chained user
         *
         * @param {String} userId the user id
         * @param [Object] object JSON object
         */
        createUser: function(object)
        {
            if (!object)
            {
                object = {};
            }
            object["type"] = "USER";

            return this.createPrincipal(object);
        },

        /**
         * Queries for users.
         *
         * @chained principal map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryUsers: function(query, pagination)
        {
            if (!query)
            {
                query = {};
            }
            query["type"] = "USER";

            return this.queryPrincipals(query, pagination);
        },



        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // MEMBERSHIPS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Adds a principal as a member of a group
         *
         * @chained domain
         *
         * @public
         *
         * @param {Gitana.DomainGroup|String} group the group or the group id
         * @param {Gitana.DomainPrincipal|String} principal the principal or the principal id
         */
        addMember: function(group, principal)
        {
            var self = this;

            var groupId = this.extractPrincipalIdentifiers(group, this.getId())["principal"];
            var principalDomainQualifiedId = this.extractPrincipalDomainQualifiedId(principal);

            var uriFunction = function()
            {
                return self.getUri() + "/principals/" + groupId + "/members/add?id=" + principalDomainQualifiedId;
            };

            return this.chainPostEmpty(null, uriFunction);
        },

        /**
         * Removes a principal as a member of a group.
         *
         * @chained domain
         *
         * @public
         *
         * @param {Gitana.DomainGroup|String} group the group or the group id
         * @param {Gitana.DomainPrincipal|String} principal the principal or the principal id
         */
        removeMember: function(group, principal)
        {
            var self = this;

            var groupId = this.extractPrincipalIdentifiers(group, this.getId())["principal"];
            var principalDomainQualifiedId = this.extractPrincipalDomainQualifiedId(principal);

            var uriFunction = function()
            {
                return self.getUri() + "/principals/" + groupId + "/members/remove?id=" + principalDomainQualifiedId;
            };

            return this.chainPostEmpty(null, uriFunction);
        },

        /**
         * Acquires a list of all of the members who are in this group.
         *
         * @chained principal map
         *
         * @public
         *
         * @param {Object} group
         * @param {String} filter type of principal to hand back ("user" or "group")
         * @param [Object] pagination
         * @param {Boolean} indirect whether to include members that inherit through child groups
         */
        listMembers: function(group, filter, pagination, indirect)
        {
            var self = this;

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }
            if (filter)
            {
                params["filter"] = filter;
            }
            if (indirect)
            {
                params["indirect"] = true;
            }

            var groupId = this.extractPrincipalIdentifiers(group, this.getId())["principal"];

            var uriFunction = function()
            {
                return self.getUri() + "/principals/" + groupId + "/members";
            };

            var chainable = this.getFactory().domainPrincipalMap(this);
            return this.chainGet(chainable, uriFunction, params);
        },



        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // BULK PERMISSIONS CHECK
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Performs a bulk check of permissions against permissioned objects of type principal.
         *
         * Example of checks array:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>"
         * }]
         *
         * The callback receives an array of results, example:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>",
         *    "result": true
         * }]
         *
         * The order of elements in the array will be the same for checks and results.
         *
         * @param checks
         * @param callback
         */
        checkPrincipalPermissions: function(checks, callback)
        {
            var self = this;

            var object = {
                "checks": checks
            };

            var uriFunction = function()
            {
                return self.getUri() + "/principals/permissions/check";
            };

            return this.chainPostResponse(this, uriFunction, {}, object).then(function(response) {
                callback.call(this, response["results"]);
            });
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.DomainMap = Gitana.AbstractPlatformObjectMap.extend(
    /** @lends Gitana.DomainMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObjectMap
         *
         * @class Map of domain objects
         *
         * @param {Gitana.Platform} platform Gitana platform
         * @param {Object} object
         */
        constructor: function(platform, object)
        {
            this.objectType = function() { return "Gitana.DomainMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(platform, object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().domainMap(this.getPlatform(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().domain(this.getPlatform(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.DomainPrincipal = Gitana.AbstractPlatformObject.extend(
    /** @lends Gitana.DomainPrincipal.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObject
         *
         * @class DomainPrincipal
         *
         * @param {Gitana.Domain} domain
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(domain, object)
        {
            this.base(domain.getPlatform(), object);

            this.objectType = function() { return "Gitana.DomainPrincipal"; };



            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            /**
             * Gets the Gitana Domain object.
             *
             * @inner
             *
             * @returns {Gitana.Domain} The Gitana Domain object
             */
            this.getDomain = function() { return domain; };

            /**
             * Gets the Gitana Domain id.
             *
             * @inner
             *
             * @returns {String} The Gitana Domain id
             */
            this.getDomainId = function() { return domain.getId(); };
        },

        /**
         * @override
         */
        getUri: function()
        {
            return "/domains/" + this.getDomainId() + "/principals/" + this.getId();
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().domainPrincipal(this.getDomain(), this);
        },

        /**
         * @override
         */
        beforeChainRun: function()
        {
            // extend the principal with any type specific methods/properties
            this.getFactory().extendPrincipal(this);
        },

        /**
         * @returns {String} the principal name
         */
        getName: function()
        {
            return this.get("name");
        },

        /**
         * @returns {String} the principal type ("user" or "group")
         */
        getType: function()
        {
            return this.get("type");
        },

        /**
         * @returns {String} the domain qualified principal name
         */
        getDomainQualifiedName: function()
        {
            return this.getDomainId() + "/" + this.getName();
        },

        /**
         * @returns {String} the domain qualified principal id
         */
        getDomainQualifiedId: function()
        {
            return this.getDomainId() + "/" + this.getId();
        },



        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // MEMBERSHIPS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Acquires the groups that contain this principal
         *
         * @chained principal map
         *
         * @public
         *
         * @param {Boolean} indirect whether to consider indirect groups
         * @param {Pagination} pagination
         */
        listMemberships: function(indirect, pagination)
        {
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                var uri = this.getUri() + "/memberships";
                if (indirect)
                {
                    uri = uri + "?indirect=true";
                }

                return uri;
            };

            var chainable = this.getFactory().domainPrincipalMap(this.getDomain());
            return this.chainGet(chainable, uriFunction, params);
        },


        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // ATTACHMENTS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Hands back an attachments map.
         *
         * @chained attachment map
         *
         * @param local
         *
         * @public
         */
        listAttachments: Gitana.Methods.listAttachments(),

        /**
         * Picks off a single attachment
         *
         * @chained attachment
         *
         * @param attachmentId
         */
        attachment: function(attachmentId)
        {
            return this.listAttachments().select(attachmentId);
        },

        /**
         * Creates an attachment.
         *
         * When using this method from within the JS driver, it really only works for text-based content such
         * as JSON or text.
         *
         * @chained attachment
         *
         * @param attachmentId (use null or false for default attachment)
         * @param contentType
         * @param data
         */
        attach: Gitana.Methods.attach(),

        /**
         * Deletes an attachment.
         *
         * @param attachmentId
         */
        unattach: Gitana.Methods.unattach(),

        /**
         * Generates a URI to a preview resource.
         */
        getPreviewUri: Gitana.Methods.getPreviewUri(),

        /**
         * Lists the authentication grants for this principal
         *
         * @param pagination
         *
         * @chained authentication grant map
         */
        listAuthenticationGrants: function(pagination)
        {
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            params.domainId = this.getDomainId();
            params.principalId = this.getId();

            var chainable = this.getFactory().authenticationGrantMap(this.getPlatform());
            return this.chainGet(chainable, "/auth/grants", params);
        },

        /**
         * Lists the teams that this principal belongs to against the given teamable
         *
         * @param teamable
         * @param pagination (optional)
         */
        listTeamMemberships: function(teamable, pagination)
        {
            var params = {
                "teamableType": teamable.getType(),
                "teamableId": teamable.getId()
            };

            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return this.getUri() + "/teams";
            };

            var chainable = this.getFactory().teamMap(this.getCluster(), this);
            return this.chainGet(chainable, uriFunction, params);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.PrincipalMap = Gitana.AbstractPlatformObjectMap.extend(
    /** @lends Gitana.PrincipalMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObjectMap
         *
         * @class Map of principal objects
         *
         * @param {Gitana.Domain} domain Gitana domain instance.
         * @param [Object] object
         */
        constructor: function(domain, object)
        {
            this.objectType = function() { return "Gitana.PrincipalMap"; };

            this.getDomain = function()
            {
                return domain;
            };

            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(domain.getPlatform(), object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().domainPrincipalMap(this.getDomain(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().domainPrincipal(this.getDomain(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.DomainGroup =
    {
        TYPE: "GROUP",

        /**
         * Reads the group node for this user.
         *
         * @param branch
         * @param createIfNotFound
         *
         * @chained person
         * @public
         */
        readGroupNode: function(branch, createIfNotFound)
        {
            // what we hand back
            var result = this.subchain(this.getFactory().node(branch, "n:group"));

            // work
            result.subchain(branch).readGroupNode(this.getId(), createIfNotFound).then(function() {
                result.handleResponse(this);
            });

            return result;
        },

        /**
         * Acquires a list of all of the members who are in this group.
         *
         * @chained principal map
         *
         * @public
         *
         * @param {String} filter type of principal to hand back ("user" or "group")
         * @param {Boolean} indirect whether to include members that inherit through child groups
         * @param [Object] pagination
         */
        listMembers: function(filter, indirect, pagination)
        {
            var self = this;

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }
            if (filter)
            {
                params["filter"] = filter;
            }
            if (indirect)
            {
                params["indirect"] = true;
            }

            var uriFunction = function()
            {
                return self.getUri() + "/members";
            };

            var chainable = this.getFactory().domainPrincipalMap(this.getDomain());
            return this.chainGet(chainable, uriFunction, params);
        },

        /**
         * Acquires a list of all of the users who are in this group.
         *
         * @chained principal map
         *
         * @public
         *
         * @param [Boolean] inherit whether to include members that inherit through child groups
         * @param [Object] pagination
         */
        listUsers: function()
        {
            var inherit = false;
            var pagination = null;
            var args = Gitana.makeArray(arguments);
            var a1 = args.shift();
            if (Gitana.isBoolean(a1))
            {
                inherit = a1;
                pagination = args.shift();
            }
            else
            {
                pagination = args.shift();
            }

            return this.listMembers("user", inherit, pagination);
        },

        /**
         * Acquires a list of all of the groups who are in this group.
         *
         * @chained principal map
         *
         * @public
         *
         * @param [Boolean] inherit whether to include members that inherit through child groups
         * @param [Object] pagination
         */
        listGroups: function()
        {
            var inherit = false;
            var pagination = null;
            var args = Gitana.makeArray(arguments);
            var a1 = args.shift();
            if (Gitana.isBoolean(a1))
            {
                inherit = a1;
                pagination = args.shift();
            }
            else
            {
                pagination = a1;
            }

            return this.listMembers("group", inherit, pagination);
        },

        /**
         * Adds a principal as a member of this group.
         *
         * @chained current group
         *
         * @public
         *
         * @param {Gitana.Principal|String} principal the principal or the principal id
         */
        addMember: function(principal)
        {
            var principalDomainQualifiedId = this.extractPrincipalDomainQualifiedId(principal);

            return this.chainPostEmpty(null, this.getUri() + "/members/add?id=" + principalDomainQualifiedId);
        },

        /**
         * Removes a principal as a member of this group.
         *
         * @chained current group
         *
         * @public
         *
         * @param {Gitana.Principal|String} principal the principal or the principal id
         */
        removeMember: function(principal)
        {
            var principalDomainQualifiedId = this.extractPrincipalDomainQualifiedId(principal);

            return this.chainPostEmpty(null, this.getUri() + "/members/remove?id=" + principalDomainQualifiedId);
        }

    };

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.DomainUser =
    {
        TYPE: "USER",

        /**
         * Reads the person node for this user.
         *
         * @param branch
         * @param createIfNotFound
         *
         * @chained person
         * @public
         */
        readPersonNode: function(branch, createIfNotFound)
        {
            // what we hand back
            var result = this.subchain(this.getFactory().node(branch, "n:person"));

            // work
            result.subchain(branch).readPersonNode(this.getDomainQualifiedId(), createIfNotFound).then(function() {
                result.handleResponse(this);
            });

            return result;
        },

        hasIdentity: function()
        {
            return (this.getDirectoryId() && this.getIdentityId());
        },

        getDirectoryId: function()
        {
            return this.get("directoryId");
        },

        getIdentityId: function()
        {
            return this.get("identityId");
        },

        readDirectory: function()
        {
            var directory = this.getFactory().directory(this.getPlatform(), {
                "_doc": this.getDirectoryId()
            });

            // what we hand back
            var result = this.subchain(directory);

            // work
            result.subchain(this.getPlatform()).readDirectory(this.getDirectoryId()).then(function() {
                result.handleResponse(this);
            });

            return result;
        },

        readIdentity: function()
        {
            var self = this;

            var directory = this.getFactory().directory(this.getPlatform(), {
                "_doc": this.getDirectoryId()
            });

            var identity = this.getFactory().identity(directory, {
                "_doc": this.getIdentityId()
            });


            // what we hand back
            var result = this.subchain(identity);

            // work
            result.subchain(this.getPlatform()).readDirectory(self.getDirectoryId()).then(function() {

                // NOTE: this = directory

                directory.handleResponse(this);

                this.readIdentity(self.getIdentityId()).then(function() {

                    // NOTE: this = identity

                    identity.handleResponse(this);

                    // all done
                });

                //return false;
            });

            return result;
        },

        //////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // PROPERTIES
        //
        //////////////////////////////////////////////////////////////////////////////////////////////////

        getFirstName: function()
        {
            return this.get("firstName");
        },

        setFirstName: function(firstName)
        {
            this.set("firstName", firstName);
        },

        getLastName: function()
        {
            return this.get("lastName");
        },

        setLastName: function(lastName)
        {
            this.set("lastName", lastName);
        },

        getCompanyName: function()
        {
            return this.get("companyName");
        },

        setCompanyName: function(companyName)
        {
            this.set("companyName", companyName);
        },

        getEmail: function()
        {
            return this.get("email");
        },

        setEmail: function(email)
        {
            this.set("email", email);
        },

        getJobTitle: function()
        {
            return this.get("jobTitle");
        },

        setJobTitle: function(jobTitle)
        {
            this.set("jobTitle", jobTitle);
        },

        getAddress: function()
        {
            return this.get("address");
        },

        setAddress: function(address)
        {
            this.set("address", address);
        },

        getCity: function()
        {
            return this.get("city");
        },

        setCity: function(city)
        {
            this.set("city", city);
        },

        getState: function()
        {
            return this.get("state");
        },

        setState: function(state)
        {
            this.set("state", state);
        },

        getZipcode: function()
        {
            return this.get("zipcode");
        },

        setZipcode: function(zipcode)
        {
            this.set("zipcode", zipcode);
        },

        getPhoneNumber: function()
        {
            return this.get("phoneNumber");
        },

        setPhoneNumber: function(phoneNumber)
        {
            this.set("phoneNumber", phoneNumber);
        }

    };

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.Registrar = Gitana.AbstractPlatformDataStore.extend(
    /** @lends Gitana.Registrar.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformDataStore
         *
         * @class Registrar
         *
         * @param {Gitana.Platform} platform
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(platform, object)
        {
            this.objectType = function() { return "Gitana.Registrar"; };

            this.base(platform, object);
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/registrars/" + this.getId();
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_REGISTRAR;
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().registrar(this.getPlatform(), this);
        },




        /////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // TENANTS
        //
        /////////////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists all of the tenants.
         *
         * @chained tenant map
         *
         * @param [Object] pagination pagination (optional)
         */
        listTenants: function(pagination)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/tenants";
            };

            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var chainable = this.getFactory().tenantMap(this);
            return this.chainGet(chainable, uriFunction, params);
        },

        /**
         * Queries for a tenant.
         *
         * @chained tenant map
         *
         * @param {Object} query Query for finding a tenant.
         * @param [Object] pagination pagination (optional)
         */
        queryTenants: function(query, pagination)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/tenants/query";
            };

            var chainable = this.getFactory().tenantMap(this);

            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            return this.chainPost(chainable, uriFunction, params, query);
        },

        /**
         * Reads a tenant.
         *
         * @chained tenant
         *
         * @param {String} tenantId the tenant id
         */
        readTenant: function(tenantId)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/tenants/" + tenantId;
            };

            var chainable = this.getFactory().tenant(this);
            return this.chainGet(chainable, uriFunction);
        },

        /**
         * Lookup a tenant for a principal.
         *
         * @chained tenant
         *
         * @param {Gitana.Principal} principal
         */
        lookupTenantForPrincipal: function(principal)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/tenants/lookup?id=" + principal.getDomainQualifiedId();
            };

            var chainable = this.getFactory().tenant(this);
            return this.chainGet(chainable, uriFunction);
        },

        /**
         * Creates a tenant
         *
         * @chained tenant
         *
         * @param {Gitana.DomainPrincipal} principal
         * @param {String} planKey
         * @param [Object] payment method (required if plan requires a payment method)
         */
        createTenant: function(principal, planKey, paymentMethod)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/tenants";
            };

            // set up object
            var object = {};
            object["principalId"] = principal.getId();
            object["domainId"] = principal.getDomainId();
            object["planKey"] = planKey;
            if (paymentMethod)
            {
                object["paymentMethod"] = paymentMethod;
            }

            // create
            var chainable = this.getFactory().tenant(this);
            return this.chainCreate(chainable, object, uriFunction);
        },

        /**
         * Performs a bulk check of permissions against permissioned objects of type tenant.
         *
         * Example of checks array:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "domainId": "<domainId>", (optional)
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>"
         * }]
         *
         * The callback receives an array of results, example:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "domainId": "<domainId>", (optional)
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>",
         *    "result": true
         * }]
         *
         * The order of elements in the array will be the same for checks and results.
         *
         * @param checks
         * @param callback
         */
        checkTenantPermissions: function(checks, callback)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/tenants/permissions/check";
            };

            var object = {
                "checks": checks
            };

            return this.chainPostResponse(this, uriFunction, {}, object).then(function(response) {
                callback.call(this, response["results"]);
            });
        },





        /////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // PLANS
        //
        /////////////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists all of the plans.
         *
         * @chained plan map
         *
         * @param [Object] pagination pagination (optional)
         */
        listPlans: function(pagination)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/plans";
            };

            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var chainable = this.getFactory().planMap(this);
            return this.chainGet(chainable, uriFunction, params);
        },

        /**
         * Queries for plans.
         *
         * @chained plan map
         *
         * @param {Object} query Query for finding a tenant.
         * @param [Object] pagination pagination (optional)
         */
        queryPlans: function(query, pagination)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/plans/query";
            };

            var chainable = this.getFactory().planMap(this);

            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            return this.chainPost(chainable, uriFunction, params, query);
        },

        /**
         * Reads a plan.
         *
         * @chained plan
         *
         * @param {String} planId the plan id
         */
        readPlan: function(planId)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/plans/" + planId;
            };

            var chainable = this.getFactory().plan(this);
            return this.chainGet(chainable, uriFunction);
        },

        /**
         * Creates a plan
         *
         * @chained plan
         *
         * @param [Object] object JSON object
         */
        createPlan: function(object)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/plans";
            };

            var chainable = this.getFactory().plan(this);
            return this.chainCreate(chainable, object, uriFunction);
        },

        /**
         * Performs a bulk check of permissions against permissioned objects of type plan.
         *
         * Example of checks array:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "domainId": "<domainId>", (optional)
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>"
         * }]
         *
         * The callback receives an array of results, example:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "domainId": "<domainId>", (optional)
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>",
         *    "result": true
         * }]
         *
         * The order of elements in the array will be the same for checks and results.
         *
         * @param checks
         * @param callback
         */
        checkPlanPermissions: function(checks, callback)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/plans/permissions/check";
            };

            var object = {
                "checks": checks
            };

            return this.chainPostResponse(this, uriFunction, {}, object).then(function(response) {
                callback.call(this, response["results"]);
            });
        },




        /////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // METERS
        //
        /////////////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists all of the meters.
         *
         * @chained meter map
         *
         * @param [Object] pagination pagination (optional)
         */
        listMeters: function(pagination)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/meters";
            };

            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var chainable = this.getFactory().meterMap(this);
            return this.chainGet(chainable, uriFunction, params);
        },

        /**
         * Queries for meters.
         *
         * @chained meter map
         *
         * @param {Object} query Query for finding a tenant.
         * @param [Object] pagination pagination (optional)
         */
        queryMeters: function(query, pagination)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/meters/query";
            };

            var chainable = this.getFactory().meterMap(this);

            // prepare params (with pagination)
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            return this.chainPost(chainable, uriFunction, params, query);
        },

        /**
         * Reads a meter.
         *
         * @chained meter
         *
         * @param {String} meterId the meter id
         */
        readMeter: function(meterId)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/meters/" + meterId;
            };

            var chainable = this.getFactory().meter(this);
            return this.chainGet(chainable, uriFunction);
        },

        /**
         * Creates a meter
         *
         * @chained meter
         *
         * @param [Object] object JSON object
         */
        createMeter: function(object)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/meters";
            };

            var chainable = this.getFactory().meter(this);
            return this.chainCreate(chainable, object, uriFunction);
        },

        /**
         * Performs a bulk check of permissions against permissioned objects of type meter.
         *
         * Example of checks array:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "domainId": "<domainId>", (optional)
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>"
         * }]
         *
         * The callback receives an array of results, example:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "domainId": "<domainId>", (optional)
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>",
         *    "result": true
         * }]
         *
         * The order of elements in the array will be the same for checks and results.
         *
         * @param checks
         * @param callback
         */
        checkMeterPermissions: function(checks, callback)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/meters/permissions/check";
            };

            var object = {
                "checks": checks
            };

            return this.chainPostResponse(this, uriFunction, {}, object).then(function(response) {
                callback.call(this, response["results"]);
            });
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.RegistrarMap = Gitana.AbstractPlatformObjectMap.extend(
    /** @lends Gitana.RegistrarMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObjectMap
         *
         * @class Map of registrar objects
         *
         * @param {Gitana.Platform} platform Gitana platform
         * @param {Object} object
         */
        constructor: function(platform, object)
        {
            this.objectType = function() { return "Gitana.RegistrarMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(platform, object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().registrarMap(this.getPlatform(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().registrar(this.getPlatform(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.Meter = Gitana.AbstractPlatformObject.extend(
    /** @lends Gitana.Meter.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObject
         *
         * @class Meter
         *
         * @param {Gitana.Registrar} registrar
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(registrar, object)
        {
            this.base(registrar.getPlatform(), object);

            this.objectType = function() { return "Gitana.Meter"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.getRegistrar = function()
            {
                return registrar;
            };

            this.getRegistrarId = function()
            {
                return registrar.getId();
            };
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_PLAN;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/registrars/" + this.getRegistrarId() + "/meters/" + this.getId();
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().meter(this.getRegistrar(), this);
        }

    });

    // constants

    // tenant information
    Gitana.Meter.FIELD_TENANT_ID = "tenantId";

    // meter data
    Gitana.Meter.FIELD_METER_TYPE = "meterType";
    Gitana.Meter.FIELD_METER_START = "meterStart"; // timestamp
    Gitana.Meter.FIELD_METER_END = "meterEnd"; // timestamp

    // bytes
    Gitana.Meter.FIELD_MAX_BYTE_COUNT = "maxByteCount";
    Gitana.Meter.FIELD_RAW_BYTE_COUNT = "rawByteCount"; // raw count (all bytes counter)
    Gitana.Meter.FIELD_RAW_BYTE_COUNT_PERCENTAGE = "rawByteCountPercentage";
    Gitana.Meter.FIELD_UNPROCESSED_BYTE_COUNT = "unprocessedByteCount"; // waiting to be processed
    Gitana.Meter.FIELD_BILLABLE_BYTE_COUNT = "billableByteCount";
    Gitana.Meter.FIELD_BILLABLE_BYTE_COUNT_PERCENTAGE = "billableByteCountPercentage";

    // objects
    Gitana.Meter.FIELD_MAX_OBJECT_COUNT = "maxObjectCount";
    Gitana.Meter.FIELD_RAW_OBJECT_COUNT = "rawObjectCount"; // raw count (all objects counter)
    Gitana.Meter.FIELD_RAW_OBJECT_COUNT_PERCENTAGE = "rawObjectCountPercentage";
    Gitana.Meter.FIELD_UNPROCESSED_OBJECT_COUNT = "unprocessedObjectCount";
    Gitana.Meter.FIELD_BILLABLE_OBJECT_COUNT = "billableObjectCount";
    Gitana.Meter.FIELD_BILLABLE_OBJECT_COUNT_PERCENTAGE = "billableObjectCountPercentage";

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.MeterMap = Gitana.AbstractPlatformObjectMap.extend(
    /** @lends Gitana.MeterMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObjectMap
         *
         * @class Map of meter objects
         *
         * @param {Gitana.Registrar} registrar Gitana registrar object
         * @param {Object} object
         */
        constructor: function(registrar, object)
        {
            this.objectType = function() { return "Gitana.MeterMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.getRegistrar = function()
            {
                return registrar;
            };

            this.getRegistrarId = function()
            {
                return registrar.getId();
            };

            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(registrar.getPlatform(), object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().planMap(this.getRegistrar(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().plan(this.getRegistrar(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.Plan = Gitana.AbstractPlatformObject.extend(
    /** @lends Gitana.Plan.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObject
         *
         * @class Plan
         *
         * @param {Gitana.Registrar} registrar
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(registrar, object)
        {
            this.base(registrar.getPlatform(), object);

            this.objectType = function() { return "Gitana.Plan"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.getRegistrar = function()
            {
                return registrar;
            };

            this.getRegistrarId = function()
            {
                return registrar.getId();
            };
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_PLAN;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/registrars/" + this.getRegistrarId() + "/plans/" + this.getId();
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().plan(this.getRegistrar(), this);
        },

        getPlanKey: function()
        {
            return this.get("planKey");
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.PlanMap = Gitana.AbstractPlatformObjectMap.extend(
    /** @lends Gitana.PlanMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObjectMap
         *
         * @class Map of plan objects
         *
         * @param {Gitana.Registrar} registrar Gitana registrar object
         * @param {Object} object
         */
        constructor: function(registrar, object)
        {
            this.objectType = function() { return "Gitana.PlanMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.getRegistrar = function()
            {
                return registrar;
            };

            this.getRegistrarId = function()
            {
                return registrar.getId();
            };

            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(registrar.getPlatform(), object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().planMap(this.getRegistrar(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().plan(this.getRegistrar(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.Tenant = Gitana.AbstractPlatformObject.extend(
    /** @lends Gitana.Tenant.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObject
         *
         * @class Tenant
         *
         * @param {Gitana.Registrar} registrar
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(registrar, object)
        {
            this.base(registrar.getPlatform(), object);

            this.objectType = function() { return "Gitana.Tenant"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.getRegistrar = function()
            {
                return registrar;
            };

            this.getRegistrarId = function()
            {
                return registrar.getId();
            };
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_TENANT;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/registrars/" + this.getRegistrarId() + "/tenants/" + this.getId();
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().tenant(this.getRegistrar(), this);
        },

        /**
         * Gets the DNS slug for the tenant
         */
        getDnsSlug: function()
        {
            return this.get("dnsSlug");
        },

        /**
         * Gets the plan key for the tenant
         */
        getPlanKey: function()
        {
            return this.get("planKey");
        },

        /**
         * Gets the id of the principal that is the owner of this tenant.
         */
        getPrincipalId: function()
        {
            return this.get("principalId");
        },

        /**
         * Gets the domain id of the principal that is the owner of this tenant.
         */
        getPrincipalDomainId: function()
        {
            return this.get("domainId");
        },

        /**
         * Gets the id of the platform that belongs to this tenant.
         */
        getPlatformId: function()
        {
            return this.get("platformId");
        },

        /**
         * Hands back the plan that this tenant is subscribed to.
         *
         * @chained plan
         */
        readTenantPlan: function()
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getPlatform().getUri() + "/registrars/" + self.getRegistrarId() + "/plans/" + self.getPlanKey();
            };

            var chainable = this.getFactory().plan(this.getRegistrar());
            return this.chainGet(chainable, uriFunction);
        },

        /**
         * Hands back the principal that owns this tenant.
         *
         * @chained principal
         */
        readTenantPrincipal: function()
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getPlatform().getUri() + "/domains/" + self.getPrincipalDomainId() + "/principals/" + self.getPrincipalId();
            };

            // TODO - this is a pretty big hack at the moment
            var domain = this.getFactory().domain(this.getPlatform(), {
                "_doc": this.getPrincipalDomainId()
            });

            var chainable = this.getFactory().domainPrincipal(domain);
            return this.chainGet(chainable, uriFunction);
        },




        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // ATTACHMENTS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Hands back an attachments map.
         *
         * @chained attachment map
         *
         * @param local
         *
         * @public
         */
        listAttachments: Gitana.Methods.listAttachments(),

        /**
         * Picks off a single attachment
         *
         * @chained attachment
         *
         * @param attachmentId
         */
        attachment: function(attachmentId)
        {
            return this.listAttachments().select(attachmentId);
        },

        /**
         * Creates an attachment.
         *
         * When using this method from within the JS driver, it really only works for text-based content such
         * as JSON or text.
         *
         * @chained attachment
         *
         * @param attachmentId (use null or false for default attachment)
         * @param contentType
         * @param data
         */
        attach: Gitana.Methods.attach(),

        /**
         * Deletes an attachment.
         *
         * @param attachmentId
         */
        unattach: Gitana.Methods.unattach(),





        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // METHODS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists the allocations to the tenant.
         *
         * @param callback the callback function
         * @param objectType
         * @param pagination
         *
         * @chained this
         */
        listAllocatedObjects: function(callback, objectType, pagination)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/objects";
            };

            // parameters
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }
            if (objectType)
            {
                params["type"] = objectType;
            }

            return this.chainGetResponse(this, uriFunction, params).then(function(response) {
                callback.call(this, response["rows"]);
            });
        },

        listAllocatedRepositoryObjects: function(callback, pagination)
        {
            return this.listAllocatedObjects(callback, "repository", pagination);
        },

        listAllocatedDomainObjects: function(callback, pagination)
        {
            return this.listAllocatedObjects(callback, "domain", pagination);
        },

        listAllocatedVaultObjects: function(callback, pagination)
        {
            return this.listAllocatedObjects(callback, "vault", pagination);
        },

        listAllocatedClientObjects: function(callback, pagination)
        {
            return this.listAllocatedObjects(callback, "client", pagination);
        },

        listAllocatedRegistrarObjects: function(callback, pagination)
        {
            return this.listAllocatedObjects(callback, "registrar", pagination);
        },

        listAllocatedStackObjects: function(callback, pagination)
        {
            return this.listAllocatedObjects(callback, "stack", pagination);
        },

        listAllocatedDirectoryObjects: function(callback, pagination)
        {
            return this.listAllocatedObjects(callback, "directory", pagination);
        },

        listAllocatedApplicationObjects: function(callback, pagination)
        {
            return this.listAllocatedObjects(callback, "application", pagination);
        },

        /**
         * Retrieves the default client configuration for this tenant.
         *
         * @param callback the method to receive the client configuration
         *
         * @chained this
         */
        readDefaultAllocatedClientObject: function(callback)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/defaultclient";
            };

            return this.chainGetResponse(this, uriFunction, {}).then(function(response) {

                var client = {};
                Gitana.copyInto(client, response);
                Gitana.stampInto(client, Gitana.ClientMethods);
                client.get = function(key) { return this[key]; };

                callback.call(this, client);
            });
        },

        /**
         * Lists the auto-client mappings maintained for this tenant.
         *
         * @param callback the callback function
         * @param pagination
         *
         * @chained this
         */
        listAutoClientMappingObjects: function(callback, pagination)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/autoclientmappings";
            };

            // parameters
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            return this.chainGetResponse(this, uriFunction, params).then(function(response) {
                callback.call(this, response["rows"]);
            });
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.TenantMap = Gitana.AbstractPlatformObjectMap.extend(
    /** @lends Gitana.TenantMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObjectMap
         *
         * @class Map of tenant objects
         *
         * @param {Gitana.Registrar} registrar Gitana registrar object
         * @param {Object} object
         */
        constructor: function(registrar, object)
        {
            this.objectType = function() { return "Gitana.TenantMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.getRegistrar = function()
            {
                return registrar;
            };

            this.getRegistrarId = function()
            {
                return registrar.getId();
            };

            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(registrar.getPlatform(), object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().tenantMap(this.getRegistrar(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().tenant(this.getRegistrar(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.Repository = Gitana.AbstractPlatformDataStore.extend(
    /** @lends Gitana.Repository.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformDataStore
         *
         * @class Repository
         *
         * @param {Gitana.Platform} platform
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(platform, object)
        {
            this.base(platform, object);

            this.objectType = function() { return "Gitana.Repository"; };
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_REPOSITORY;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/repositories/" + this.getId();
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().repository(this.getPlatform(), this);
        },



        //////////////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // BRANCHES
        //
        //////////////////////////////////////////////////////////////////////////////////////////////////////////

        /**
         * List the branches.
         *
         * @chained branch map
         *
         * @public
         *
         * @param [Object] pagination
         */
        listBranches: function(pagination)
        {
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return "/repositories/" + this.getId() + "/branches";
            };

            var chainable = this.getFactory().branchMap(this);
            return this.chainGet(chainable, uriFunction, params);
        },

        /**
         * Reads a branch.
         *
         * @chained branch
         *
         * @public
         *
         * @param {String} branchId the branch id
         */
        readBranch: function(branchId)
        {
            var uriFunction = function()
            {
                return "/repositories/" + this.getId() + "/branches/" + branchId;
            };

            var chainable = this.getFactory().branch(this);
            return this.chainGet(chainable, uriFunction);
        },

        /**
         * Creates a branch.
         *
         * @chained branch
         *
         * @public
         *
         * @param {String} changesetId the changeset id where the new branch should be rooted.
         * @param [Object] object JSON object for the branch
         */
        createBranch: function(changesetId, object)
        {
            var uriFunction = function()
            {
                return "/repositories/" + this.getId() + "/branches";
            };

            var createParams = {
                "changeset": changesetId
            };
            var chainable = this.getFactory().branch(this);
            return this.chainCreate(chainable, object, uriFunction, createParams);
        },

        /**
         * Queries for branches.
         *
         * Config should be:
         *
         *    {
         *       Gitana query configs
         *    }
         *
         * @public
         *
         * @param {Object} query
         * @param [Object] pagination
         */
        queryBranches: function(query, pagination)
        {
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return "/repositories/" + this.getId() + "/branches/query";
            };

            var chainable = this.getFactory().branchMap(this);
            return this.chainPost(chainable, uriFunction, params, query);
        },

        /**
         * Performs a bulk check of permissions against permissioned objects of type branch.
         *
         * Example of checks array:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>"
         * }]
         *
         * The callback receives an array of results, example:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>",
         *    "result": true
         * }]
         *
         * The order of elements in the array will be the same for checks and results.
         *
         * @param checks
         * @param callback
         */
        checkBranchPermissions: function(checks, callback)
        {
            var uriFunction = function()
            {
                return "/repositories/" + this.getId() + "/branches/permissions/check";
            };

            var object = {
                "checks": checks
            };

            return this.chainPostResponse(this, uriFunction, {}, object).then(function(response) {
                callback.call(this, response["results"]);
            });
        },


        /**
         * List the changesets in this repository.
         *
         * @chained
         *
         * @public
         */
        listChangesets: function()
        {
            var uriFunction = function()
            {
                return "/repositories/" + this.getId() + "/changesets";
            };

            var chainable = this.getFactory().changesetMap(this);
            return this.chainGet(chainable, uriFunction);
        },

        /**
         * Read a changeset.
         *
         * @chained
         *
         * @public
         *
         * @param {String} changesetId the id of the changeset
         */
        readChangeset: function(changesetId)
        {
            var uriFunction = function()
            {
                return "/repositories/" + this.getId() + "/changesets/" + changesetId;
            };

            var chainable = this.getFactory().changeset(this);
            return this.chainGet(chainable, uriFunction);
        },

        /**
         * Acquires a list of the parent changesets for a given changeset.
         *
         * @chained
         *
         * @public
         *
         * @param {String} changesetId the id of the changeset
         */
        listChangesetParents: function(changesetId)
        {
            var uriFunction = function()
            {
                return "/repositories/" + this.getId() + "/changesets/" + changesetId + "/parents";
            };

            var chainable = this.getFactory().changesetMap(this);
            return this.chainGet(chainable, uriFunction);
        },

        /**
         * Acquires a list of the child changesets for a given changeset.
         *
         * @chained
         *
         * @public
         *
         * @param {String} changesetId the id of the changeset
         */
        listChangesetChildren: function(changesetId)
        {
            var uriFunction = function()
            {
                return "/repositories/" + this.getId() + "/changesets/" + changesetId + "/children";
            };

            var chainable = this.getFactory().changesetMap(this);
            return this.chainGet(chainable, uriFunction);
        },

        /**
         * Queries for changesets.
         *
         * Config should be:
         *
         *    {
         *       Gitana query configs
         *    }
         *
         * @public
         *
         * @param {Object} query
         * @param [Object] pagination
         */
        queryChangesets: function(query, pagination)
        {
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return "/repositories/" + this.getId() + "/changesets/query";
            };

            var chainable = this.getFactory().changesetMap(this);
            return this.chainPost(chainable, uriFunction, params, query);
        },



        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // ACCESSORS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        getMaxSize: function()
        {
            return this.get("maxSize");
        },

        getSize: function()
        {
            return this.get("size");
        },

        getObjectCount: function()
        {
            return this.get("objectcount");
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.RepositoryMap = Gitana.AbstractPlatformObjectMap.extend(
    /** @lends Gitana.RepositoryMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObjectMap
         *
         * @class Map of repository objects
         *
         * @param {Gitana.Platform} platform Gitana platform instance.
         * @param {Object} object
         */
        constructor: function(platform, object)
        {
            this.objectType = function() { return "Gitana.RepositoryMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(platform, object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().repositoryMap(this.getPlatform(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().repository(this.getPlatform(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.AbstractNode = Gitana.AbstractPlatformObject.extend(
    /** @lends Gitana.AbstractNode.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObject
         *
         * @class Abstract base class for Gitana Node implementations.
         *
         * @param {Gitana.Branch} branch
         * @param [Object] object
         */
        constructor: function(branch, object)
        {
            // helper methods for system-managed state

            this.__qname = (function() {
                var _qname = null;
                return function(qname) {
                    if (!Gitana.isUndefined(qname)) { _qname = qname; }
                    return _qname;
                };
            })();

            this.__type = (function() {
                var _type = null;
                return function(type) {
                    if (!Gitana.isUndefined(type)) { _type = type; }
                    return _type;
                };
            })();

            this.__features = (function() {
                var _features = {};
                return function(features) {
                    if (!Gitana.isUndefined(features)) { _features = features; }
                    return _features;
                };
            })();

            this.__stats = (function() {
                var _stats = {};
                return function(stats) {
                    if (!Gitana.isUndefined(stats)) { _stats = stats; }
                    return _stats;
                };
            })();

            this.__is_association = (function() {
                var _is_association = false;
                return function(is_association) {
                    if (!Gitana.isUndefined(is_association)) { _is_association = is_association; }
                    return _is_association;
                };
            })();

            // now call base
            // important this happens AFTER helpers above so that handleSystemProperties works
            this.base(branch.getPlatform(), object);


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            /**
             * Gets the Gitana Repository object.
             *
             * @inner
             *
             * @returns {Gitana.Repository} The Gitana Repository object
             */
            this.getRepository = function() { return branch.getRepository(); };

            /**
             * Gets the Gitana Repository id.
             *
             * @inner
             *
             * @returns {String} The Gitana Repository id
             */
            this.getRepositoryId = function() { return branch.getRepository().getId(); };

            /**
             * Gets the Gitana Branch object.
             *
             * @inner
             *
             * @returns {Gitana.Branch} The Gitana Branch object
             */
            this.getBranch = function() { return branch; };

            /**
             * Gets the Gitana Branch id.
             *
             * @inner
             *
             * @returns {String} The Gitana Branch id
             */
            this.getBranchId = function() { return branch.getId(); };
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/repositories/" + this.getRepositoryId() + "/branches/" + this.getBranchId() + "/nodes/" + this.getId();
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().node(this.getBranch(), this);
        },

        /**
         * @override
         */
        handleSystemProperties: function(response)
        {
            this.base(response);

            // strip out "_qname"
            if (this["_qname"])
            {
                var _qname = this["_qname"];
                delete this["_qname"];
                this.__qname(_qname);
            }

            // strip out "_type"
            if (this["_type"])
            {
                var _type = this["_type"];
                delete this["_type"];
                this.__type(_type);
            }

            // strip out "_features"
            if (this["_features"])
            {
                var _features = this["_features"];
                delete this["_features"];
                this.__features(_features);
            }

            // strip out "_statistics"
            if (this["_statistics"] && typeof(this["_statistics"]) == "object")
            {
                var stats = this["_statistics"];
                delete this["_statistics"];
                this.__stats(stats);
            }

            // strip out "_is_association"
            if (!Gitana.isUndefined(this["_is_association"]))
            {
                var _is_association = this["_is_association"];
                delete this["_is_association"];
                this.__is_association(_is_association);
            }
        },

        /**
         * Override to include:
         *
         *   __qname
         *   __type
         *   __features
         *   __stats
         *   __is_association
         *
         * @param otherObject
         */
        chainCopyState: function(otherObject)
        {
            this.base(otherObject);

            if (otherObject.__qname) {
                this.__qname(otherObject.__qname());
            }
            if (otherObject.__type) {
                this.__type(otherObject.__type());
            }
            if (otherObject.__features) {
                this.__features(otherObject.__features());
            }
            if (otherObject.__stats) {
                this.__stats(otherObject.__stats());
            }
            if (otherObject.__is_association) {
                this.__is_association(otherObject.__is_association());
            }
        },

        /**
         * Hands back the stats.
         */
        stats: function()
        {
            return this.__stats();
        },


        ///////////////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // FEATURES
        //
        ///////////////////////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Hands back a list of the feature ids that this node has.
         *
         * @public
         *
         * @param [Function] callback optional callback
         *
         * @returns {Array} An array of strings that are the ids of the features.
         */
        getFeatureIds: function(callback)
        {
            var self = this;

            var f = function()
            {
                var featureIds = [];
                for (var featureId in this.__features()) {
                    featureIds[featureIds.length] = featureId;
                }

                return featureIds;
            };

            if (callback)
            {

                return this.then(function() {
                    callback.call(this, f.call(self));
                });
            }

            return f.call(self);
        },

        /**
         * Gets the configuration for a given feature.
         *
         * @public
         *
         * @param {String} featureId the id of the feature
         * @param [Function] callback optional callback
         *
         * @returns {Object} the JSON object configuration for the feature
         */
        getFeature: function(featureId, callback)
        {
            var self = this;

            if (callback)
            {
                return this.then(function() {
                    callback.call(this, self.__features()[featureId]);
                });
            }

            return self.__features()[featureId];
        },

        /**
         * Removes a feature from this node.
         *
         * @public
         *
         * @param {String} featureId the id of the feature
         */
        removeFeature: function(featureId)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/features/" + featureId;
            };

            return this.chainDelete(this, uriFunction).reload().then(function() {
                self.loadFrom(this);
            });
        },

        /**
         * Adds a feature to this node.
         *
         * @public
         * @param {String} featureId the id of the feature
         * @param [Object] featureConfig the JSON object configuration for the feature
         */
        addFeature: function(featureId, featureConfig)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/features/" + featureId;
            };

            if (!featureConfig) {
                featureConfig = {};
            }

            return this.chainPostEmpty(null, uriFunction, {}, featureConfig).reload().then(function() {
                self.loadFrom(this);
            });
        },

        /**
         * Indicates whether this node has the given feature.
         *
         * @public
         *
         * @param {String} featureId the id of the feature
         * @param [Function] callback optional callback to receive result (for chaining)
         *
         * @returns {Boolean} whether this node has this feature
         */
        hasFeature: function(featureId, callback)
        {
            if (callback)
            {
                return this.then(function() {

                    var hasFeature = !Gitana.isEmpty(this.__features()[featureId]);

                    callback.call(this, hasFeature);
                });
            }

            return !Gitana.isEmpty(this.__features()[featureId]);
        },

        /**
         * Indicates whether the current object is an association.
         *
         * @public
         *
         * @returns {Boolean} whether this node is an association
         */
        isAssociation: function()
        {
            return this.__is_association();
        },

        /**
         * Indicates whether this node has the "f:container" feature
         *
         * @public
         *
         * @returns {Boolean} whether this node has the "f:container" feature
         */
        isContainer: function()
        {
            return this.hasFeature("f:container");
        },

        /**
         * Touches the node.  This allows the node to reindex and regenerate any renditions it may
         * have associated with it.
         *
         * @public
         *
         * @chained node (this)
         */
        touch: function()
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/touch";
            };

            return this.chainPost(null, uriFunction);
        },


        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // TYPE
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Gets the type QName for this node.
         *
         * @public
         *
         * @returns {String} the type qname of this node.
         */
        getTypeQName: function()
        {
            return this.__type();
        },

        /**
         * Changes the type QName for this node.
         *
         * @public
         * @param {String} typeQName the qname of the type to change to
         */
        changeTypeQName: function(typeQName)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/change_type?type=" + typeQName;
            };

            return this.chainPostEmpty(null, uriFunction).reload().then(function() {
                self.loadFrom(this);
            });
        },




        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // QNAME
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Gets the QName for this node.
         *
         * @public
         *
         * @returns {String} the qname of this node.
         */
        getQName: function()
        {
            return this.__qname();
        },

        /**
         * Sets the QName of this node.
         *
         * @public
         * @param {String} typeQName the qname of the type to change to
         */
        changeQName: function(qname)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/change_qname?qname=" + qname;
            };

            return this.chainPostEmpty(null, uriFunction).reload().then(function() {
                self.loadFrom(this);
            });
        },


        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // ATTACHMENTS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists the attachments of this node.
         *
         * If local is set to true, the attachments are drawn from precached values on the node.
         *
         * @chained attachment map
         *
         * @param local
         *
         * @public
         */
        listAttachments: Gitana.Methods.listAttachments(Gitana.NodeAttachmentMap),

        /**
         * Picks off a single attachment
         *
         * @chained attachment
         *
         * @param attachmentId (null for default)
         */
        attachment: function(attachmentId)
        {
            return this.listAttachments().select(attachmentId);
        },

        /**
         * Non-chained method for getting a download URI for this node's attachment.
         */
        attachmentDownloadUri: function(attachmentId)
        {
            return this.getDriver().baseURL + this.getUri() + "/attachments/" + attachmentId;
        },

        /**
         * Creates an attachment.
         *
         * When using this method from within the JS driver, it really only works for text-based content such
         * as JSON or text.
         *
         * @chained attachment
         *
         * @param attachmentId (use null or false for default attachment)
         * @param contentType
         * @param data
         * @param filename
         */
        attach: function(attachmentId, contentType, data, filename)
        {
            var paramsFunction = function(params) {
                if (filename) { params["filename"] = filename; }
            };

            var delegate = Gitana.Methods.attach.call(this, Gitana.NodeAttachment, paramsFunction);
            return delegate.call(this, attachmentId, contentType, data);
        },

        /**
         * Generates a URI to a preview resource.
         */
        getPreviewUri: Gitana.Methods.getPreviewUri(),


        /**
         * Deletes an attachment.
         *
         * @param attachmentId
         */
        unattach: Gitana.Methods.unattach()

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;

    /**
     * Node attachments are similar to binary attachments.  They're identical in structure except that they
     * additionally provide information about the original filename.
     */
    Gitana.NodeAttachment = Gitana.BinaryAttachment.extend(
    /** @lends Gitana.NodeAttachment.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.BinaryAttachment
         *
         * @class Binary Attachment
         *
         * @param {Object} persistable gitana object
         * @param {Object} attachment
         */
        constructor: function(persistable, attachment)
        {
            this.base(persistable, attachment);
        },

        /**
         * Gets attachment file name
         * @returns {String} attachment file name
         */
        getFilename: function()
        {
            return this.filename;
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.NodeAttachmentMap = Gitana.BinaryAttachmentMap.extend(
    /** @lends Gitana.NodeAttachmentMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.BinaryAttachmentMap
         *
         * @class Provides access to node attachments
         *
         * @param repository
         * @param map
         */
        constructor: function(persistable, object)
        {
            this.base(persistable, object);

            this.objectType = function() { return "Gitana.NodeAttachmentMap"; };
        },

        /**
         * @override
         */
        clone: function()
        {
            return new Gitana.NodeAttachmentMap(this.__persistable(), this);
        },

        /**
         * @param json
         */
        buildObject: function(attachment)
        {
            return new Gitana.NodeAttachment(this.__persistable(), attachment);
        }


    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;

    Gitana.Association = Gitana.AbstractNode.extend(
    /** @lends Gitana.Association.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractNode
         *
         * @class Association
         *
         * @param {Gitana.Branch} branch
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(branch, object)
        {
            this.base(branch, object);

            this.objectType = function() { return "Gitana.Association"; };
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_ASSOCIATION;
        },

        /**
         * @override
         */
        isAssociation: function()
        {
            return true;
        },

        /**
         * @returns {String} the directionality of the association
         */
        getDirectionality: function()
        {
            return this.get("directionality");
        },

        /**
         * Gets the source node id for this association.
         *
         * @public
         *
         * @returns {String} source node id
         */
        getSourceNodeId: function()
        {
            return this.get("source");
        },

        /**
         * Gets the source node changeset id for this association.
         *
         * @public
         *
         * @returns {String} source node changeset id
         */
        getSourceNodeChangesetId: function()
        {
            return this.get("source_changeset");
        },

        /**
         * Gets the source node type for this association.
         *
         * @public
         *
         * @returns {String} source node type qname
         */
        getSourceNodeType: function()
        {
            return this.get("source_type");
        },

        /**
         * Gets the target node id for this association.
         *
         * @public
         *
         * @returns {String} target node id
         */
        getTargetNodeId: function()
        {
            return this.get("target");
        },

        /**
         * Gets the target node changeset id for this association.
         *
         * @public
         *
         * @returns {String} target node changeset id
         */
        getTargetNodeChangesetId: function()
        {
            return this.get("target_changeset");
        },

        /**
         * Gets the target node type for this association.
         *
         * @public
         *
         * @returns {String} target node type qname
         */
        getTargetNodeType: function()
        {
            return this.get("target_type");
        },

        /**
         * Reads the source node.
         *
         * @chained source node
         *
         * @public
         */
        readSourceNode: function()
        {
            var self = this;

            var result = this.subchain(this.getFactory().node(this.getBranch()));
            return result.then(function() {

                var chain = this;

                this.subchain(self.getBranch()).readNode(self.getSourceNodeId()).then(function() {
                    chain.loadFrom(this);
                });
            });
        },

        /**
         * Reads the target node.
         *
         * @chained target node
         *
         * @public
         */
        readTargetNode: function()
        {
            var self = this;

            var result = this.subchain(this.getFactory().node(this.getBranch()));
            return result.then(function() {

                var chain = this;

                this.subchain(self.getBranch()).readNode(self.getTargetNodeId()).then(function() {
                    chain.loadFrom(this);
                });
            });
        },

        /**
         * Given a node, reads back the other node of the association.
         *
         * @param {Object} node either a Gitana.Node or a string with the node id
         *
         * @chained other node
         *
         * @param node
         */
        readOtherNode: function(node)
        {
            var self = this;

            var nodeId = null;

            if (Gitana.isString(node))
            {
                nodeId = node;
            }
            else
            {
                nodeId = node.getId();
            }

            var result = this.subchain(this.getFactory().node(this.getBranch()));
            result.then(function() {

                var chain = this;

                this.subchain(self).then(function() {

                    if (nodeId == this.getSourceNodeId())
                    {
                        this.readTargetNode().then(function() {
                            chain.loadFrom(this);
                        });
                    }
                    else if (nodeId == this.getTargetNodeId())
                    {
                        this.readSourceNode().then(function() {
                            chain.loadFrom(this);
                        });
                    }
                    else
                    {
                        var err = new Gitana.Error();
                        err.name = "No node on association";
                        err.message = "The node: " + nodeId + " was not found on this association";

                        this.error(err);

                        return false;
                    }
                });
            });

            return result;
        },

        /**
         * NOTE: this is not a chained function
         *
         * Given a node, determines what direction this association describes.
         *
         * If the association's directionality is UNDIRECTED, the direction is MUTUAL.
         *
         * If the association's directionality is DIRECTED...
         *   If the node is the source, the direction is OUTGOING.
         *   If the node is the target, the direction is INCOMING.
         *
         * @param {Object} node either a Gitana.Node or a string with the node id
         *
         * @returns {String} the direction or null if the node isn't on the association
         */
        getDirection: function(node)
        {
            var nodeId = null;

            if (Gitana.isString(node))
            {
                nodeId = node;
            }
            else
            {
                nodeId = node.getId();
            }

            var direction = null;

            if (this.getDirectionality() == "UNDIRECTED")
            {
                direction = "MUTUAL";
            }
            else
            {
                if (this.getSourceNodeId() == nodeId)
                {
                    direction = "OUTGOING";
                }
                else if (this.getTargetNodeId() == nodeId)
                {
                    direction = "INCOMING";
                }
            }

            return direction;
        },

        /**
         * NOTE: this is not a chained function.
         *
         * Determines the node id of the other node.
         *
         * @param {Object} node either a Gitana.Node or a string with the node id
         *
         * @returns {String} the id of the other node
         */
        getOtherNodeId: function(node)
        {
            var nodeId = null;

            if (Gitana.isString(node))
            {
                nodeId = node;
            }
            else
            {
                nodeId = node.getId();
            }

            var otherNodeId = null;

            if (this.getSourceNodeId() == nodeId)
            {
                otherNodeId = this.getTargetNodeId();
            }
            else if (this.getTargetNodeId() == nodeId)
            {
                otherNodeId = this.getSourceNodeId();
            }

            return otherNodeId;
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;

    Gitana.Branch = Gitana.AbstractPlatformObject.extend(
    /** @lends Gitana.Branch.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObject
         *
         * @class Branch
         *
         * @param {Gitana.Repository} repository
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(repository, object)
        {
            this.base(repository.getPlatform(), object);

            this.objectType = function() { return "Gitana.Branch"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            /**
             * Gets the Gitana Repository object.
             *
             * @inner
             *
             * @returns {Gitana.Repository} The Gitana Repository object
             */
            this.getRepository = function() { return repository; };

            /**
             * Gets the Gitana Repository id.
             *
             * @inner
             *
             * @returns {String} The Gitana Repository id
             */
            this.getRepositoryId = function() { return repository.getId(); };
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_BRANCH;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/repositories/" + this.getRepositoryId() + "/branches/" + this.getId();
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().branch(this.getRepository(), this);
        },

        /**
         * @override
         */
        del: function()
        {
            // TODO - not implemented for branches
            return this;
        },


        /**
         * @returns {Boolean} whether this is the master branch
         */
        isMaster: function()
        {
            return (this.getBranchType().toLowerCase() == "master");
        },

        /**
         * @return {String} the type of branch ("master" or "custom")
         */
        getBranchType: function()
        {
            return this.get("type");
        },

        /**
         * @return {String} the tip changeset of the branch
         */
        getTip: function()
        {
            return this.get("tip");
        },

        /**
         * Acquires a list of mount nodes under the root of the repository.
         *
         * @chained node map
         *
         * @public
         *
         * @param [Object] pagination
         */
        listMounts: function(pagination)
        {
            var self = this;

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return self.getUri() + "/nodes";
            };

            var chainable = this.getFactory().nodeMap(this);
            return this.chainGet(chainable, uriFunction, params);
        },

        /**
         * Reads a node.
         *
         * @chained node
         *
         * @public
         *
         * @param {String} nodeId the node id
         * @param [String] offset path
         */
        readNode: function(nodeId, path)
        {
            var self = this;

            var uriFunction = function()
            {
                var uri = self.getUri() + "/nodes/" + nodeId;
                if (path) {
                    uri += "?path=" + path;
                }

                return uri;
            };

            var chainable = this.getFactory().node(this);
            return this.chainGet(chainable, uriFunction);
        },

        /**
         * Reads the root node.
         *
         * @chained node
         *
         * @public
         */
        rootNode: function()
        {
            return this.readNode("root");
        },

        /**
         * Create a node
         *
         * @chained node
         *
         * @public
         *
         * @param [Object] object JSON object
         * @param [Object|String] options a JSON object providing the configuration for the create operation.
         *                                If a string, must follow format (<rootNode>/<filePath>)
         */
        createNode: function(object, options)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/nodes";
            };

            var params = {};

            if (options)
            {
                var rootNodeId = "root"; // default
                var associationType = "a:child"; // default
                var filePath = null;
                var parentFolderPath = null;
                var fileName = null;

                // if they pass in a string instead of an options object, then the string can follow the format
                // (/root/pages/file.txt) where root is the root node to start from
                if (typeof(options) === "string")
                {
                    var rootPrefixedFilePath = options;

                    // filePath should not start with "/"
                    if (Gitana.startsWith(rootPrefixedFilePath, "/")) {
                        rootPrefixedFilePath = rootPrefixedFilePath.substring(1);
                    }

                    if (rootPrefixedFilePath == "") {
                        filePath = "/";
                    } else {
                        var i = rootPrefixedFilePath.indexOf("/");
                        rootNodeId = rootPrefixedFilePath.substring(0, i);
                        filePath = rootPrefixedFilePath.substring(i + 1);
                    }
                }
                else if (typeof(options) === "object")
                {
                    if (options.rootNodeId) {
                        rootNodeId = options.rootNodeId;
                    }
                    if (options.associationType) {
                        associationType = options.associationType;
                    }
                    if (options.fileName) {
                        fileName = options.fileName;
                    }
                    else if (options.filename) {
                        fileName = options.filename;
                    }
                    if (options.parentFolderPath) {
                        parentFolderPath = options.parentFolderPath;
                    }
                    else if (options.folderPath) {
                        parentFolderPath = options.folderPath;
                    }
                    else if (options.folderpath) {
                        parentFolderPath = options.folderpath;
                    }
                    if (options.filePath) {
                        filePath = options.filePath;
                    }
                    else if (options.filepath) {
                        filePath = options.filepath;
                    }
                }

                // plug in the resolved params
                if (rootNodeId) {
                    params.rootNodeId = rootNodeId;
                }
                if (associationType) {
                    params.associationType = associationType;
                }
                if (fileName) {
                    params.fileName = fileName;
                }
                if (filePath) {
                    params.filePath = filePath;
                }
                if (parentFolderPath) {
                    params.parentFolderPath = parentFolderPath;
                }
            }

            var chainable = this.getFactory().node(this);
            return this.chainCreate(chainable, object, uriFunction, params);
        },

        /**
         * Searches the branch.
         *
         * @chained node map
         *
         * Config should be:
         *
         *    {
         *       "search": {
         *           ... Elastic Search Config Block
         *       }
         *    }
         *
         * For a full text term search, you can simply provide text in place of a config json object.
         *
         * See the Elastic Search documentation for more advanced examples
         *
         * @public
         *
         * @param search
         * @param [Object] pagination
         */
        searchNodes: function(search, pagination)
        {
            var self = this;

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            if (Gitana.isString(search))
            {
                search = {
                    "search": search
                };
            }

            var uriFunction = function()
            {
                return self.getUri() + "/nodes/search";
            };

            var chainable = this.getFactory().nodeMap(this);
            return this.chainPost(chainable, uriFunction, params, search);
        },

        /**
         * Queries for nodes on the branch.
         *
         * Config should be:
         *
         *    {
         *       Gitana query configs
         *    }
         *
         * @chained node map
         *
         * @public
         *
         * @param {Object} query
         * @param [Object] pagination
         */
        queryNodes: function(query, pagination)
        {
            var self = this;

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return self.getUri() + "/nodes/query";
            };

            var chainable = this.getFactory().nodeMap(this);
            return this.chainPost(chainable, uriFunction, params, query);
        },

        /**
         * Queries for a single matching node to a query on the branch.
         *
         * @chained node
         *
         * @param query
         * @param errHandler
         *
         * @returns Gitana.Node
         */
        queryOne: function(query, errHandler)
        {
            return this.queryNodes(query).keepOne(function(err) {
                if (errHandler)
                {
                    errHandler(err);
                    return false;
                }
            });
        },

        /**
         * Performs a bulk check of permissions against permissioned objects of type node.
         *
         * Example of checks array:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>"
         * }]
         *
         * The callback receives an array of results, example:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>",
         *    "result": true
         * }]
         *
         * The order of elements in the array will be the same for checks and results.
         *
         * @param checks
         * @param callback
         */
        checkNodePermissions: function(checks, callback)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/nodes/permissions/check";
            };

            var object = {
                "checks": checks
            };

            return this.chainPostResponse(this, uriFunction, {}, object).then(function(response) {
                callback.call(this, response["results"]);
            });
        },


        /**
         * Reads the person object for a security user.
         *
         * @chained node
         *
         * @param {Object} user either the user id, user name or the user object
         * @param [Boolean] createIfNotFound whether to create the person object if it isn't found
         */
        readPersonNode: function(user, createIfNotFound)
        {
            var self = this;

            var principalDomainQualifiedId = this.extractPrincipalDomainQualifiedId(user);

            var uriFunction = function()
            {
                var uri = self.getUri() + "/person/acquire?id=" + principalDomainQualifiedId;
                if (createIfNotFound)
                {
                    uri += "&createIfNotFound=" + createIfNotFound;
                }

                return uri;
            };

            var chainable = this.getFactory().node(this, "n:person");
            return this.chainGet(chainable, uriFunction);
        },

        /**
         * Reads the group object for a security group.
         *
         * @chained node
         *
         * @param {Object} group eitehr the group id, group name or the group object
         * @param [Boolean] createIfNotFound whether to create the group object if it isn't found
         */
        readGroupNode: function(group, createIfNotFound)
        {
            var self = this;

            var principalDomainQualifiedId = this.extractPrincipalDomainQualifiedId(group);

            var uriFunction = function()
            {
                var uri = self.getUri() + "/group/acquire?id=" + principalDomainQualifiedId;
                if (createIfNotFound)
                {
                    uri += "&createIfNotFound=" + createIfNotFound;
                }

                return uri;
            };

            var chainable = this.getFactory().node(this, "n:group");
            return this.chainGet(chainable, uriFunction);
        },

        /**
         * Acquire a list of definitions.
         *
         * @chained node map
         *
         * @public
         *
         * @param [String] filter Optional filter of the kind of definition to fetch - "association", "type" or "feature"
         * @param [Object] pagination Optional pagination
         */
        listDefinitions: function(filter, pagination)
        {
            if (filter && typeof(filter) == "object")
            {
                pagination = filter;
                filter = null;
            }

            var self = this;

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                // uri
                var uri = self.getUri() + "/definitions";
                if (filter)
                {
                    uri = uri + "?filter=" + filter;
                }

                return uri;
            };

            var chainable = this.getFactory().nodeMap(this);
            return this.chainGet(chainable, uriFunction, params);
        },

        /**
         * Reads a definition by qname.
         *
         * @chained definition
         *
         * @public
         *
         * @param {String} qname the qname
         */
        readDefinition: function(qname)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/definitions/" + qname;
            };

            var chainable = this.getFactory().definition(this);
            return this.chainGet(chainable, uriFunction);
        },

        /**
         * Determines an available QName on this branch given some input.
         * This makes a call to the repository and asks it to provide a valid QName.
         *
         * The valid QName is passed as an argument to the next method in the chain.
         *
         * Note: This QName is a recommended QName that is valid at the time of the call.
         *
         * If another thread writes a node with the same QName after this call but ahead of this thread
         * attempting to commit, an invalid qname exception may still be thrown back.
         *
         * @chained this
         *
         * @public
         *
         * @param {Object} object an object with "title" or "description" fields to base generation upon
         */
        generateQName: function(object, callback)
        {
            var self = this;

            return this.then(function() {

                var chain = this;

                // call
                var uri = self.getUri() + "/qnames/generate";
                self.getDriver().gitanaPost(uri, null, object, function(response) {

                    var qname = response["_qname"];

                    callback.call(chain, qname);

                    chain.next();
                });

                // NOTE: we return false to tell the chain that we'll manually call next()
                return false;
            });
        },

        /**
         * Creates an association between the source node and the target node of the given type.
         *
         * @chained branch (this)
         *
         * @param sourceNode
         * @param targetNode
         * @param object (or string identifying type)
         */
        associate: function(sourceNode, targetNode, object)
        {
            // source
            var sourceNodeId = null;
            if (Gitana.isString(sourceNode))
            {
                sourceNodeId = sourceNode;
            }
            else
            {
                sourceNodeId = sourceNode.getId();
            }

            // target
            var targetNodeId = null;
            if (Gitana.isString(targetNode))
            {
                targetNodeId = targetNode;
            }
            else
            {
                targetNodeId = targetNode.getId();
            }

            // make sure we hand back the branch
            var result = this.subchain(this);

            // run a subchain to do the association
            result.subchain(this).then(function() {
                this.readNode(sourceNodeId).associate(targetNodeId, object);
            });

            return result;
        },

        /**
         * Traverses around the given node.
         *
         * Note: This is a helper function provided for convenience that delegates off to the node to do the work.
         *
         * @chained traversal results
         *
         * @param node or node id
         * @param config
         */
        traverse: function(node, config)
        {
            var nodeId = null;
            if (Gitana.isString(node))
            {
                nodeId = node;
            }
            else
            {
                nodeId = node.getId();
            }

            return this.readNode(nodeId).traverse(config);
        },

        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // CONTAINER (a:child) CONVENIENCE FUNCTIONS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Creates a container node.
         *
         * This is a convenience function that simply applies the container feature to the object
         * ahead of calling createNode.
         *
         * @chained node
         *
         * @public
         *
         * @param [Object] object JSON object
         */
        createContainer: function(object)
        {
            if (!object)
            {
                object = {};
            }

            if (!object["_features"])
            {
                object["_features"] = {};
            }

            object["_features"]["f:container"] = {
                "active": "true"
            };

            return this.createNode(object);
        },


        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // FIND
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Finds nodes within a branch
         *
         * @chained node map
         *
         * Config should be:
         *
         *    {
         *       "query": {
         *           ... Query Block
         *       },
         *       "search": {
         *           ... Elastic Search Config Block
         *       }
         *    }
         *
         * Alternatively, the value for "search" in the JSON block above can simply be text.
         *
         * @public
         *
         * @param {Object} config search configuration
         */
        find: function(config, pagination)
        {
            var self = this;

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return self.getUri() + "/nodes/find";
            };

            var chainable = this.getFactory().nodeMap(this);
            return this.chainPost(chainable, uriFunction, params, config);
        },

        /**
         * Another way to access the find() method that is more consistent with the API
         * that would be expected.
         *
         * @param config
         * @param pagination
         * @return {*}
         */
        findNodes: function(config, pagination)
        {
            return this.find(config, pagination);
        },


        ///////////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // NODE LIST
        //
        ///////////////////////////////////////////////////////////////////////////////////////////////////////


        /**
         * List the items in a node list.
         *
         * @chained node map
         *
         * @public
         *
         * @param {String} listKey
         * @param [Object] pagination
         */
        listItems: function(listKey, pagination)
        {
            var self = this;

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return self.getUri() + "/lists/" + listKey + "/items";
            };

            var chainable = this.getFactory().nodeMap(this);
            return this.chainGet(chainable, uriFunction, pagination);
        },

        /**
         * Queries for items in a node list.
         *
         * @chained node map
         *
         * @public
         *
         * @param {String} listKey
         * @param {Object} query
         * @param [Object] pagination
         */
        queryItems: function(listKey, query, pagination)
        {
            var self = this;

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return self.getUri() + "/lists/" + listKey + "/items/query";
            };

            var chainable = this.getFactory().nodeMap(this);
            return this.chainPost(chainable, uriFunction, params, query);
        },


        ///////////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // UTILITIES
        //
        ///////////////////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Loads all of the definitions, forms and key mappings on this branch.
         *
         * @param filter
         * @param callback
         */
        loadForms: function(filter, callback)
        {
            var self = this;

            return this.then(function() {

                var chain = this;

                // call
                var uri = self.getUri() + "/forms";
                if (filter) {
                    uri += "?filter=" + filter;
                }
                self.getDriver().gitanaGet(uri, null, {}, function(response) {

                    callback.call(chain, response);

                    chain.next();
                });

                // NOTE: we return false to tell the chain that we'll manually call next()
                return false;
            });
        },

        ///////////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // ADMIN
        //
        ///////////////////////////////////////////////////////////////////////////////////////////////////////

        adminRebuildPathIndexes: function()
        {
            var self = this;

            return this.then(function() {

                var chain = this;

                // call
                var uri = self.getUri() + "/admin/paths/index";
                self.getDriver().gitanaPost(uri, null, {}, function(response) {
                    chain.next();
                });

                // NOTE: we return false to tell the chain that we'll manually call next()
                return false;
            });
        },

        adminRebuildSearchIndexes: function()
        {
            var self = this;

            return this.then(function() {

                var chain = this;

                // call
                var uri = self.getUri() + "/admin/search/index";
                self.getDriver().gitanaPost(uri, null, {}, function(response) {
                    chain.next();
                });

                // NOTE: we return false to tell the chain that we'll manually call next()
                return false;
            });
        },

        adminContentMaintenance: function()
        {
            var self = this;

            return this.then(function() {

                var chain = this;

                // call
                var uri = self.getUri() + "/admin/content";
                self.getDriver().gitanaPost(uri, null, {}, function(response) {
                    chain.next();
                });

                // NOTE: we return false to tell the chain that we'll manually call next()
                return false;
            });
        },

        adminUpgradeSchema: function()
        {
            var self = this;

            return this.then(function() {

                var chain = this;

                // call
                var uri = self.getUri() + "/admin/upgradeschema";
                self.getDriver().gitanaPost(uri, null, {}, function(response) {
                    chain.next();
                });

                // NOTE: we return false to tell the chain that we'll manually call next()
                return false;
            });
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;

    Gitana.Changeset = Gitana.AbstractPlatformObject.extend(
    /** @lends Gitana.Changeset.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObject
         *
         * @class Changeset
         *
         * @param {Gitana.Repository} repository
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(repository, object)
        {
            this.base(repository.getPlatform(), object);

            this.objectType = function() { return "Gitana.Changeset"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            /**
             * Gets the Gitana Repository object.
             *
             * @inner
             *
             * @returns {Gitana.Repository} The Gitana Repository object
             */
            this.getRepository = function() { return repository; };

            /**
             * Gets the Gitana Repository id.
             *
             * @inner
             *
             * @returns {String} The Gitana Repository id
             */
            this.getRepositoryId = function() { return repository.getId(); };

            /**
             * Gets the Gitana Platform object.
             *
             * @inner
             *
             * @returns {Gitana.Platform} The Gitana Platform object
             */
            this.getPlatform = function() { return repository.getPlatform(); };
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_CHANGESET;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/repositories/" + this.getRepositoryId() + "/changesets/" + this.getId();
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().changeset(this.getRepository(), this);
        },

        /**
         * Lists the nodes on this changeset.
         *
         * @chained node map
         *
         * @param [Object] pagination optional pagination
         */
        listNodes: function(pagination)
        {
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return "/repositories/" + this.getRepositoryId() + "/changesets/" + this.getId() + "/nodes";
            };

            var chainable = this.getFactory().nodeMap(this);
            return this.chainGet(chainable, uriFunction, params);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;

    Gitana.Node = Gitana.AbstractNode.extend(
    /** @lends Gitana.Node.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractNode
         *
         * @class Node
         *
         * @param {Gitana.Branch} branch
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(branch, object)
        {
            this.base(branch, object);

            this.objectType = function() { return "Gitana.Node"; };
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_NODE;
        },

        /**
         * Acquires the "child nodes" of this node.  This is done by fetching all of the nodes that are outgoing-associated to this
         * node with a association of type "a:child".
         *
         * @chained node map
         *
         * @public
         *
         * @param [Object] pagination
         */
        listChildren: function(pagination)
        {
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return "/repositories/" + this.getRepositoryId() + "/branches/" + this.getBranchId() + "/nodes/" + this.getId() + "/children";
            };

            var chainable = this.getFactory().nodeMap(this.getBranch());
            return this.chainGet(chainable, uriFunction, params);
        },

        /**
         * Acquires the relatives of this node.
         *
         * @chained node map
         *
         * @public
         *
         * @param {Object} config
         * @param [Object] pagination
         */
        listRelatives: function(config, pagination)
        {
            var type = null;
            var direction = null;

            if (config)
            {
                type = config.type;
                if (config.direction)
                {
                    direction = config.direction.toUpperCase();
                }
            }

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                var url = "/repositories/" + this.getRepositoryId() + "/branches/" + this.getBranchId() + "/nodes/" + this.getId() + "/relatives";
                if (type)
                {
                    url = url + "?type=" + type;
                }
                if (direction)
                {
                    if (type)
                    {
                        url = url + "&direction=" + direction;
                    }
                    else
                    {
                        url = url + "?direction=" + direction;
                    }
                }
                return url;
            };

            var chainable = this.getFactory().nodeMap(this.getBranch());
            return this.chainGet(chainable, uriFunction, params);
        },

        /**
         * Queries for relatives of this node.
         *
         * @chained node map
         *
         * @public
         *
         * @param {Object} query
         * @param {Object} config
         * @param [Object] pagination
         */
        queryRelatives: function(query, config, pagination)
        {
            var type = null;
            var direction = null;

            if (config)
            {
                type = config.type;
                if (config.direction)
                {
                    direction = config.direction.toUpperCase();
                }
            }

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                var url = "/repositories/" + this.getRepositoryId() + "/branches/" + this.getBranchId() + "/nodes/" + this.getId() + "/relatives/query";
                if (type)
                {
                    url = url + "?type=" + type;
                }
                if (direction)
                {
                    if (type)
                    {
                        url = url + "&direction=" + direction;
                    }
                    else
                    {
                        url = url + "?direction=" + direction;
                    }
                }
                return url;
            };

            var chainable = this.getFactory().nodeMap(this.getBranch());
            return this.chainPost(chainable, uriFunction, params, query);
        },

        /**
         * Retrieves all of the association objects for this node.
         *
         * @chained node map
         *
         * @public
         *
         * @param [Object] config
         * @param [Object] pagination
         */
        associations: function(config, pagination)
        {
            var type = null;
            var direction = null;

            if (config)
            {
                type = config.type;
                if (config.direction)
                {
                    direction = config.direction.toUpperCase();
                }
            }

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                var url = "/repositories/" + this.getRepositoryId() + "/branches/" + this.getBranchId() + "/nodes/" + this.getId() + "/associations?a=1";
                if (type)
                {
                    url = url + "&type=" + type;
                }
                if (direction)
                {
                    url = url + "&direction=" + direction;
                }

                return url;
            };

            var chainable = this.getFactory().nodeMap(this.getBranch());
            return this.chainGet(chainable, uriFunction, params);
        },

        /**
         * Retrieves all of the incoming association objects for this node.
         *
         * @chained node map
         *
         * @public
         *
         * @param [String] type the type of association
         * @param [Object] pagination
         */
        incomingAssociations: function(type, pagination)
        {
            var config = {
                "direction": "INCOMING"
            };
            if (type) {
                config.type = type;
            }

            return this.associations(config, pagination);
        },

        /**
         * Retrieves all of the outgoing association objects for this node.
         *
         * @chained node map
         *
         * @public
         *
         * @param [String] type the type of association
         * @param [Object] pagination
         */
        outgoingAssociations: function(type, pagination)
        {
            var config = {
                "direction": "OUTGOING"
            };
            if (type) {
                config.type = type;
            }

            return this.associations(config, pagination);

        },

        /**
         * Associates a target node to this node.
         *
         * @chained this
         *
         * @public
         *
         * @param {String|Node} targetNode the id of the target node or the target node itself
         * @param [Object|String] object either a JSON object or a string identifying the type of association
         * @param [Boolean] undirected whether the association is undirected (i.e. mutual)
         */
        associate: function(targetNodeId, object, undirected)
        {
            if (!Gitana.isString(targetNodeId))
            {
                targetNodeId = targetNodeId.getId();
            }

            if (object)
            {
                if (Gitana.isString(object))
                {
                    object = {
                        "_type": object
                    };
                }
            }

            var uriFunction = function()
            {
                var url = "/repositories/" + this.getRepositoryId() + "/branches/" + this.getBranchId() + "/nodes/" + this.getId() + "/associate?node=" + targetNodeId;

                if (undirected)
                {
                    url += "&directionality=UNDIRECTED";
                }

                return url;
            };

            return this.chainPostEmpty(null, uriFunction, null, object);
        },

        /**
         * Creates an association from another node to this one.
         *
         * @chained node (this)
         *
         * @public
         *
         * @param sourceNode
         * @param object
         * @param undirected
         */
        associateOf: function(sourceNode, object, undirected)
        {
            var self = this;

            // what we're handing back (ourselves)
            var result = this.subchain(this);

            // our work
            result.subchain(sourceNode).then(function() {
                this.associate(self, object, undirected);
            });

            return result;
        },

        /**
         * Unassociates a target node from this node.
         *
         * @chained this
         *
         * @public
         *
         * @param {String|Node} targetNode the id of the target node or the target node itself
         * @param [String] type A string identifying the type of association
         * @param [Boolean] undirected whether the association is undirected (i.e. mutual)
         */
        unassociate: function(targetNodeId, type, undirected)
        {
            if (!Gitana.isString(targetNodeId))
            {
                targetNodeId = targetNodeId.getId();
            }

            var uriFunction = function()
            {
                var url = "/repositories/" + this.getRepositoryId() + "/branches/" + this.getBranchId() + "/nodes/" + this.getId() + "/unassociate?node=" + targetNodeId;

                if (type)
                {
                    url = url + "&type=" + type;
                }

                if (undirected)
                {
                    url += "&directionality=UNDIRECTED";
                }

                return url;
            };

            return this.chainPostEmpty(null, uriFunction);
        },

        /**
         * Traverses around the node and returns any nodes found to be connected on the graph.
         *
         * Example config:
         *
         * {
         *    "associations": {
         *       "a:child": "MUTUAL",
         *       "a:knows": "INCOMING",
         *       "a:related": "OUTGOING"
         *    },
         *    "depth": 1,
         *    "types": [ "custom:type1", "custom:type2" ]
         * } 
         *
         * @chained traversal results
         *
         * @public
         *
         * @param {Object} config configuration for the traversal
         */
        traverse: function(config)
        {
            // build the payload
            var payload = {
                "traverse": config
            };

            var uriFunction = function()
            {
                return "/repositories/" + this.getRepositoryId() + "/branches/" + this.getBranchId() + "/nodes/" + this.getId() + "/traverse";
            };

            var chainable = this.getFactory().traversalResults(this.getBranch());
            var params = {};
            return this.chainPost(chainable, uriFunction, params, payload);
        },

        /**
         * Mounts a node
         *
         * @chained this
         *
         * @public
         *
         * @param {String} mountKey the mount key
         */
        mount: function(mountKey)
        {
            var uriFunction = function()
            {
                return "/repositories/" + this.getRepositoryId() + "/branches/" + this.getBranchId() + "/nodes/" + this.getId() + "/mount/" + mountKey;
            };

            return this.chainPostEmpty(null, uriFunction, null, object);
        },

        /**
         * Unmounts a node
         *
         * @public
         */
        unmount: function()
        {
            var uriFunction = function()
            {
                return "/repositories/" + this.getRepositoryId() + "/branches/" + this.getBranchId() + "/nodes/" + this.getId() + "/unmount";
            };

            return this.chainPostEmpty(null, uriFunction, null, object);
        },

        /**
         * Locks a node
         *
         * @chained this
         *
         * @public
         */
        lock: function()
        {
            var uriFunction = function()
            {
                return "/repositories/" + this.getRepositoryId() + "/branches/" + this.getBranchId() + "/nodes/" + this.getId() + "/lock";
            };

            return this.chainPostEmpty(null, uriFunction);
        },

        /**
         * Unlocks a node
         *
         * @chained this
         *
         * @public
         */
        unlock: function()
        {
            var uriFunction = function()
            {
                return "/repositories/" + this.getRepositoryId() + "/branches/" + this.getBranchId() + "/nodes/" + this.getId() + "/unlock";
            };

            return this.chainPostEmpty(null, uriFunction);
        },

        /**
         * Checks whether the node is locked.
         * The result is passed into the next method in the chain.
         *
         * @chained this
         *
         * @public
         */
        checkLocked: function(callback)
        {
            // TODO: isn't this subchain() redundant?
            return this.subchain(this).then(function() {

                var chain = this;

                // call
                var uri = "/repositories/" + this.getRepositoryId() + "/branches/" + this.getBranchId() + "/nodes/" + this.getId() + "/lock";
                this.getDriver().gitanaGet(uri, null, {}, function(response) {

                    callback.call(chain, response["locked"]);

                    chain.next();
                });

                // NOTE: we return false to tell the chain that we'll manually call next()
                return false;
            });
        },


        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // ACL METHODS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Retrieve full ACL and pass into chaining method.
         *
         * @chained node
         */
        loadACL: function(callback)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/acl/list";
            };

            return this.chainGetResponse(this, uriFunction).then(function(response) {
                callback.call(this, response);
            });
        },

        /**
         * Retrieve list of authorities and pass into chaining method.
         *
         * @chained node
         *
         * @param {Gitana.Principal|String} principal the principal or the principal id
         */
        listAuthorities: function(principal)
        {
            var principalDomainQualifiedId = this.extractPrincipalDomainQualifiedId(principal);

            var uriFunction = function()
            {
                return "/repositories/" + this.getRepositoryId() + "/branches/" + this.getBranchId() + "/nodes/" + this.getId() + "/acl?id=" + principalDomainQualifiedId;
            };

            return this.chainGetResponseRows(this, uriFunction);
        },

        /**
         * Checks whether the given principal has a granted authority for this object.
         * This passes the result (true/false) to the chaining function.
         *
         * @chained this
         *
         * @param {Gitana.Principal|String} principal the principal or the principal id
         * @param {String} authorityId the id of the authority
         * @param callback
         */
        checkAuthority: function(principal, authorityId, callback)
        {
            var principalDomainQualifiedId = this.extractPrincipalDomainQualifiedId(principal);

            var uriFunction = function()
            {
                return "/repositories/" + this.getRepositoryId() + "/branches/" + this.getBranchId() + "/nodes/" + this.getId() + "/authorities/" + authorityId + "/check?id=" + principalDomainQualifiedId;
            };

            return this.chainPostResponse(this, uriFunction).then(function(response) {
                callback.call(this, response["check"]);
            });
        },

        /**
         * Grants an authority to a principal against this object.
         *
         * @chained this
         *
         * @param {Gitana.Principal|String} principal the principal or the principal id
         * @param {String} authorityId the id of the authority
         */
        grantAuthority: function(principal, authorityId)
        {
            var principalDomainQualifiedId = this.extractPrincipalDomainQualifiedId(principal);

            var uriFunction = function()
            {
                return "/repositories/" + this.getRepositoryId() + "/branches/" + this.getBranchId() + "/nodes/" + this.getId() + "/authorities/" + authorityId + "/grant?id=" + principalDomainQualifiedId;
            };

            return this.chainPostEmpty(null, uriFunction);
        },

        /**
         * Revokes an authority from a principal against this object.
         *
         * @chained this
         *
         * @param {Gitana.Principal|String} principal the principal or the principal id
         * @param {String} authorityId the id of the authority
         */
        revokeAuthority: function(principal, authorityId)
        {
            var principalDomainQualifiedId = this.extractPrincipalDomainQualifiedId(principal);

            var uriFunction = function()
            {
                return "/repositories/" + this.getRepositoryId() + "/branches/" + this.getBranchId() + "/nodes/" + this.getId() + "/authorities/" + authorityId + "/revoke?id=" + principalDomainQualifiedId;
            };

            return this.chainPostEmpty(null, uriFunction);
        },

        /**
         * Revokes all authorities for a principal against the server.
         *
         * @chained this
         *
         * @param {Gitana.Principal|String} principal the principal or the principal id
         */
        revokeAllAuthorities: function(principal)
        {
            return this.revokeAuthority(principal, "all");
        },

        /**
         * Loads the authority grants for a given set of principals.
         *
         * @chained repository
         *
         * @param callback
         */
        loadAuthorityGrants: function(principalIds, callback)
        {
            if (!principalIds)
            {
                principalIds = [];
            }

            var json = {
                "principals": principalIds
            };

            return this.chainPostResponse(this, "/repositories/" + this.getRepositoryId() + "/branches/" + this.getBranchId() + "/nodes/" + this.getId() + "/authorities", {}, json).then(function(response) {
                callback.call(this, response);
            });
        },

        /**
         * Checks whether the given principal has a permission against this object.
         * This passes the result (true/false) to the chaining function.
         *
         * @chained server
         *
         * @param {Gitana.Principal|String} principal the principal or the principal id
         * @param {String} permissionId the id of the permission
         * @param callback
         */
        checkPermission: function(principal, permissionId, callback)
        {
            var principalDomainQualifiedId = this.extractPrincipalDomainQualifiedId(principal);

            var uriFunction = function()
            {
                return "/repositories/" + this.getRepositoryId() + "/branches/" + this.getBranchId() + "/nodes/" + this.getId() + "/permissions/" + permissionId + "/check?id=" + principalDomainQualifiedId;
            };

            return this.chainPostResponse(this, uriFunction).then(function(response) {
                callback.call(this, response["check"]);
            });
        },



        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // END OF ACL METHODS
        //
        //////////////////////////////////////////////////////////////////////////////////////////


        /**
         * Acquire a list of audit records concerning this node.
         *
         * @chained audit record map
         *
         * @public
         *
         * @param [Object] pagination
         */
        listAuditRecords: function(pagination)
        {
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return "/repositories/" + this.getRepositoryId() + "/branches/" + this.getBranchId() + "/nodes/" + this.getId() + "/auditrecords";
            };

            var chainable = this.getFactory().auditRecordMap(this.getRepository());
            return this.chainGet(chainable, uriFunction, params);
        },

        /**
         * Creates a new translation.
         *
         * @chained translation node
         *
         * @param {String} edition the edition of the translation (can be any string)
         * @param {String} locale the locale string for the translation (i.e. "en_US")
         * @param [Object] object JSON object
         */
        createTranslation: function(edition, locale, object)
        {
            var uriFunction = function()
            {
                return "/repositories/" + this.getRepositoryId() + "/branches/" + this.getBranchId() + "/nodes/" + this.getId() + "/i18n?edition=" + edition + "&locale=" + locale;
            };

            var chainable = this.getFactory().node(this.getBranch());
            return this.chainCreateEx(chainable, object, uriFunction, uriFunction);
        },

        /**
         * Lists all of the editions for this master node.
         * Passes them into the next function in the chain.
         *
         * @chained this
         *
         * @param callback
         */
        editions: function(callback)
        {
            var uriFunction = function()
            {
                return "/repositories/" + this.getRepositoryId() + "/branches/" + this.getBranchId() + "/nodes/" + this.getId() + "/i18n/editions";
            };

            return this.chainGetResponse(this, uriFunction).then(function(response) {
                callback.call(this, response["editions"]);
            });
        },

        /**
         * Lists all of the locales for the given edition of this master node.
         * Passes them into the next function in the chain.
         *
         * @chained this
         *
         * @param {String} edition the edition
         * @param callback
         */
        locales: function(edition, callback)
        {
            var uriFunction = function()
            {
                return "/repositories/" + this.getRepositoryId() + "/branches/" + this.getBranchId() + "/nodes/" + this.getId() + "/i18n/locales?edition=" + edition;
            };

            return this.chainGetResponse(this, uriFunction).then(function(response) {
                callback.call(this, response["locales"]);
            });
        },

        /**
         * Reads a translation node of the current master node into a given locale and optional edition.
         * If an edition isn't provided, the tip edition from the master node is assumed.
         *
         * @chained translation node
         *
         * @param [String] edition The edition of the translation to use.  If not provided, the tip edition is used from the master node.
         * @param {String} locale The locale to translate into.
         */
        readTranslation: function()
        {
            var edition;
            var locale;

            var args = Gitana.makeArray(arguments);

            if (args.length == 1)
            {
                locale = args.shift();
            }
            else if (args.length > 1)
            {
                edition = args.shift();
                locale = args.shift();
            }

            var uriFunction = function()
            {
                var uri = "/repositories/" + this.getRepositoryId() + "/branches/" + this.getBranchId() + "/nodes/" + this.getId() + "/i18n?locale=" + locale;
                if (edition)
                {
                    uri += "&edition=" + edition;
                }

                return uri;
            };

            var chainable = this.getFactory().node(this.getBranch());
            return this.chainGet(chainable, uriFunction);
        },



        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // CONTAINER CONVENIENCE FUNCTIONS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Create a node as a child of this node.
         *
         * This is a convenience function around the branch createNode method.  It chains a create with a
         * childOf() call.
         *
         * @chained new node
         *
         * @public
         *
         * @param [Object] object JSON object
         */
        createChild: function(object)
        {
            var self = this;

            // we can't assume we know the branch get since we're chaining
            // so create a temporary branch that we'll load later

            var branch = new Gitana.Branch(this.getRepository());

            // we hand back a node and preload some work
            var chainable = this.getFactory().node(branch);
            return this.subchain(chainable).then(function() {

                var chain = this;

                // we now plug in branch and create child node
                this.subchain(self).then(function() {

                    // load branch
                    branch.loadFrom(this.getBranch());

                    // create child node
                    this.subchain(branch).createNode(object).then(function() {

                        chain.loadFrom(this);

                        this.childOf(self);
                    });

                });

            });

        },

        /**
         * Associates this node as an "a:child" of the source node.
         *
         * This is a convenience function that simply creates an association from another node to this one.
         *
         * @chained node (this)
         *
         * @public
         *
         * @param sourceNode
         */
        childOf: function(sourceNode)
        {
            return this.associateOf(sourceNode, "a:child");
        },


        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // FIND
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Finds around a node.
         *
         * @chained node map
         *
         * Config should be:
         *
         *    {
         *       "query": {
         *           ... Query Block
         *       },
         *       "search": {
         *           ... Elastic Search Config Block
         *       },
         *       "traverse: {
         *           ... Traversal Configuration
         *       }
         *    }
         *
         * Alternatively, the value for "search" in the JSON block above can simply be text.
         *
         * @public
         *
         * @param {Object} config search configuration
         */
        find: function(config, pagination)
        {
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return "/repositories/" + this.getRepositoryId() + "/branches/" + this.getBranchId() + "/nodes/" + this.getId() + "/find";
            };

            var chainable = this.getFactory().nodeMap(this.getBranch());
            return this.chainPost(chainable, uriFunction, params, config);
        },

        /**
         * Retrieves a tree structure for nested folders starting at this node (as the root).
         *
         * @chained node
         *
         * @public
         *
         * @param [Object] config - { "leafPath": "<leafPath>", "basePath": "<basePath>", "containers": true }
         * @param callback the callback function to be passed the resulting tree object structure
         */
        loadTree: function(config, callback)
        {
            var self = this;

            if (typeof(config) === "function")
            {
                callback = config;
                config = null;
            }

            if (!config)
            {
                config = {};
            }

            var uriFunction = function()
            {
                return self.getUri() + "/tree";
            };

            var params = {};
            if (config.leafPath)
            {
                params["leaf"] = config.leafPath;
            }
            if (config.basePath)
            {
                params["base"] = config.basePath;
            }
            if (config.containers)
            {
                params["containers"] = true;
            }

            return this.chainGetResponse(this, uriFunction, params).then(function(response) {
                callback.call(this, response);
            });
        },

        /**
         * Resolves the path to this node relative to the given root node.
         *
         * @param rootNodeId
         * @param callback
         * @returns {*}
         */
        resolvePath: function(rootNodeId, callback)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/path";
            };

            var params = {
                "rootNodeId": rootNodeId
            };

            return this.chainGetResponse(this, uriFunction, params).then(function(response) {
                callback.call(this, response.path);
            });

        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.BranchMap = Gitana.AbstractPlatformObjectMap.extend(
    /** @lends Gitana.BranchMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObjectMap
         *
         * @class Map of branch objects
         *
         * @param {Gitana.Repository} repository
         * @param [Object] object
         */
        constructor: function(repository, object)
        {
            this.objectType = function() { return "Gitana.BranchMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            /**
             * Gets the Gitana Repository object.
             *
             * @inner
             *
             * @returns {Gitana.Repository} The Gitana Repository object
             */
            this.getRepository = function() { return repository; };

            /**
             * Gets the Gitana Repository id.
             *
             * @inner
             *
             * @returns {String} The Gitana Repository id
             */
            this.getRepositoryId = function() { return repository.getId(); };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(repository.getPlatform(), object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().branchMap(this.getRepository(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().branch(this.getRepository(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.ChangesetMap = Gitana.AbstractPlatformObjectMap.extend(
    /** @lends Gitana.ChangesetMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObjectMap
         *
         * @class Map of changeset objects
         *
         * @param {Gitana.Server} server Gitana server instance.
         * @param [Object] object
         */
        constructor: function(repository, object)
        {
            this.objectType = function() { return "Gitana.ChangesetMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            /**
             * Gets the Gitana Repository object.
             *
             * @inner
             *
             * @returns {Gitana.Repository} The Gitana Repository object
             */
            this.getRepository = function() { return repository; };

            /**
             * Gets the Gitana Repository id.
             *
             * @inner
             *
             * @returns {String} The Gitana Repository id
             */
            this.getRepositoryId = function() { return repository.getId(); };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(repository.getPlatform(), object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().changesetMap(this.getRepository(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().changeset(this.getRepository(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.NodeMap = Gitana.AbstractPlatformObjectMap.extend(
    /** @lends Gitana.NodeMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObjectMap
         *
         * @class Map of node objects
         *
         * @param {Gitana.Branch} branch Gitana branch instance.
         * @param [Object] object
         */
        constructor: function(branch, object)
        {
            this.objectType = function() { return "Gitana.NodeMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            /**
             * Gets the Gitana Repository object.
             *
             * @inner
             *
             * @returns {Gitana.Repository} The Gitana Repository object
             */
            this.getRepository = function() { return branch.getRepository(); };

            /**
             * Gets the Gitana Repository id.
             *
             * @inner
             *
             * @returns {String} The Gitana Repository id
             */
            this.getRepositoryId = function() { return branch.getRepository().getId(); };

            /**
             * Gets the Gitana Branch object.
             *
             * @inner
             *
             * @returns {Gitana.Branch} The Gitana Branch object
             */
            this.getBranch = function() { return branch; };

            /**
             * Gets the Gitana Branch id.
             *
             * @inner
             *
             * @returns {String} The Gitana Branch id
             */
            this.getBranchId = function() { return branch.getId(); };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(branch.getPlatform(), object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().nodeMap(this.getBranch(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().node(this.getBranch(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.TraversalResults = Gitana.AbstractPersistable.extend(
    /** @lends Gitana.TraversalResults.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPersistable
         *
         * @class Provides access to traversal results
         *
         * @param {Gitana.Branch} branch
         * @param [Object] object
         */
        constructor: function(branch, object)
        {
            if (!this._nodes)
            {
                this._nodes = {};
            }
            if (!this._associations)
            {
                this._associations = {};
            }
            if (!this._config)
            {
                this._config = {};
            }

            this.base(branch.getDriver(), object);


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            /**
             * Gets the Gitana Repository object.
             *
             * @inner
             *
             * @returns {Gitana.Repository} The Gitana Repository object
             */
            this.getRepository = function() { return branch.getRepository(); };

            /**
             * Gets the Gitana Repository id.
             *
             * @inner
             *
             * @returns {String} The Gitana Repository id
             */
            this.getRepositoryId = function() { return branch.getRepository().getId(); };

            /**
             * Gets the Gitana Branch object.
             *
             * @inner
             *
             * @returns {Gitana.Branch} The Gitana Branch object
             */
            this.getBranch = function() { return branch; };

            /**
             * Gets the Gitana Branch id.
             *
             * @inner
             *
             * @returns {String} The Gitana Branch id
             */
            this.getBranchId = function() { return branch.getId(); };
        },

        clear: function()
        {
            // empty the nodes map
            Gitana.deleteProperties(this._nodes, true);

            // empty the associations map
            Gitana.deleteProperties(this._associations, true);

            // empty the config map
            Gitana.deleteProperties(this._config, true);
        },

        /**
         * @override
         *
         * @param response
         */
        handleResponse: function(response)
        {
            this.clear();

            this.handleSystemProperties(response);

            // copy nodes and associations map values
            Gitana.copyInto(this._nodes, response.nodes);
            Gitana.copyInto(this._associations, response.associations);

            // copy config
            Gitana.copyInto(this._config, response.config);

            // copy center node information
            this._config["center"] = response.node;
        },

        /**
         * Looks up the node around which this traversal is centered.
         */
        center: function()
        {
            var chainable = this.getFactory().node(this.getBranch());

            var result = this.subchain(chainable);

            // push our logic to the front
            result.subchain(this.getBranch()).readNode(this._config["center"]).then(function() {
                result.handleResponse(this);
            });

            return result;
        },

        /**
         * Counts the number of nodes in the traversal results
         *
         * @param callback
         */
        nodeCount: function(callback)
        {
            return this.then(function() {
                callback.call(this, Gitana.getNumberOfKeys(this._nodes));
            });
        },

        /**
         * Counts the number of associations in teh traversal results
         *
         * @param callback
         */
        associationCount: function(callback)
        {
            return this.then(function() {
                callback.call(this, Gitana.getNumberOfKeys(this._associations));
            });
        },

        /**
         * Hands back a map of all of the nodes in the traversal results
         *
         * @chained node map
         */
        nodes: function()
        {
            var self = this;

            // what we're handing back
            var result = this.subchain(this.getFactory().nodeMap(this.getBranch()));

            // preload some work and hand back
            return result.then(function() {

                var chain = this;

                var response = {
                    "rows": self._nodes
                };

                chain.handleResponse(response);
            });
        },

        /**
         * Hands back a single node
         *
         * @chained node
         *
         * @param nodeId
         */
        node: function(id)
        {
            var self = this;

            // hand back a node but preload with work
            var result = this.subchain(this.getFactory().node(this.getBranch()));
            return result.then(function() {

                var nodeObject = self._nodes[id];
                if (!nodeObject) {
                    return self.missingNodeError(id);
                }

                this.handleResponse(nodeObject);
            });
        },

        /**
         * Hands back a map of all of the associations in the traversal results
         *
         * @chained node map
         */
        associations: function()
        {
            var self = this;

            // what we're handing back
            var result = this.subchain(this.getFactory().nodeMap(this.getBranch()));

            // preload some work and hand back
            return result.then(function() {

                var chain = this;

                var response = {
                    "rows": self._associations
                };

                chain.handleResponse(response);
            });
        },

        /**
         * Hands back a single association.
         *
         * @chained association
         *
         * @param id
         */
        association: function(id)
        {
            var self = this;

            // hand back a node but preload with work
            var result = this.subchain(this.getFactory().association(this.getBranch()));
            return result.then(function() {

                var associationObject = self._associations[id];
                if (!associationObject) {
                    return self.missingNodeError(id);
                }

                this.handleResponse(associationObject);
            });
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;

    Gitana.Definition = Gitana.Node.extend(
    /** @lends Gitana.Definition.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.Node
         *
         * @class Definition
         *
         * @param {Gitana.Branch} branch
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(branch, object)
        {
            this.base(branch, object);

            this.objectType = function() { return "Gitana.Definition"; };
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().definition(this.getBranch(), this);
        },

        /**
         * Acquires a list of associations of type "a:has_form" for this definition.
         *
         * @chaining node map
         *
         * @public
         */
        listFormAssociations: function()
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/forms";
            };

            var chainable = this.getFactory().nodeMap(this.getBranch());
            return this.chainGet(chainable, uriFunction);
        },

        /**
         * Reads a form by form key that is associated to this definition.
         *
         * @public
         *
         * @param {String} formKey the form key
         */
        readForm: function(formKey)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/forms/" + formKey;
            };

            var chainable = this.getFactory().form(this.getBranch());
            return this.chainGet(chainable, uriFunction);
        },

        /**
         * Creates a form and associates it to this definition.
         *
         * @public
         *
         * @param {String} formKey the form key
         * @param [Object] object the object that constitutes the form
         * @param [String] formPath optional formPath to pass to create node
         */
        createForm: function(formKey, formObject, formPath)
        {
            var self = this;

            if (typeof(formObject) === "string")
            {
                formPath = formObject;
                formObject = null;
            }

            // set up form object
            if (!formObject)
            {
                formObject = {};
            }
            formObject["_type"] = "n:form";

            var chainable = this.getFactory().form(this.getBranch());

            // subchain that want to hand back
            var result = this.subchain(chainable);

            // now push our logic into a subchain that is the first thing in the result
            result.subchain(this.getBranch()).createNode(formObject, formPath).then(function() {
                var formNode = this;

                // switch to definition node
                this.subchain(self).then(function() {
                    var associationObject = {
                        "_type": "a:has_form",
                        "form-key": formKey
                    };
                    this.associate(formNode, associationObject).then(function() {

                        var association = this;

                        // read back into the form chainable
                        var uri = "/repositories/" + formNode.getRepositoryId() + "/branches/" + formNode.getBranchId() + "/nodes/" + formNode.getId();
                        this.getDriver().gitanaGet(uri, null, {}, function(response) {

                            result.handleResponse(response);
                            association.next();
                        });

                        // we manually signal when this then() is done
                        return false;
                    });
                });
            });

            return result;
        },

        /**
         * Convenience function to remove a form linked to this definition.
         * Note: This doesn't delete the form, it simply unlinks the association.
         *
         * @chained this
         *
         * @public
         *
         * @param {String} formKey the form key
         */
        removeFormAssociation: function(formKey)
        {
            return this.link(this).then(function() {

                var association = null;

                this.listFormAssociations().each(function() {
                    if (this.getFormKey() == formKey)
                    {
                        association = this;
                    }
                }).then(function() {
                    if (association)
                    {
                        this.subchain(association).del();
                    }
                });
            });
        }
    });

    Gitana.ObjectFactory.register("d:type", Gitana.Definition);
    Gitana.ObjectFactory.register("d:feature", Gitana.Definition);
    Gitana.ObjectFactory.register("d:association", Gitana.Definition);

})(window);
(function(window)
{
    var Gitana = window.Gitana;

    Gitana.Form = Gitana.Node.extend(
    /** @lends Gitana.Form.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.Node
         *
         * @class Form
         *
         * @param {Gitana.Branch} branch
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(branch, object)
        {
            this.base(branch, object);

            this.objectType = function() { return "Gitana.Form"; };
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().form(this.getBranch(), this);
        },

        /**
         * Gets the engine id for this form.
         *
         * @public
         *
         * @returns {String} engine id
         */
        getEngineId: function()
        {
            return this.get("engineId");
        },

        /**
         * Sets the engine id for this form.
         *
         * @public
         *
         * @param engineId
         */
        setEngineId: function(engineId)
        {
            this.set("engineId", engineId);
        }

    });

    Gitana.ObjectFactory.register("n:form", Gitana.Form);

})(window);
(function(window)
{
    var Gitana = window.Gitana;

    Gitana.HasFormAssociation = Gitana.Association.extend(
    /** @lends Gitana.HasFormAssociation.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.Association
         *
         * @class Has Form Association
         *
         * @param {Gitana.Branch} branch
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(branch, object)
        {
            this.base(branch, object);

            this.objectType = function() { return "Gitana.HasFormAssociation"; };
        },

        /**
         * @override
         */
        clone: function()
        {
            return new Gitana.HasFormAssociation(this.getBranch(), this);
        },

        /**
         * Gets the form key for the association.
         *
         * @public
         *
         * @returns {String} form key
         */
        getFormKey: function()
        {
            return this.get("form-key");
        },

        /**
         * Sets the form key for the association.
         *
         * @public
         * 
         * @param formKey
         */
        setFormKey: function(formKey)
        {
            this.set("form-key", formKey);
        }
    });

    Gitana.ObjectFactory.register("a:has_form", Gitana.HasFormAssociation);

})(window);
(function(window)
{
    var Gitana = window.Gitana;

    Gitana.HasTranslationAssociation = Gitana.Association.extend(
    /** @lends Gitana.HasTranslationAssociation.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.Association
         *
         * @class Has Translation Association
         *
         * @param {Gitana.Branch} branch
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(branch, object)
        {
            this.base(branch, object);

            this.objectType = function() { return "Gitana.HasTranslationAssociation"; };
        },

        /**
         * @override
         */
        clone: function()
        {
            return new Gitana.HasTranslationAssociation(this.getBranch(), this);
        },

        /**
         * Gets the locale of this association.
         *
         * @returns {String} locale
         */
        getLocale: function()
        {
            return this.get("locale");
        },

        /**
         * Sets the locale of this association.
         *
         * @param locale
         */
        setLocale: function(locale)
        {
            this.set("locale", locale);
        },

        /**
         * Gets the edition of this association.
         *
         * @returns {String} edition
         */
        getEdition: function()
        {
            return this.get("edition");
        },

        /**
         * Sets the edition of this association.
         *
         * @param edition
         */
        setEdition: function(edition)
        {
            this.set("edition", edition);
        }

    });

    Gitana.ObjectFactory.register("a:has_translation", Gitana.HasTranslationAssociation);

})(window);
(function(window)
{
    var Gitana = window.Gitana;

    Gitana.Person = Gitana.Node.extend(
    /** @lends Gitana.Person.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.Node
         *
         * @class Person
         *
         * @param {Gitana.Branch} branch
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(branch, object)
        {
            this.base(branch, object);

            this.objectType = function() { return "Gitana.Person"; };
        },

        /**
         * @override
         */
        clone: function()
        {
            return new Gitana.Person(this.getBranch(), this);
        },

        getPrincipalName: function()
        {
            return this.get("principal-name");
        },

        getPrincipalType: function()
        {
            return this.get("principal-type");
        },

        getPrincipalId: function()
        {
            return this.get("principal-id");
        },

        getPrincipalDomainId: function()
        {
            return this.get("principal-domain");
        },

        /**
         * Reads the principal for this person.
         *
         * @chained domain user
         */
        readPrincipal: function()
        {
            return this.subchain(this.getPlatform()).readDomain(this.getPrincipalDomainId()).readPrincipal(this.getPrincipalId());
        },




        //////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // PROPERTIES
        //
        //////////////////////////////////////////////////////////////////////////////////////////////////

        getFirstName: function()
        {
            return this.get("firstName");
        },

        setFirstName: function(firstName)
        {
            this.set("firstName", firstName);
        },

        getLastName: function()
        {
            return this.get("lastName");
        },

        setLastName: function(lastName)
        {
            this.set("lastName", lastName);
        },

        getCompanyName: function()
        {
            return this.get("companyName");
        },

        setCompanyName: function(companyName)
        {
            this.set("companyName", companyName);
        },

        getEmail: function()
        {
            return this.get("email");
        },

        setEmail: function(email)
        {
            this.set("email", email);
        },

        getJobTitle: function()
        {
            return this.get("jobTitle");
        },

        setJobTitle: function(jobTitle)
        {
            this.set("jobTitle", jobTitle);
        },

        getAddress: function()
        {
            return this.get("address");
        },

        setAddress: function(address)
        {
            this.set("address", address);
        },

        getCity: function()
        {
            return this.get("city");
        },

        setCity: function(city)
        {
            this.set("city", city);
        },

        getState: function()
        {
            return this.get("state");
        },

        setState: function(state)
        {
            this.set("state", state);
        },

        getZipcode: function()
        {
            return this.get("zipcode");
        },

        setZipcode: function(zipcode)
        {
            this.set("zipcode", zipcode);
        },

        getPhoneNumber: function()
        {
            return this.get("phoneNumber");
        },

        setPhoneNumber: function(phoneNumber)
        {
            this.set("phoneNumber", phoneNumber);
        }

    });

    Gitana.ObjectFactory.register("n:person", Gitana.Person);

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.Vault = Gitana.AbstractPlatformDataStore.extend(
    /** @lends Gitana.Vault.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformDataStore
         *
         * @class Vault
         *
         * @param {Gitana.Platform} platform
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(platform, object)
        {
            this.base(platform, object);

            this.objectType = function() { return "Gitana.Vault"; };
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_VAULT;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/vaults/" + this.getId();
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().vault(this.getPlatform(), this);
        },




        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // ARCHIVES
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists the archives.
         *
         * @param pagination
         *
         * @chained archive map
         */
        listArchives: function(pagination)
        {
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var chainable = this.getFactory().archiveMap(this);
            return this.chainGet(chainable, this.getUri() + "/archives", params);
        },

        /**
         * Reads an archive.
         *
         * @param stackId
         *
         * @chained stack
         */
        readArchive: function(archiveId)
        {
            var chainable = this.getFactory().archive(this);
            return this.chainGet(chainable, this.getUri() + "/archives/" + archiveId);
        },

        /**
         * Looks up an archive by its identifier information.
         *
         * @param groupId
         * @param artifactId
         * @param versionId
         *
         * @chained stack
         */
        lookupArchive: function(groupId, artifactId, versionId)
        {
            var chainable = this.getFactory().archive(this);
            return this.chainGet(chainable, this.getUri() + "/archives/lookup?group=" + groupId + "&artifact=" + artifactId + "&version=" + versionId);
        },

        /**
         * Queries for stacks.
         *
         * @chained stack map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryArchives: function(query, pagination)
        {
            var self = this;

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return self.getUri() + "/archives/query";
            };

            var chainable = this.getFactory().archiveMap(this);
            return this.chainPost(chainable, uriFunction, params, query);
        },

        /**
         * Performs a bulk check of permissions against permissioned objects of type stack.
         *
         * Example of checks array:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>"
         * }]
         *
         * The callback receives an array of results, example:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>",
         *    "result": true
         * }]
         *
         * The order of elements in the array will be the same for checks and results.
         *
         * @param checks
         * @param callback
         */
        checkArchivePermissions: function(checks, callback)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/archives/permissions/check";
            };

            var object = {
                "checks": checks
            };

            return this.chainPostResponse(this, uriFunction, {}, object).then(function(response) {
                callback.call(this, response["results"]);
            });
        }
    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.VaultMap = Gitana.AbstractPlatformObjectMap.extend(
    /** @lends Gitana.VaultMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObjectMap
         *
         * @class VaultMap
         *
         * @param {Gitana.Platform} platform Gitana platform
         * @param {Object} object
         */
        constructor: function(platform, object)
        {
            this.objectType = function() { return "Gitana.VaultMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(platform, object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().vaultMap(this.getPlatform(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().vault(this.getPlatform(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.Archive = Gitana.AbstractPlatformObject.extend(
    /** @lends Gitana.Archive.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObject
         *
         * @class Archive
         *
         * @param {Gitana.Vault} vault
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(vault, object)
        {
            this.base(vault.getPlatform(), object);

            this.objectType = function() { return "Gitana.Archive"; };



            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            /**
             * Gets the Gitana Vault object.
             *
             * @inner
             *
             * @returns {Gitana.Vault} The Gitana Vault object
             */
            this.getVault = function() { return vault; };

            /**
             * Gets the Gitana Vault id.
             *
             * @inner
             *
             * @returns {String} The Gitana Vault id
             */
            this.getVaultId = function() { return vault.getId(); };
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_ARCHIVE;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/vaults/" + this.getVaultId() + "/archives/" + this.getId();
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().archive(this.getVault(), this);
        },

        /**
         * Gets the URI used to download the archive
         */
        getDownloadUri: function()
        {
            return this.getProxiedUri() + "/download";
        },



        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // ATTACHMENTS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Hands back an attachments map.
         *
         * @chained attachment map
         *
         * @param local
         *
         * @public
         */
        listAttachments: Gitana.Methods.listAttachments(),

        /**
         * Picks off a single attachment
         *
         * @chained attachment
         *
         * @param attachmentId
         */
        attachment: function(attachmentId)
        {
            return this.listAttachments().select(attachmentId);
        },

        /**
         * Creates an attachment.
         *
         * When using this method from within the JS driver, it really only works for text-based content such
         * as JSON or text.
         *
         * @chained attachment
         *
         * @param attachmentId (use null or false for default attachment)
         * @param contentType
         * @param data
         */
        attach: Gitana.Methods.attach(),

        /**
         * Deletes an attachment.
         *
         * @param attachmentId
         */
        unattach: Gitana.Methods.unattach(),

        /**
         * Generates a URI to a preview resource.
         */
        getPreviewUri: Gitana.Methods.getPreviewUri()

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.ArchiveMap = Gitana.AbstractPlatformObjectMap.extend(
    /** @lends Gitana.ArchiveMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObjectMap
         *
         * @class ArchiveMap
         *
         * @param {Gitana.Vault} vault Gitana vault instance.
         * @param [Object] object
         */
        constructor: function(vault, object)
        {
            this.objectType = function() { return "Gitana.ArchiveMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            /**
             * Gets the Gitana Vault object.
             *
             * @inner
             *
             * @returns {Gitana.Vault} The Gitana Vault object
             */
            this.getVault = function() { return vault; };

            /**
             * Gets the Gitana Vault id.
             *
             * @inner
             *
             * @returns {String} The Gitana Vault id
             */
            this.getVaultId = function() { return vault.getId(); };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(vault.getPlatform(), object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().archiveMap(this.getVault(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().archive(this.getVault(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.WebHost = Gitana.AbstractPlatformDataStore.extend(
    /** @lends Gitana.WebHost.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObject
         *
         * @class WebHost
         *
         * @param {Gitana.Platform} platform
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(platform, object)
        {
            this.objectType = function() { return "Gitana.WebHost"; };

            this.base(platform, object);
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/webhosts/" + this.getId();
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_WEB_HOST;
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().webhost(this.getPlatform(), this);
        },

        getUrlPatterns: function()
        {
            return this.get("urlPatterns");
        },
        

        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // AUTO CLIENT MAPPINGS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Create auto client mapping
         *
         * @chained auto client mapping
         *
         * @param uri
         * @param applicationId
         * @param clientKey
         * @param authGrantKey
         * @param [Object] object JSON object
         */
        createAutoClientMapping: function(uri, applicationId, clientKey, authGrantKey, object)
        {
            if (!object)
            {
                object = {};
            }

            if (!Gitana.isString(applicationId))
            {
                applicationId = applicationId.getId();
            }

            if (!Gitana.isString(clientKey))
            {
                clientKey = clientKey.getKey();
            }

            if (!Gitana.isString(authGrantKey))
            {
                authGrantKey = authGrantKey.getKey();
            }

            object["uri"] = uri;
            object["applicationId"] = applicationId;
            object["clientKey"] = clientKey;
            object["authGrantKey"] = authGrantKey;

            var uriFunction = function()
            {
                return "/webhosts/" + this.getId() + "/autoclientmappings";
            };

            var chainable = this.getFactory().autoClientMapping(this);
            return this.chainCreate(chainable, object, uriFunction);
        },

        /**
         * Lists the auto client mappings.
         *
         * @param pagination
         *
         * @chained auto client mappings map
         */
        listAutoClientMappings: function(pagination)
        {
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return "/webhosts/" + this.getId() + "/autoclientmappings";
            };

            var chainable = this.getFactory().autoClientMappingMap(this);
            return this.chainGet(chainable, uriFunction, params);
        },

        /**
         * Reads an auto client mapping.
         *
         * @param autoClientMappingId
         *
         * @chained auto client mapping
         */
        readAutoClientMapping: function(autoClientMappingId)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/autoclientmappings/" + autoClientMappingId;
            };

            var chainable = this.getFactory().autoClientMapping(this);
            return this.chainGet(chainable, uriFunction);
        },

        /**
         * Queries for auto client mappings.
         *
         * @chained auto client mappings map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryAutoClientMappings: function(query, pagination)
        {
            var self = this;

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return self.getUri() + "/autoclientmappings/query";
            };

            var chainable = this.getFactory().autoClientMappingMap(this);
            return this.chainPost(chainable, uriFunction, params, query);
        },

        /**
         * Performs a bulk check of permissions against permissioned objects of type stack.
         *
         * Example of checks array:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>"
         * }]
         *
         * The callback receives an array of results, example:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>",
         *    "result": true
         * }]
         *
         * The order of elements in the array will be the same for checks and results.
         *
         * @param checks
         * @param callback
         */
        checkAutoClientMappingsPermissions: function(checks, callback)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/autoclientmappings/permissions/check";
            };

            var object = {
                "checks": checks
            };

            return this.chainPostResponse(this, uriFunction, {}, object).then(function(response) {
                callback.call(this, response["results"]);
            });
        },




        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // TRUSTED DOMAIN MAPPINGS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Create trusted domain mapping
         *
         * @chained trusted domain mapping
         *
         * @param host
         * @param scope
         * @param platformId
         * @param [Object] object JSON object
         */
        createTrustedDomainMapping: function(host, scope, platformId, object)
        {
            if (!object)
            {
                object = {};
            }

            if (!Gitana.isString(platformId))
            {
                platformId = platformId.getId();
            }

            object["host"] = host;
            object["scope"] = scope;
            object["platformId"] = platformId;

            var uriFunction = function()
            {
                return "/webhosts/" + this.getId() + "/trusteddomainmappings";
            };

            var chainable = this.getFactory().trustedDomainMapping(this);
            return this.chainCreate(chainable, object, uriFunction);
        },

        /**
         * Lists the trusted domain mappings.
         *
         * @param pagination
         *
         * @chained trusted domain mappings map
         */
        listTrustedDomainMappings: function(pagination)
        {
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return "/webhosts/" + this.getId() + "/trusteddomainmappings";
            };

            var chainable = this.getFactory().trustedDomainMappingMap(this);
            return this.chainGet(chainable, uriFunction, params);
        },

        /**
         * Reads a trusted domain mapping.
         *
         * @param trustedDomainMappingId
         *
         * @chained trusted domain mapping
         */
        readTrustedDomainMapping: function(trustedDomainMappingId)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/trusteddomainmappings/" + trustedDomainMappingId;
            };

            var chainable = this.getFactory().trustedDomainMapping(this);
            return this.chainGet(chainable, uriFunction);
        },

        /**
         * Queries for trusted domain mappings.
         *
         * @chained trusted domain mappings map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryTrustedDomainMappings: function(query, pagination)
        {
            var self = this;

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return self.getUri() + "/trusteddomainmappings/query";
            };

            var chainable = this.getFactory().trustedDomainMappingMap(this);
            return this.chainPost(chainable, uriFunction, params, query);
        },

        /**
         * Performs a bulk check of permissions against permissioned objects of type stack.
         *
         * Example of checks array:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>"
         * }]
         *
         * The callback receives an array of results, example:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>",
         *    "result": true
         * }]
         *
         * The order of elements in the array will be the same for checks and results.
         *
         * @param checks
         * @param callback
         */
        checkTrustedDomainMappingsPermissions: function(checks, callback)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/trusteddomainmappings/permissions/check";
            };

            var object = {
                "checks": checks
            };

            return this.chainPostResponse(this, uriFunction, {}, object).then(function(response) {
                callback.call(this, response["results"]);
            });
        },



        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // DEPLOYED APPLICATIONS
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Lists the deployed applications.
         *
         * @param pagination
         *
         * @chained deployed application mappings map
         */
        listDeployedApplications: function(pagination)
        {
            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return "/webhosts/" + this.getId() + "/applications";
            };

            var chainable = this.getFactory().deployedApplicationMap(this);
            return this.chainGet(chainable, uriFunction, params);
        },

        /**
         * Reads a deployed application.
         *
         * @param deployedApplicationId
         *
         * @chained deployed application
         */
        readDeployedApplication: function(deployedApplicationId)
        {
            var uriFunction = function()
            {
                return "/webhosts/" + this.getId() + "/applications/" + deployedApplicationId;
            };

            var chainable = this.getFactory().deployedApplication(this);
            return this.chainGet(chainable, uriFunction);
        },

        /**
         * Queries for deployed applications
         *
         * @chained deployed applications map
         *
         * @param {Object} query
         * @param [Object] pagination pagination (optional)
         */
        queryDeployedApplications: function(query, pagination)
        {
            var self = this;

            var params = {};
            if (pagination)
            {
                Gitana.copyInto(params, pagination);
            }

            var uriFunction = function()
            {
                return self.getUri() + "/applications/query";
            };

            var chainable = this.getFactory().deployedApplicationMap(this);
            return this.chainPost(chainable, uriFunction, params, query);
        },

        /**
         * Performs a bulk check of permissions against permissioned objects of type stack.
         *
         * Example of checks array:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>"
         * }]
         *
         * The callback receives an array of results, example:
         *
         * [{
         *    "permissionedId": "<permissionedId>",
         *    "principalId": "<principalId>",
         *    "permissionId": "<permissionId>",
         *    "result": true
         * }]
         *
         * The order of elements in the array will be the same for checks and results.
         *
         * @param checks
         * @param callback
         */
        checkDeployedApplicationsPermissions: function(checks, callback)
        {
            var self = this;

            var uriFunction = function()
            {
                return self.getUri() + "/applications/permissions/check";
            };

            var object = {
                "checks": checks
            };

            return this.chainPostResponse(this, uriFunction, {}, object).then(function(response) {
                callback.call(this, response["results"]);
            });
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.WebHostMap = Gitana.AbstractPlatformObjectMap.extend(
    /** @lends Gitana.WebHostMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObjectMap
         *
         * @class Map of web host objects
         *
         * @param {Gitana.Platform} platform Gitana platform
         * @param {Object} object
         */
        constructor: function(platform, object)
        {
            this.objectType = function() { return "Gitana.WebHostMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(platform, object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().webhostMap(this.getPlatform(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().webhost(this.getPlatform(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.AutoClientMapping = Gitana.AbstractPlatformObject.extend(
    /** @lends Gitana.AutoClientMapping.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObject
         *
         * @class AutoClientMapping
         *
         * @param {Gitana.WebHost} webhost
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(webhost, object)
        {
            this.base(webhost.getPlatform(), object);

            this.objectType = function() { return "Gitana.AutoClientMapping"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            /**
             * Gets the Gitana Web Host object.
             *
             * @inner
             *
             * @returns {Gitana.WebHost} The Gitana Web Host object
             */
            this.getWebHost = function() { return webhost; };

            /**
             * Gets the Gitana Web Host id.
             *
             * @inner
             *
             * @returns {String} The Gitana Web Host id
             */
            this.getWebHostId = function() { return webhost.getId(); };
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().autoClientMapping(this.getWebHost(), this);
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_AUTO_CLIENT_MAPPING;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/webhosts/" + this.getWebHostId() + "/autoclientmappings/" + this.getId();
        },

        getSourceUri: function()
        {
            return this.get("uri");
        },

        getTargetApplicationId: function()
        {
            return this.get("applicationId");
        },

        getTargetClientKey: function()
        {
            return this.get("clientKey");
        },

        getTargetTenantId: function()
        {
            return this.get("tenantId");
        },

        getAutoManage: function()
        {
            return this.get("automanage");
        }
    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.TrustedDomainMappingMap = Gitana.AbstractPlatformObjectMap.extend(
    /** @lends Gitana.TrustedDomainMappingMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObjectMap
         *
         * @class TrustedDomainMappingMap
         *
         * @param {Gitana.WebHost} webhost Gitana Web Host instance.
         * @param [Object] object
         */
        constructor: function(webhost, object)
        {
            this.objectType = function() { return "Gitana.TrustedDomainMappingMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            /**
             * Gets the Gitana Web Host object.
             *
             * @inner
             *
             * @returns {Gitana.WebHost} The Gitana Web Host object
             */
            this.getWebHost = function() { return webhost; };

            /**
             * Gets the Gitana Web Host id.
             *
             * @inner
             *
             * @returns {String} The Gitana Web Host id
             */
            this.getWebHostId = function() { return webhost.getId(); };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(webhost.getPlatform(), object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().trustedDomainMappingMap(this.getWebHost(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().trustedDomainMapping(this.getWebHost(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.TrustedDomainMapping = Gitana.AbstractPlatformObject.extend(
    /** @lends Gitana.TrustedDomainMapping.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObject
         *
         * @class TrustedDomainMapping
         *
         * @param {Gitana.WebHost} webhost
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(webhost, object)
        {
            this.base(webhost.getPlatform(), object);

            this.objectType = function() { return "Gitana.TrustedDomainMapping"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            /**
             * Gets the Gitana Web Host object.
             *
             * @inner
             *
             * @returns {Gitana.WebHost} The Gitana Web Host object
             */
            this.getWebHost = function() { return webhost; };

            /**
             * Gets the Gitana Web Host id.
             *
             * @inner
             *
             * @returns {String} The Gitana Web Host id
             */
            this.getWebHostId = function() { return webhost.getId(); };
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().trustedDomainMapping(this.getWebHost(), this);
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_TRUSTED_DOMAIN_MAPPING;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/webhosts/" + this.getWebHostId() + "/trusteddomainmappings/" + this.getId();
        }
    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.AutoClientMappingMap = Gitana.AbstractPlatformObjectMap.extend(
    /** @lends Gitana.AutoClientMappingMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObjectMap
         *
         * @class AutoClientMappingMap
         *
         * @param {Gitana.WebHost} webhost Gitana Web Host instance.
         * @param [Object] object
         */
        constructor: function(webhost, object)
        {
            this.objectType = function() { return "Gitana.AutoClientMappingMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            /**
             * Gets the Gitana Web Host object.
             *
             * @inner
             *
             * @returns {Gitana.WebHost} The Gitana Web Host object
             */
            this.getWebHost = function() { return webhost; };

            /**
             * Gets the Gitana Web Host id.
             *
             * @inner
             *
             * @returns {String} The Gitana Web Host id
             */
            this.getWebHostId = function() { return webhost.getId(); };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(webhost.getPlatform(), object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().autoClientMappingMap(this.getWebHost(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().autoClientMapping(this.getWebHost(), json);
        }

    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.DeployedApplication = Gitana.AbstractPlatformObject.extend(
    /** @lends Gitana.DeployedApplication.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObject
         *
         * @class DeployedApplication
         *
         * @param {Gitana.WebHost} webhost
         * @param [Object] object json object (if no callback required for populating)
         */
        constructor: function(webhost, object)
        {
            this.base(webhost.getPlatform(), object);

            this.objectType = function() { return "Gitana.DeployedApplication"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            /**
             * Gets the Gitana Web Host object.
             *
             * @inner
             *
             * @returns {Gitana.WebHost} The Gitana Web Host object
             */
            this.getWebHost = function() { return webhost; };

            /**
             * Gets the Gitana Web Host id.
             *
             * @inner
             *
             * @returns {String} The Gitana Web Host id
             */
            this.getWebHostId = function() { return webhost.getId(); };
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().deployedApplication(this.getWebHost(), this);
        },

        /**
         * @OVERRIDE
         */
        getType: function()
        {
            return Gitana.TypedIDConstants.TYPE_DEPLOYED_APPLICATION;
        },

        /**
         * @OVERRIDE
         */
        getUri: function()
        {
            return "/webhosts/" + this.getWebHostId() + "/applications/" + this.getId();
        },



        //////////////////////////////////////////////////////////////////////////////////////////
        //
        // DEPLOYMENT
        //
        //////////////////////////////////////////////////////////////////////////////////////////

        /**
         * Undeploys the deployed application.
         *
         * @chained deployed application
         */
        undeploy: function()
        {
            var uriFunction = function()
            {
                return this.getUri() + "/undeploy";
            };

            // NOTE: pass control back to the web host
            return this.chainPostEmpty(this.getWebHost(), uriFunction);
        },

        /**
         * Redeploys the deployed application.
         *
         * @chained deployed application
         */
        redeploy: function()
        {
            var uriFunction = function()
            {
                return this.getUri() + "/redeploy";
            };

            // NOTE: pass control back to the web host
            return this.chainPostEmpty(this.getWebHost(), uriFunction);
        },

        /**
         * Starts the deployed application.
         *
         * @chained deployed application
         */
        start: function()
        {
            var uriFunction = function()
            {
                return this.getUri() + "/start";
            };

            // NOTE: pass control back to the web host
            return this.chainPostEmpty(this.getWebHost(), uriFunction);
        },

        /**
         * Stops the deployed application.
         *
         * @chained deployed application
         */
        stop: function()
        {
            var uriFunction = function()
            {
                return this.getUri() + "/stop";
            };

            // NOTE: pass control back to the web host
            return this.chainPostEmpty(this.getWebHost(), uriFunction);
        },

        /**
         * Undeploys the deployed application.
         *
         * @chained deployed application
         */
        restart: function()
        {
            var uriFunction = function()
            {
                return this.getUri() + "/restart";
            };

            // NOTE: pass control back to the web host
            return this.chainPostEmpty(this.getWebHost(), uriFunction);
        }


    });

})(window);
(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.DeployedApplicationMap = Gitana.AbstractPlatformObjectMap.extend(
    /** @lends Gitana.DeployedApplicationMap.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractPlatformObjectMap
         *
         * @class DeployedApplicationMap
         *
         * @param {Gitana.WebHost} webhost Gitana Web Host instance.
         * @param [Object] object
         */
        constructor: function(webhost, object)
        {
            this.objectType = function() { return "Gitana.DeployedApplicationMap"; };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // PRIVILEGED METHODS
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            /**
             * Gets the Gitana Web Host object.
             *
             * @inner
             *
             * @returns {Gitana.WebHost} The Gitana Web Host object
             */
            this.getWebHost = function() { return webhost; };

            /**
             * Gets the Gitana Web Host id.
             *
             * @inner
             *
             * @returns {String} The Gitana Web Host id
             */
            this.getWebHostId = function() { return webhost.getId(); };


            //////////////////////////////////////////////////////////////////////////////////////////////
            //
            // CALL THROUGH TO BASE CLASS (at the end)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////

            this.base(webhost.getPlatform(), object);
        },

        /**
         * @override
         */
        clone: function()
        {
            return this.getFactory().deployedApplicationMap(this.getWebHost(), this);
        },

        /**
         * @param json
         */
        buildObject: function(json)
        {
            return this.getFactory().deployedApplication(this.getWebHost(), json);
        }

    });

})(window);
(function(window) {
/**
 * @ignore
 */
    var Gitana = window.Gitana;

    Gitana.Context = Gitana.Chainable.extend(
    /** @lends Gitana.Context.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.Chainable
         *
         * @class Utility class for providing Gitana context
         *
         * @param [Object] configs Configuration parameters
         */
        constructor: function(configs) {
            this.base(new Gitana(configs['driver'] ? configs['driver'] : {}));

            // cache
            if (!this.cache) {
                this.cache = {};
            }
            this.cache["repository"] = null;
            this.cache["branch"] = null;
            this.cache["platform"] = null;

            ///////////////////////////////////////////////////////////////////////////////////////////////////////
            //
            // privileged methods
            //
            ///////////////////////////////////////////////////////////////////////////////////////////////////////

            this.getConfigs = function() {
                return configs;
            };

            this.getRepositoryConfigs = function() {
                var repositoryConfigs = configs['repository'];
                if (typeof repositoryConfigs == "string") {
                    repositoryConfigs = {
                        "repository" : repositoryConfigs
                    };
                }
                return repositoryConfigs;
            };

            this.getBranchConfigs = function() {
                var branchConfigs = configs['branch'] ? configs['branch'] : 'master';
                if (typeof branchConfigs == "string") {
                    if (branchConfigs == 'master') {
                        branchConfigs = {
                            'type' : 'MASTER'
                        };
                    } else {
                        branchConfigs = {
                            "_doc" : branchConfigs
                        };
                    }
                }
                return branchConfigs;
            };

            this.getUserConfigs = function() {
                return configs['user'];
            };

            this.getDriverConfigs = function() {
                return configs['driver'];
            };
        },

        platform: function(platform)
        {
            if (platform || platform === null) {
                this.cache.platform = platform;
            }

            return this.cache.platform ? Chain(this.cache.platform) : null;
        },

        repository: function(repository)
        {
            if (repository || repository === null) {
                this.cache.repository = repository;
            }

            return this.cache.repository ? Chain(this.cache.repository) : null;
        },

        branch: function(branch)
        {
            if (branch || branch === null) {
                this.cache.branch = branch;
            }

            return this.cache.branch ? Chain(this.cache.branch) : null;
        },

        /**
         * Hands back an initialized version of the Gitana Context object
         *
         * @chained gitana context
         */
        init: function () {

            var self = this;

            var loadPlatform = function(successCallback, errorCallback)
            {
                if (!self.platform())
                {
                    var authentication = self.getConfigs()["authentication"];

                    self.getDriver().authenticate(authentication, function(http) {
                        if (errorCallback) {
                            errorCallback({
                                'message': 'Failed to login Gitana.',
                                'reason': 'INVALID_LOGIN',
                                'error': http
                            });
                        }
                    }).then(function() {

                        self.platform(this);

                        // now move on to repository
                        loadRepository(successCallback, errorCallback);
                    });
                }
                else
                {
                    loadRepository(successCallback, errorCallback);
                }
            };

            var loadRepository = function(successCallback, errorCallback)
            {
                if (!self.repository())
                {
                    self.platform().trap(function(error) {
                        if (errorCallback) {
                            errorCallback({
                                'message': 'Failed to get repository',
                                'error': error
                            });
                        }
                    }).queryRepositories(self.getRepositoryConfigs()).count(function(count) {
                        if (errorCallback) {
                            if (count == 0) {
                                errorCallback({
                                    'message': 'Cannot find any repository'
                                });
                            }
                            if (count > 1) {
                                errorCallback({
                                    'message': 'Found more than one repository'
                                });
                            }
                        }
                    }).keepOne().then(function() {

                        self.repository(this);

                        // now move on to branch
                        loadBranch(successCallback, errorCallback);
                    });
                }
                else
                {
                    loadBranch(successCallback, errorCallback);
                }
            };

            var loadBranch = function(successCallback, errorCallback)
            {
                if (!self.branch())
                {
                    self.repository().trap(function(error) {
                        if (errorCallback) {
                            errorCallback({
                                'message': 'Failed to get branch',
                                'error': error
                            });
                        }
                    }).queryBranches(self.getBranchConfigs()).count(function(count) {
                        if (errorCallback) {
                            if (count == 0) {
                                errorCallback({
                                    'message': 'Cannot find any branch'
                                });
                            }
                            if (count > 1) {
                                errorCallback({
                                    'message': 'Found more than one branch'
                                });
                            }
                        }
                    }).keepOne().then(function() {

                        self.branch(this);

                        // now fire the success callback
                        successCallback.call();
                    });
                }
                else
                {
                    // fire the success callback
                    successCallback.call();
                }
            };

            // we hand back a chained version of ourselves
            var result = Chain(this);

            // preload work onto the chain
            return result.subchain().then(function() {

                var chain = this;

                loadPlatform(function() {

                    // success, advance chain manually
                    chain.next();

                }, function(err) {

                    var errorCallback = self.getConfigs()['error'];
                    if (errorCallback)
                    {
                        errorCallback.call(self, err);
                    }

                });

                // return false so that the chain doesn't complete until we manually complete it
                return false;
            });
        }
    });

    /**
     * Static helper function to build and init a new context.
     *
     * @param config
     */
    Gitana.Context.create = function(config)
    {
        var context = new Gitana.Context(config);
        return context.init();
    };

})(window);(function(window)
{
    var Gitana = window.Gitana;
    
    Gitana.AppHelper = Gitana.AbstractObject.extend(
    /** @lends Gitana.AppHelper.prototype */
    {
        /**
         * @constructs
         * @augments Gitana.AbstractObject
         *
         * @class AppHelper
         *
         * @param {Gitana.Platform} platform
         * @param {object} config the configuration object (.application)
         */
        constructor: function(platform, config)
        {
            this.objectType = function() { return "Gitana.AppHelper"; };

            this.base(platform.getDriver());

            this.getPlatform = function() {
                return platform;
            };

            this.getPlatformId = function() {
                return platform.getId();
            };

            this.getApplicationId = function() {
                return config["application"];
            };

            this.cache = Gitana.MemoryCache();

            this.chainedCacheItem = function(key)
            {
                var chained = null;

                if (this.cache(key))
                {
                    chained = Chain(this.cache(key));
                }

                return chained;
            };
        },

        init: function(callback)
        {
            var self = this;

            var p = function(application)
            {
                // THIS = application

                var projectId = application["projectId"];
                if (projectId)
                {
                    // read the project
                    Chain(self.getPlatform()).trap(function(err) {

                        // could not find the project for the application
                        // this is fine... we are done
                        callback();

                    }).readProject(projectId).then(function() {

                        self.cache("project", this);

                        callback();

                    });
                }
                else
                {
                    callback();
                }
            };

            Chain(self.getPlatform()).trap(function(err) {

                // ERROR: application not found

                callback(err);

            }).readApplication(self.getApplicationId()).then(function() {
                self.cache("application", this);

                var application = this;

                this.subchain(self.getPlatform()).trap(function(err) {

                    // could not locate the stack for the application
                    // this is perfectly fine (just means an application isn't allocated to a stack)
                    p(application);

                }).findStackForDataStore(Gitana.TypedIDConstants.TYPE_APPLICATION, self.getApplicationId()).then(function() {

                    // this = stack
                    self.cache("stack", this);

                    this.listDataStores().each(function(key) {
                        this["_doc"] = this["datastoreId"];
                        delete this["datastoreTypeId"];
                        self.cache("stack.datastore." + key, this);
                    });

                    this.then(function() {
                        p(application);
                    });
                });

            });
        },

        platform: function()
        {
            return Chain(this.getPlatform());
        },

        application: function()
        {
            return this.chainedCacheItem("application");
        },

        stack: function()
        {
            return this.chainedCacheItem("stack");
        },

        datastore: function(key)
        {
            return this.chainedCacheItem("stack.datastore." + key);
        },

        project: function()
        {
            return this.chainedCacheItem("project");
        }

    });

})(window);


    return Gitana;

}));
