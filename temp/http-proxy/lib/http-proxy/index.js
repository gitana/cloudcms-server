"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServer = exports.createProxy = exports.createProxyServer = exports.ProxyServerNew = void 0;
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const url_1 = require("url");
const eventemitter3_1 = __importDefault(require("eventemitter3"));
const web_incoming_1 = __importDefault(require("./passes/web-incoming"));
const ws_incoming_1 = __importDefault(require("./passes/ws-incoming"));
/**
 * Returns a function that creates the loader for
 * either `ws` or `web`'s  passes.
 *
 * Examples:
 *
 *    createRightProxy('ws')
 *    // => [Function]
 *
 * @param type
 *
 * @return Loader function that when called returns an iterator for the right passes
 *
 * @api private
 */
function createRightProxy(type) {
    return function (options) {
        return function (req, resOrSocket) {
            const passes = type === 'ws' ? this.wsPasses : this.webPasses, 
            // TODO: Migrate away from arguments.
            // eslint-disable-next-line prefer-rest-params
            args = [].slice.call(arguments);
            let cntr = args.length - 1, head, cbl;
            /* optional args parse begin */
            if (typeof args[cntr] === 'function') {
                cbl = args[cntr];
                cntr--;
            }
            let requestOptions = options;
            if (!(args[cntr] instanceof Buffer) && args[cntr] !== resOrSocket) {
                //Copy global options
                requestOptions = Object.assign({}, options);
                //Overwrite with request options
                Object.assign(requestOptions, args[cntr]);
                cntr--;
            }
            if (args[cntr] instanceof Buffer) {
                head = args[cntr];
            }
            /* optional args parse end */
            ['target', 'forward'].forEach(function (e) {
                if (typeof requestOptions[e] === 'string')
                    requestOptions[e] = (0, url_1.parse)(requestOptions[e]);
            });
            if (!requestOptions.target && !requestOptions.forward) {
                this.emit('error', new Error('Must provide a proper URL as target'));
                return;
            }
            for (let i = 0; i < passes.length; i++) {
                /**
                 * Call of passes functions
                 * pass(req, res, options, head)
                 *
                 * In WebSockets case the `res` variable
                 * refer to the connection socket
                 * pass(req, socket, options, head)
                 */
                // TODO: Figure out the typing here.
                // @ts-ignore
                if (passes[i](req, resOrSocket, requestOptions, head, this, cbl)) {
                    // passes can return a truthy value to halt the loop
                    break;
                }
            }
        };
    };
}
class ProxyServerNew extends eventemitter3_1.default {
    constructor(options) {
        super();
        options = options || {};
        options.prependPath = options.prependPath !== false;
        this.web = createRightProxy('web')(options);
        this.ws = createRightProxy('ws')(options);
        this.options = options;
        this.webPasses = Object.keys(web_incoming_1.default).map(function (pass) {
            // TODO: Figure out the typing here.
            return web_incoming_1.default[pass];
        });
        this.wsPasses = Object.keys(ws_incoming_1.default).map(function (pass) {
            // TODO: Figure out the typing here.
            return ws_incoming_1.default[pass];
        });
        this.on('error', this.onError, this);
    }
    after(type, passName, callback) {
        const passes = type === 'ws' ? this.wsPasses : this.webPasses;
        let i = -1;
        passes.forEach((v, idx) => {
            if (v.name === passName)
                i = idx;
        });
        if (i === -1)
            throw new Error('No such pass');
        passes.splice(i++, 0, callback);
    }
    before(type, passName, callback) {
        const passes = type === 'ws' ? this.wsPasses : this.webPasses;
        let i = -1;
        passes.forEach((v, idx) => {
            if (v.name === passName)
                i = idx;
        });
        if (i === -1)
            throw new Error('No such pass');
        passes.splice(i, 0, callback);
    }
    close(callback) {
        if (this._server) {
            this._server.close(() => {
                this._server = undefined;
                callback?.();
            });
        }
    }
    listen(port, hostname) {
        const closure = (req, res) => {
            this.web(req, res);
        };
        const server = this.options.ssl
            ? https_1.default.createServer(this.options.ssl, closure)
            : http_1.default.createServer(closure);
        if (this.options.ws) {
            server.on('upgrade', (req, socket, head) => {
                this.ws(req, socket, head);
            });
        }
        server.listen(port, hostname);
        this._server = server;
        return this;
    }
    onError(err) {
        //
        // Remark: Replicate node core behavior using EE3
        // so we force people to handle their own errors
        //
        if (super.listeners('error').length === 1) {
            throw err;
        }
    }
}
exports.ProxyServerNew = ProxyServerNew;
/**
 * Creates the proxy server.
 *
 * Examples:
 *
 *    httpProxy.createServer({ .. }, 8000)
 *    // => '{ web: [Function], ws: [Function] ... }'
 *
 * @param options Config object passed to the proxy
 *
 * @return Proxy object with handlers for `ws` and `web` requests
 *
 * @api public
 */
function createProxyServer(options) {
    return new ProxyServerNew(options);
}
exports.createProxyServer = createProxyServer;
exports.createProxy = createProxyServer;
exports.createServer = createProxyServer;
