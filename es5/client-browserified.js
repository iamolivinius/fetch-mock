(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.fetchMock = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var FetchMock = require('./fetch-mock');
var statusTextMap = require('./status-text');

module.exports = new FetchMock({
	theGlobal: window,
	Request: window.Request,
	Response: window.Response,
	Headers: window.Headers,
	statusTextMap: statusTextMap
});

},{"./fetch-mock":2,"./status-text":3}],2:[function(require,module,exports){
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Headers = void 0;
var Request = void 0;
var Response = void 0;
var stream = void 0;
var theGlobal = void 0;
var statusTextMap = void 0;

/**
 * normalizeRequest
 * Given the parameters fetch was called with, normalises Request or url + options pairs
 * to a standard container object passed to matcher functions
 * @param  {String|Request} url
 * @param  {Object} 				options
 * @return {Object}         {url, method}
 */
function normalizeRequest(url, options) {
	if (Request.prototype.isPrototypeOf(url)) {
		return {
			url: url.url,
			method: url.method,
			headers: function () {
				var headers = {};
				url.headers.forEach(function (name) {
					return headers[name] = url.headers.name;
				});
				return headers;
			}()
		};
	} else {
		return {
			url: url,
			method: options && options.method || 'GET',
			headers: options && options.headers
		};
	}
}

function getHeaderMatcher(expectedHeaders) {
	var expectation = Object.keys(expectedHeaders).map(function (k) {
		return { key: k.toLowerCase(), val: expectedHeaders[k] };
	});
	return function (headers) {
		if (!headers) {
			headers = {};
		}
		var lowerCaseHeaders = Object.keys(headers).reduce(function (obj, k) {
			obj[k.toLowerCase()] = headers[k];
			return obj;
		}, {});
		return expectation.every(function (header) {
			return lowerCaseHeaders[header.key] === header.val;
		});
	};
}

/**
 * compileRoute
 * Given a route configuration object, validates the object structure and compiles
 * the object into a {name, matcher, response} triple
 * @param  {Object} route route config
 * @return {Object}       {name, matcher, response}
 */
function compileRoute(route) {

	if (typeof route.response === 'undefined') {
		throw new Error('Each route must define a response');
	}

	if (!route.matcher) {
		throw new Error('each route must specify a string, regex or function to match calls to fetch');
	}

	if (!route.name) {
		route.name = route.matcher.toString();
		route.__unnamed = true;
	}

	// If user has provided a function as a matcher we assume they are handling all the
	// matching logic they need
	if (typeof route.matcher === 'function') {
		return route;
	}

	var expectedMethod = route.method && route.method.toLowerCase();

	function matchMethod(method) {
		return !expectedMethod || expectedMethod === (method ? method.toLowerCase() : 'get');
	};

	var matchHeaders = route.headers ? getHeaderMatcher(route.headers) : function () {
		return true;
	};

	var matchUrl = void 0;

	if (typeof route.matcher === 'string') {

		if (route.matcher === '*') {
			matchUrl = function matchUrl() {
				return true;
			};
		} else if (route.matcher.indexOf('^') === 0) {
			(function () {
				var expectedUrl = route.matcher.substr(1);
				matchUrl = function matchUrl(url) {
					return url.indexOf(expectedUrl) === 0;
				};
			})();
		} else {
			(function () {
				var expectedUrl = route.matcher;
				matchUrl = function matchUrl(url) {
					return url === expectedUrl;
				};
			})();
		}
	} else if (route.matcher instanceof RegExp) {
		(function () {
			var urlRX = route.matcher;
			matchUrl = function matchUrl(url) {
				return urlRX.test(url);
			};
		})();
	}

	route.matcher = function (url, options) {
		var req = normalizeRequest(url, options);
		return matchHeaders(req.headers) && matchMethod(req.method) && matchUrl(req.url);
	};

	return route;
}

var FetchMock = function () {
	/**
  * constructor
  * Sets up scoped references to configuration passed in from client/server bootstrappers
  * @param  {Object} opts
  */
	function FetchMock(opts) {
		_classCallCheck(this, FetchMock);

		this.config = {
			sendAsJson: true
		};
		Headers = opts.Headers;
		Request = opts.Request;
		Response = opts.Response;
		stream = opts.stream;
		theGlobal = opts.theGlobal;
		statusTextMap = opts.statusTextMap;
		this.routes = [];
		this._calls = {};
		this._matchedCalls = [];
		this._unmatchedCalls = [];
		this.fetchMock = this.fetchMock.bind(this);
		this.restore = this.restore.bind(this);
		this.reset = this.reset.bind(this);
	}

	/**
  * mock
  * Replaces fetch with a stub which attempts to match calls against configured routes
  * See README for details of parameters
  * @return {FetchMock}          Returns the FetchMock instance, so can be chained
  */


	_createClass(FetchMock, [{
		key: 'mock',
		value: function mock(matcher, response, options) {

			var route = void 0;

			// Handle the variety of parameters accepted by mock (see README)

			// Old method matching signature
			if (options && /^[A-Z]+$/.test(response)) {
				throw new Error('The API for method matching has changed.\n\t\t\t\tNow use .get(), .post(), .put(), .delete() and .head() shorthand methods,\n\t\t\t\tor pass in, e.g. {method: \'PATCH\'} as a third paramter');
			} else if (options) {
				route = _extends({
					matcher: matcher,
					response: response
				}, options);
			} else if (matcher && response) {
				route = {
					matcher: matcher,
					response: response
				};
			} else if (matcher && matcher.matcher) {
				route = matcher;
			} else {
				throw new Error('Invalid parameters passed to fetch-mock');
			}

			this.addRoute(route);

			// Do this here rather than in the constructor to ensure it's scoped to the test
			this.realFetch = this.realFetch || theGlobal.fetch;
			theGlobal.fetch = this.fetchMock;
			return this;
		}
	}, {
		key: 'get',
		value: function get(matcher, response, options) {
			return this.mock(matcher, response, _extends({}, options, { method: 'GET' }));
		}
	}, {
		key: 'post',
		value: function post(matcher, response, options) {
			return this.mock(matcher, response, _extends({}, options, { method: 'POST' }));
		}
	}, {
		key: 'put',
		value: function put(matcher, response, options) {
			return this.mock(matcher, response, _extends({}, options, { method: 'PUT' }));
		}
	}, {
		key: 'delete',
		value: function _delete(matcher, response, options) {
			return this.mock(matcher, response, _extends({}, options, { method: 'DELETE' }));
		}
	}, {
		key: 'head',
		value: function head(matcher, response, options) {
			return this.mock(matcher, response, _extends({}, options, { method: 'HEAD' }));
		}
	}, {
		key: 'catch',
		value: function _catch(response) {
			if (this.fallbackResponse) {
				console.warn('calling fetchMock.catch() twice - are you sure you want to overwrite the previous fallback response');
			}
			this.fallbackResponse = response || 'ok';
			return this;
		}

		/**
   * constructMock
   * Constructs a function which attempts to match fetch calls against routes (see constructRouter)
   * and handles success or failure of that attempt accordingly
   * @param  {Object} config See README
   * @return {Function}      Function expecting url + options or a Request object, and returning
   *                         a promise of a Response, or forwading to native fetch
   */

	}, {
		key: 'fetchMock',
		value: function fetchMock(url, opts) {
			var _this = this;

			var response = this.router(url, opts);

			if (!response) {
				console.warn('unmatched call to ' + url);
				this.push(null, [url, opts]);

				if (this.fallbackResponse) {
					response = this.fallbackResponse;
				} else {
					throw new Error('unmatched call to ' + url);
				}
			}

			if (typeof response === 'function') {
				response = response(url, opts);
			}

			if (response instanceof Promise) {
				return response.then(function (response) {
					return _this.mockResponse(url, response, opts);
				});
			} else {
				return this.mockResponse(url, response, opts);
			}
		}

		/**
   * router
   * Given url + options or a Request object, checks to see if ait is matched by any routes and returns
   * config for a response or undefined.
   * @param  {String|Request} url
   * @param  {Object}
   * @return {Object}
   */

	}, {
		key: 'router',
		value: function router(url, opts) {
			var route = void 0;
			for (var i = 0, il = this.routes.length; i < il; i++) {
				route = this.routes[i];
				if (route.matcher(url, opts)) {
					this.push(route.name, [url, opts]);
					return route.response;
				}
			}
		}

		/**
   * addRoutes
   * Adds routes to those used by fetchMock to match fetch calls
   * @param  {Object|Array} routes 	route configurations
   */

	}, {
		key: 'addRoute',
		value: function addRoute(route) {

			if (!route) {
				throw new Error('.mock() must be passed configuration for a route');
			}

			// Allows selective application of some of the preregistered routes
			this.routes.push(compileRoute(route));
		}

		/**
   * mockResponse
   * Constructs a Response object to return from the mocked fetch
   * @param  {String} url    url parameter fetch was called with
   * @param  {Object} config configuration for the response to be constructed
   * @return {Promise}       Promise for a Response object (or a rejected response to imitate network failure)
   */

	}, {
		key: 'mockResponse',
		value: function mockResponse(url, responseConfig, fetchOpts) {

			// It seems odd to call this in here even though it's already called within fetchMock
			// It's to handle the fact that because we want to support making it very easy to add a
			// delay to any sort of response (including responses which are defined with a function)
			// while also allowing function responses to return a Promise for a response config.
			if (typeof responseConfig === 'function') {
				responseConfig = responseConfig(url, fetchOpts);
			}

			if (Response.prototype.isPrototypeOf(responseConfig)) {
				return Promise.resolve(responseConfig);
			}

			if (responseConfig.throws) {
				return Promise.reject(responseConfig.throws);
			}

			if (typeof responseConfig === 'number') {
				responseConfig = {
					status: responseConfig
				};
			} else if (typeof responseConfig === 'string' || !(responseConfig.body || responseConfig.headers || responseConfig.throws || responseConfig.status)) {
				responseConfig = {
					body: responseConfig
				};
			}

			var opts = responseConfig.opts || {};
			opts.url = url;
			opts.sendAsJson = responseConfig.sendAsJson === undefined ? this.config.sendAsJson : responseConfig.sendAsJson;
			if (responseConfig.status && (typeof responseConfig.status !== 'number' || parseInt(responseConfig.status, 10) !== responseConfig.status || responseConfig.status < 200 || responseConfig.status > 599)) {
				throw new TypeError('Invalid status ' + responseConfig.status + ' passed on response object.\nTo respond with a JSON object that has status as a property assign the object to body\ne.g. {"body": {"status: "registered"}}');
			}
			opts.status = responseConfig.status || 200;
			opts.statusText = statusTextMap['' + opts.status];
			// The ternary operator is to cope with new Headers(undefined) throwing in Chrome
			// https://code.google.com/p/chromium/issues/detail?id=335871
			opts.headers = responseConfig.headers ? new Headers(responseConfig.headers) : new Headers();

			var body = responseConfig.body;
			if (opts.sendAsJson && responseConfig.body != null && (typeof body === 'undefined' ? 'undefined' : _typeof(body)) === 'object') {
				//eslint-disable-line
				body = JSON.stringify(body);
			}

			if (stream) {
				var s = new stream.Readable();
				if (body != null) {
					//eslint-disable-line
					s.push(body, 'utf-8');
				}
				s.push(null);
				body = s;
			}

			return Promise.resolve(new Response(body, opts));
		}

		/**
   * push
   * Records history of fetch calls
   * @param  {String} name Name of the route matched by the call
   * @param  {Array} call [url, opts] pair
   */

	}, {
		key: 'push',
		value: function push(name, call) {
			if (name) {
				this._calls[name] = this._calls[name] || [];
				this._calls[name].push(call);
				this._matchedCalls.push(call);
			} else {
				this._unmatchedCalls.push(call);
			}
		}

		/**
   * restore
   * Restores global fetch to its initial state and resets call history
   */

	}, {
		key: 'restore',
		value: function restore() {
			if (this.realFetch) {
				theGlobal.fetch = this.realFetch;
				this.realfetch = null;
			}
			this.fallbackResponse = null;
			this.reset();
			this.routes = [];
			return this;
		}

		/**
   * reset
   * Resets call history
   */

	}, {
		key: 'reset',
		value: function reset() {
			this._calls = {};
			this._matchedCalls = [];
			this._unmatchedCalls = [];
			return this;
		}

		/**
   * calls
   * Returns call history. See README
   */

	}, {
		key: 'calls',
		value: function calls(name) {
			return name ? this._calls[name] || [] : {
				matched: this._matchedCalls,
				unmatched: this._unmatchedCalls
			};
		}
	}, {
		key: 'lastCall',
		value: function lastCall(name) {
			var calls = name ? this.calls(name) : this.calls().matched;
			if (calls && calls.length) {
				return calls[calls.length - 1];
			} else {
				return undefined;
			}
		}
	}, {
		key: 'lastUrl',
		value: function lastUrl(name) {
			var call = this.lastCall(name);
			return call && call[0];
		}
	}, {
		key: 'lastOptions',
		value: function lastOptions(name) {
			var call = this.lastCall(name);
			return call && call[1];
		}

		/**
   * called
   * Returns whether fetch has been called matching a configured route. See README
   */

	}, {
		key: 'called',
		value: function called(name) {
			if (!name) {
				return !!this._matchedCalls.length;
			}
			return !!(this._calls[name] && this._calls[name].length);
		}
	}, {
		key: 'configure',
		value: function configure(opts) {
			_extends(this.config, opts);
		}
	}]);

	return FetchMock;
}();

module.exports = FetchMock;

},{}],3:[function(require,module,exports){
'use strict';

var statusTextMap = {
  '100': 'Continue',
  '101': 'Switching Protocols',
  '102': 'Processing',
  '200': 'OK',
  '201': 'Created',
  '202': 'Accepted',
  '203': 'Non-Authoritative Information',
  '204': 'No Content',
  '205': 'Reset Content',
  '206': 'Partial Content',
  '207': 'Multi-Status',
  '208': 'Already Reported',
  '226': 'IM Used',
  '300': 'Multiple Choices',
  '301': 'Moved Permanently',
  '302': 'Found',
  '303': 'See Other',
  '304': 'Not Modified',
  '305': 'Use Proxy',
  '307': 'Temporary Redirect',
  '308': 'Permanent Redirect',
  '400': 'Bad Request',
  '401': 'Unauthorized',
  '402': 'Payment Required',
  '403': 'Forbidden',
  '404': 'Not Found',
  '405': 'Method Not Allowed',
  '406': 'Not Acceptable',
  '407': 'Proxy Authentication Required',
  '408': 'Request Timeout',
  '409': 'Conflict',
  '410': 'Gone',
  '411': 'Length Required',
  '412': 'Precondition Failed',
  '413': 'Payload Too Large',
  '414': 'URI Too Long',
  '415': 'Unsupported Media Type',
  '416': 'Range Not Satisfiable',
  '417': 'Expectation Failed',
  '418': 'I\'m a teapot',
  '421': 'Misdirected Request',
  '422': 'Unprocessable Entity',
  '423': 'Locked',
  '424': 'Failed Dependency',
  '425': 'Unordered Collection',
  '426': 'Upgrade Required',
  '428': 'Precondition Required',
  '429': 'Too Many Requests',
  '431': 'Request Header Fields Too Large',
  '451': 'Unavailable For Legal Reasons',
  '500': 'Internal Server Error',
  '501': 'Not Implemented',
  '502': 'Bad Gateway',
  '503': 'Service Unavailable',
  '504': 'Gateway Timeout',
  '505': 'HTTP Version Not Supported',
  '506': 'Variant Also Negotiates',
  '507': 'Insufficient Storage',
  '508': 'Loop Detected',
  '509': 'Bandwidth Limit Exceeded',
  '510': 'Not Extended',
  '511': 'Network Authentication Required'
};

module.exports = statusTextMap;

},{}]},{},[1])(1)
});