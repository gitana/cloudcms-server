/*
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

(function(root, factory) {

    /* CommonJS */
    if (typeof exports == 'object') {
        var $ = require("jquery");
        var io = require("socket.io");
        module.exports = factory($, io);
    }

    /* AMD module */
    else if (typeof define == 'function' && define.amd) {
        define(["jquery", "socket.io"], factory);
    }

    /* Browser global */
    else {
        var $ = root.$;
        var io = root.io;
        root.Spinner = factory($, io);
    }
}
(this, function($, io) {
    "use strict";

    if ($.fn.insight)
    {
        // already initialized with jquery, simply bail out
        return;
    }

    var CLASS_INSIGHT = "insight";
    var ATTR_DATA_INSIGHT_ID = "data-insight-id";
    var ATTR_DATA_INSIGHT_NODE = "data-insight-node";

    var iidCounter = 0;

    /////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // utility functions
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////

    var makeArray = function(nonArray) {
        return Array.prototype.slice.call(nonArray);
    };
    var isFunction = function(obj) {
        return Object.prototype.toString.call(obj) === "[object Function]";
    };
    var isString = function(obj) {
        return (typeof obj == "string");
    };
    var copyInto = function(target, source, includeFunctions) {
        for (var i in source) {
            if (source.hasOwnProperty(i)) {
                if (isFunction(source[i])) {
                    if (includeFunctions) {
                        target[i] = source[i];
                    }
                }
                else {
                    target[i] = source[i];
                }
            }
        }
    };
    var createInsightId = function() {
        var str = window.location.protocol + window.location.hostname + ":" + window.location.port + window.location.pathname;
        var iid = hashcode(str) + "_" + iidCounter;
        iidCounter++;

        return iid;
    };
    var hashcode = function(str) {
        var hash = 0;
        if (str.length == 0) return hash;
        for (var i = 0; i < str.length; i++) {
            var char2 = str.charCodeAt(i);
            hash = ((hash<<5)-hash)+char2;
            hash = hash & hash; // Convert to 32bit integer
        }
        if (hash < 0) {
            hash = hash * -1;
        }
        return hash;
    };
    var insightId = function(el, id)
    {
        if (id)
        {
            if (!$(el).hasClass(CLASS_INSIGHT))
            {
                $(el).addClass(CLASS_INSIGHT);
            }

            $(el).attr(ATTR_DATA_INSIGHT_ID, id);
        }

        if ($(el).hasClass(CLASS_INSIGHT))
        {
            id = $(el).attr(ATTR_DATA_INSIGHT_ID);
        }

        return id;
    };
    var findNearestCloudCMSNode = function(el)
    {
        if (!el || $(el).length == 0)
        {
            return null;
        }

        var attr = $(el).attr(ATTR_DATA_INSIGHT_NODE);
        if (attr)
        {
            var repoId = null;
            var branchId = null;
            var nodeId = null;

            // structure is <repoId>/<branchId>/<nodeId>
            var i = attr.indexOf("/");
            if (i > -1)
            {
                repoId = attr.substring(0, i);
                var j = attr.indexOf("/", i+1);
                if (j > -1)
                {
                    branchId = attr.substring(i+1, j);
                    nodeId = attr.substring(j+1);
                }
            }

            return {
                "repositoryId": repoId,
                "branchId": branchId,
                "id": nodeId
            };
        }

        return findNearestCloudCMSNode($(el).parent());
    };



    /////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // contexts
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////

    // construct a map of provider functions
    // this can be overridden with config
    var CONTEXTS_DEFAULTS = {
        "user": function() {
            return {};
        },
        "source": function() {
            return {
                "user-agent": navigator.userAgent,
                "platform": navigator.platform
            };
        },
        "page": function() {
            return {
                "uri": window.location.pathname,
                "hash": window.location.hash,
                "fullUri": window.location.pathname + window.location.hash,
                "title": document.title
            };
        },
        "application": function() {
            return {
                "host": window.location.host,
                "hostname": window.location.hostname,
                "port": window.location.port,
                "protocol": window.location.protocol,
                "url": window.location.protocol + "//" + window.location.host
            };
        },
        "node": function(event) {

            var x = {};

            var descriptor = findNearestCloudCMSNode(event.currentTarget);
            if (descriptor)
            {
                x = {
                    "repositoryId": descriptor.repositoryId,
                    "branchId": descriptor.branchId,
                    "id": descriptor.id
                };
            }

            return x;
        },
        "attributes": function(event) {

            var map = {};

            var el = event.currentTarget;

            $.each(el.attributes, function(i, attribute)
            {
                var name = null;

                if (attribute.name.toLowerCase().indexOf("data-insight-") > -1)
                {
                    name = attribute.name.substring(13);
                }
                else if (attribute.name == "href")
                {
                    name = attribute.name;
                }

                if (name)
                {
                    map[name] = attribute.value;
                }
            });

            return map;
        }
    };

    var contexts = {};



    /////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // config
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////

    var config = {};



    /////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // worker objects
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////

    // the dispatcher which uses socket.io to fire messages over to server and listen for special events
    var Dispatcher = function() {

        var createSocket = function()
        {
            /*
             reconnection whether to reconnect automatically (true)
             reconnectionDelay how long to wait before attempting a new reconnection (1000)
             reconnectionDelayMax maximum amount of time to wait between reconnections (5000). Each attempt increases the reconnection by the amount specified by reconnectionDelay.
             timeout connection timeout before a connect_error and connect_timeout events are emitted (20000)
             autoConnect by setting this false, you have to call manager.open whenever you decide it's appropriate
             */
            /*
             var socket = io({
             reconnection: true,
             reconnectionDelay: 50,
             reconnectionDelayMax: 200,
             timeout: 20000,
             autoConnect: true
             });
             */

            var socket = io({
                forceNew: true
            });
            socket.on("connect", function() {
                console.log("socket.io - connect");
            });
            socket.on("error", function() {
                console.log("heard socket.error");
            });
            socket.on("connect_error", function(err) {
                console.log("socket.io - connect_error");
                console.log(err);
            });
            socket.on("connect_timeout", function() {
                console.log("socket.io - connect_timeout");
            });
            socket.on("reconnect", function(n) {
                console.log("socket.io - reconnect");
                console.log(n);
            });
            socket.on("reconnect_attempt", function() {
                console.log("socket.io - reconnect_attempt");
            });
            socket.on("reconnecting", function(n) {
                console.log("socket.io - reconnecting");
                console.log(n);
            });
            socket.on("reconnect_error", function(err) {
                console.log("socket.io - reconnect_error");
                console.log(err);
            });
            socket.on("reconnect_failed", function() {
                console.log("socket.io - reconnect_failed");
            });

            return socket;
        };

        var sendMessage = function()
        {
            var socket = null;

            return function(event, data)
            {
                if (!socket)
                {
                    console.log("Creating first socket");
                    socket = createSocket();
                }

                socket.emit(event, data);
            }
        }();

        var QUEUE = [];
        var BUSY = false;

        // run a timeout process that periodically fires over socket.io. updates
        var syncFunction = function(callback)
        {
            if (BUSY)
            {
                callback();
                return;
            }

            BUSY = true;

            var queueLength = QUEUE.length;
            if (queueLength > 0)
            {
                try
                {
                    // copy into rows
                    var data = {
                        "warehouseId": config.warehouseId,
                        "rows": []
                    };
                    for (var i = 0; i < queueLength; i++) {
                        data.rows.push(QUEUE[i]);
                    }

                    console.log("Insight sending " + data.rows.length + " rows");

                    // send via socket.io
                    sendMessage("insight-push", data);

                    // strip down the queue
                    QUEUE = QUEUE.slice(queueLength);
                }
                catch (e)
                {
                    console.log(e);
                }
            }

            // unbusy
            BUSY = false;

            callback();
        };

        var r = {};

        r.push = function(interaction)
        {
            QUEUE.push(interaction);
        };

        r.flush = function(callback)
        {
            syncFunction(function(err) {

                if (callback) {
                    callback(err);
                }

            });
        };

        return r;
    }();


    /////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // methods
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////

    var methods = {};

    /**
     * This is the "endSession" method which can be called at any time to end the current session.
     */
    methods.endSession = function(callback)
    {
        var now = new Date().getTime();

        if (SESSION_KEY)
        {
            Dispatcher.push({
                "warehouseId": config.warehouseId,
                "event": {
                    "type": "end_session"
                },
                "timestamp": {
                    "ms": now
                },
                //"appKey": Insight.APPLICATION_KEY,
                "sessionKey": SESSION_KEY,
                "userKey": USER_KEY
            });

            // flush
            Dispatcher.flush(function(err) {

                if (callback)
                {
                    callback(err);
                }

            });

            SESSION_KEY = null;
        }
    };


    /////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // event capture logic
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////

    // a tag that is created on the browser side (here) to identify the session
    var SESSION_KEY = null;
    // a tag that is created on the browser side (here) to identify the user
    var USER_KEY = null;

    var startSession = function(callback)
    {
        var now = new Date().getTime();

        // make sure we have a session started
        if (!SESSION_KEY)
        {
            // generate session and user keys
            SESSION_KEY = "SESSION_KEY_" + now;
            USER_KEY = "USER_KEY_" + now;

            // indicate that we started a session
            Dispatcher.push({
                "event": {
                    "type": "start_session"
                },
                "timestamp": {
                    "ms": now
                },
                //"appKey": Insight.APPLICATION_KEY,
                "sessionKey": SESSION_KEY,
                "userKey": USER_KEY,
                "page": contexts["page"](),
                "application": contexts["application"](),
                "user": contexts["user"](),
                "source": contexts["source"]()
            });

            // flush
            Dispatcher.flush(function(err) {

                if (callback)
                {
                    callback(err);
                }

            });
        }
    };

    var captureInteraction = function(event, callback)
    {
        var now = new Date().getTime();

        // push the interaction
        Dispatcher.push({
            "event": {
                "type": event.type,
                "x": event.pageX,
                "y": event.pageY,
                "offsetX": event.offsetX,
                "offsetY": event.offsetY
            },
            "timestamp": {
                "ms": now
            },
            "element": {
                "id": event.currentTarget.id,
                "type": event.currentTarget.nodeName,
                "iid": insightId(event.currentTarget)
            },
            //"appKey": Insight.APPLICATION_KEY,
            "sessionKey": SESSION_KEY,
            "userKey": USER_KEY,
            "page": contexts["page"](),
            "application": contexts["application"](),
            "user": contexts["user"](),
            "source": contexts["source"](),
            "node": contexts["node"](event),
            "attributes": contexts["attributes"](event)
        });

        // flush
        Dispatcher.flush(function(err) {

            if (callback)
            {
                callback(err);
            }

        });

    };



    /////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // binds events
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////

    var FunctionHandler = function(el, _config)
    {
        // el can either be a dom id or a dom element
        if (el && isString(el)) {
            el = $("#" + el);
        }

        if (!_config) {
            _config = {};
        }

        /**
         * If config is a string, then it is a method name
         * We support:
         *
         *    'endSession'
         *    'destroy'
         */
        var methodName = null;
        if (typeof(_config) == "string")
        {
            methodName = _config;
        }
        if (methodName)
        {
            return methods[methodName].call();
        }


        /**
         * Configuration:
         *
         *      {
         *          "contexts": {
         *              "node": function(event) {
         *              },
         *              "user": function(event) {
         *              },
         *              "source": function(event) {
         *              },
         *              "page": function(event) {
         *              },
         *              "application": function(event) {
         *              }
         *          },
         *          "events": ["click"],
         *          "host": <optional - either provided or picked from window.location>,
         *          "warehouseId": <optional - warehouse id>
         *      }
         */

        /**
         * Notes
         *
         *  The window.location.href is passed over to the server.  If "host" is provided in config, then that is used.
         *
         *  The server uses this to determine the Insight.APPLICATION_KEY and warehouseId is assumed to be "primary"
         *  unless provided in config.  warehouseId can also be specified in config.
         */

        // if events array not specified, assume 'click' event
        if (!_config.events)
        {
            _config.events = ["click"];
        }

        // config
        config = {};
        copyInto(config, _config);

        // contexts
        contexts = {};
        copyInto(contexts, CONTEXTS_DEFAULTS, true);
        if (config.contexts)
        {
            copyInto(contexts, config.contexts, true);
        }

        // walk through our items
        // for each item, if not already tracked, then:
        //
        //   - add class CLASS_INSIGHT
        //   - add attribute ATTR_DATA_INSIGHT_ID
        //   - bind event handlers
        //
        $(el).each(function() {

            var eventEl = this;

            if (!$(eventEl).hasClass(CLASS_INSIGHT))
            {
                // generate a new id and bind to element (apply CLASS_INSIGHT)
                insightId(eventEl, createInsightId());

                // event handlers
                for (var i = 0; i < config.events.length; i++)
                {
                    var eventType = config.events[i];

                    $(eventEl).bindFirst(eventType, function(eventEl, eventType) {

                        return function(event) {

                            // check if already flushed
                            // if so, we skip through our event handler
                            var flushed = $(eventEl).attr("data-insight-flushed");
                            if (!flushed)
                            {
                                // stop event handling chain
                                event.preventDefault();
                                event.stopImmediatePropagation();

                                // capture the interaction
                                captureInteraction(event, function(err) {

                                    window.setTimeout(function() {

                                        // mark as flushed
                                        $(eventEl).attr("data-insight-flushed", "flushed");

                                        // fire event again
                                        if (event.originalEvent && event.originalEvent.target && event.originalEvent.type)
                                        {
                                            try
                                            {
                                                $(event.originalEvent.target).simulate(event.originalEvent.type);
                                            }
                                            catch (e)
                                            {
                                                console.log(e);
                                            }
                                        }

                                    }, 250);
                                    // NOTE: this 250 ms delay is needed for web hosted version where when they click on a tel: link
                                    // something about it blocks or interrupts socket.io from completing it's communication to the
                                    // back end server.  this additional delay allows socket.io to complete first

                                });
                            }
                            else
                            {
                                // remove the flushed marker
                                $(eventEl).attr("data-insight-flushed", null);
                            }
                        };

                    }(eventEl, eventType));
                }
            }
        });

        // start session
        startSession(function(err) {
            // TODO: session started successfully
        });
    };


    /////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // jQuery Wrapper
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////

    $.fn.insight = function()
    {
        var args = makeArray(arguments);

        // append this into the front of args
        var newArgs = [].concat(this, args);

        // invoke, hand back field instance
        return FunctionHandler.apply(this, newArgs);
    };

    // https://github.com/private-face/jquery.bind-first/blob/master/dev/jquery.bind-first.js
    // jquery.bind-first.js
    /*
     * jQuery.bind-first library v0.2.3
     * Copyright (c) 2013 Vladimir Zhuravlev
     *
     * Released under MIT License
     * @license
     *
     * Date: Thu Feb  6 10:13:59 ICT 2014
     **/

    (function($) {
        var splitVersion = $.fn.jquery.split(".");
        var major = parseInt(splitVersion[0]);
        var minor = parseInt(splitVersion[1]);

        var JQ_LT_17 = (major < 1) || (major == 1 && minor < 7);

        function eventsData($el) {
            return JQ_LT_17 ? $el.data('events') : $._data($el[0]).events;
        }

        function moveHandlerToTop($el, eventName, isDelegated) {
            var data = eventsData($el);
            var events = data[eventName];

            if (!JQ_LT_17) {
                var handler = isDelegated ? events.splice(events.delegateCount - 1, 1)[0] : events.pop();
                events.splice(isDelegated ? 0 : (events.delegateCount || 0), 0, handler);

                return;
            }

            if (isDelegated) {
                data.live.unshift(data.live.pop());
            } else {
                events.unshift(events.pop());
            }
        }

        function moveEventHandlers($elems, eventsString, isDelegate) {
            var events = eventsString.split(/\s+/);
            $elems.each(function() {
                for (var i = 0; i < events.length; ++i) {
                    var pureEventName = $.trim(events[i]).match(/[^\.]+/i)[0];
                    moveHandlerToTop($(this), pureEventName, isDelegate);
                }
            });
        }

        function makeMethod(methodName) {
            $.fn[methodName + 'First'] = function() {
                var args = $.makeArray(arguments);
                var eventsString = args.shift();

                if (eventsString) {
                    $.fn[methodName].apply(this, arguments);
                    moveEventHandlers(this, eventsString);
                }

                return this;
            }
        }

        // bind
        makeMethod('bind');

        // one
        makeMethod('one');

        // delegate
        $.fn.delegateFirst = function() {
            var args = $.makeArray(arguments);
            var eventsString = args[1];

            if (eventsString) {
                args.splice(0, 2);
                $.fn.delegate.apply(this, arguments);
                moveEventHandlers(this, eventsString, true);
            }

            return this;
        };

        // live
        $.fn.liveFirst = function() {
            var args = $.makeArray(arguments);

            // live = delegate to the document
            args.unshift(this.selector);
            $.fn.delegateFirst.apply($(document), args);

            return this;
        };

        // on (jquery >= 1.7)
        if (!JQ_LT_17) {
            $.fn.onFirst = function(types, selector) {
                var $el = $(this);
                var isDelegated = typeof selector === 'string';

                $.fn.on.apply($el, arguments);

                // events map
                if (typeof types === 'object') {
                    for (var type in types)
                        if (types.hasOwnProperty(type)) {
                            moveEventHandlers($el, type, isDelegated);
                        }
                } else if (typeof types === 'string') {
                    moveEventHandlers($el, types, isDelegated);
                }

                return $el;
            };
        }

    })($);

    /*
     * jquery.simulate - simulate browser mouse and keyboard events
     *
     * Copyright (c) 2009 Eduardo Lundgren (eduardolundgren@gmail.com)
     * and Richard D. Worth (rdworth@gmail.com)
     *
     * Dual licensed under the MIT (http://www.opensource.org/licenses/mit-license.php)
     * and GPL (http://www.opensource.org/licenses/gpl-license.php) licenses.
     *
     */

    (function($) {

        $.fn.extend({
            simulate: function(type, options) {
                return this.each(function() {
                    var opt = $.extend({}, $.simulate.defaults, options || {});
                    new $.simulate(this, type, opt);
                });
            }
        });

        $.simulate = function(el, type, options) {
            this.target = el;
            this.options = options;

            if (/^drag$/.test(type)) {
                this[type].apply(this, [this.target, options]);
            } else {
                this.simulateEvent(el, type, options);
            }
        };

        $.extend($.simulate.prototype, {
            simulateEvent: function(el, type, options) {
                var evt = this.createEvent(type, options);
                this.dispatchEvent(el, type, evt, options);
                return evt;
            },
            createEvent: function(type, options) {
                if (/^mouse(over|out|down|up|move)|(dbl)?click$/.test(type)) {
                    return this.mouseEvent(type, options);
                } else if (/^key(up|down|press)$/.test(type)) {
                    return this.keyboardEvent(type, options);
                }
            },
            mouseEvent: function(type, options) {
                var evt;
                var e = $.extend({
                    bubbles: true, cancelable: (type != "mousemove"), view: window, detail: 0,
                    screenX: 0, screenY: 0, clientX: 0, clientY: 0,
                    ctrlKey: false, altKey: false, shiftKey: false, metaKey: false,
                    button: 0, relatedTarget: undefined
                }, options);

                var relatedTarget = $(e.relatedTarget)[0];

                if ($.isFunction(document.createEvent)) {
                    evt = document.createEvent("MouseEvents");
                    evt.initMouseEvent(type, e.bubbles, e.cancelable, e.view, e.detail,
                        e.screenX, e.screenY, e.clientX, e.clientY,
                        e.ctrlKey, e.altKey, e.shiftKey, e.metaKey,
                        e.button, e.relatedTarget || document.body.parentNode);
                } else if (document.createEventObject) {
                    evt = document.createEventObject();
                    $.extend(evt, e);
                    evt.button = { 0:1, 1:4, 2:2 }[evt.button] || evt.button;
                }
                return evt;
            },
            keyboardEvent: function(type, options) {
                var evt;

                var e = $.extend({ bubbles: true, cancelable: true, view: window,
                    ctrlKey: false, altKey: false, shiftKey: false, metaKey: false,
                    keyCode: 0, charCode: 0
                }, options);

                if ($.isFunction(document.createEvent)) {
                    try {
                        evt = document.createEvent("KeyEvents");
                        evt.initKeyEvent(type, e.bubbles, e.cancelable, e.view,
                            e.ctrlKey, e.altKey, e.shiftKey, e.metaKey,
                            e.keyCode, e.charCode);
                    } catch(err) {
                        evt = document.createEvent("Events");
                        evt.initEvent(type, e.bubbles, e.cancelable);
                        $.extend(evt, { view: e.view,
                            ctrlKey: e.ctrlKey, altKey: e.altKey, shiftKey: e.shiftKey, metaKey: e.metaKey,
                            keyCode: e.keyCode, charCode: e.charCode
                        });
                    }
                } else if (document.createEventObject) {
                    evt = document.createEventObject();
                    $.extend(evt, e);
                }
                if (($.browser !== undefined) && ($.browser.msie || $.browser.opera)) {
                    evt.keyCode = (e.charCode > 0) ? e.charCode : e.keyCode;
                    evt.charCode = undefined;
                }
                return evt;
            },

            dispatchEvent: function(el, type, evt) {
                if (el.dispatchEvent) {
                    el.dispatchEvent(evt);
                } else if (el.fireEvent) {
                    el.fireEvent('on' + type, evt);
                }
                return evt;
            },

            drag: function(el) {
                var self = this, center = this.findCenter(this.target),
                    options = this.options,	x = Math.floor(center.x), y = Math.floor(center.y),
                    dx = options.dx || 0, dy = options.dy || 0, target = this.target;
                var coord = { clientX: x, clientY: y };
                this.simulateEvent(target, "mousedown", coord);
                coord = { clientX: x + 1, clientY: y + 1 };
                this.simulateEvent(document, "mousemove", coord);
                coord = { clientX: x + dx, clientY: y + dy };
                this.simulateEvent(document, "mousemove", coord);
                this.simulateEvent(document, "mousemove", coord);
                this.simulateEvent(target, "mouseup", coord);
            },
            findCenter: function(el) {
                var el = $(this.target), o = el.offset();
                return {
                    x: o.left + el.outerWidth() / 2,
                    y: o.top + el.outerHeight() / 2
                };
            }
        });

        $.extend($.simulate, {
            defaults: {
                speed: 'sync'
            },
            VK_TAB: 9,
            VK_ENTER: 13,
            VK_ESC: 27,
            VK_PGUP: 33,
            VK_PGDN: 34,
            VK_END: 35,
            VK_HOME: 36,
            VK_LEFT: 37,
            VK_UP: 38,
            VK_RIGHT: 39,
            VK_DOWN: 40
        });

    })($);

}));