"use strict";

const ApiGateway = require("moleculer-web");
const routes = require("../routes/routes");
const IO = require("socket.io");
const { instrument } = require("@socket.io/admin-ui");
const compression = require("compression");
const helperMixin = require("../mixins/helper.mixin");
const path = require("path");
/**
 * @typedef {import('moleculer').ServiceSchema} ServiceSchema Moleculer's Service Schema
 * @typedef {import('moleculer').Context} Context Moleculer's Context
 * @typedef {import('http').IncomingMessage} IncomingRequest Incoming HTTP Request
 * @typedef {import('http').ServerResponse} ServerResponse HTTP Server Response
 * @typedef {import('moleculer-web').ApiSettingsSchema} ApiSettingsSchema API Setting Schema
 */

const { MoleculerClientError, ServiceNotFoundError } =
	require("moleculer").Errors;

module.exports = {
	name: "api",
	mixins: [ApiGateway,helperMixin],

	/** @type {ApiSettingsSchema} More info about settings: https://moleculer.services/docs/0.14/moleculer-web.html */
	settings: {
		// Exposed port
		port: process.env.PORT || 3000,

		// Exposed IP
		ip: "0.0.0.0",

		// Global Express middlewares. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Middlewares
		use: [compression(1)],

		routes: [
			{
				path: "/api",

				whitelist: ["**"],

				// Route-level Express middlewares. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Middlewares
				// use: [],

				// Enable/disable parameter merging method. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Disable-merging
				mergeParams: true,

				// Enable authentication. Implement the logic into `authenticate` method. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Authentication
				authentication: false,

				// Enable authorization. Implement the logic into `authorize` method. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Authorization
				authorization: true,

				// The auto-alias feature allows you to declare your route alias directly in your services.
				// The gateway will dynamically build the full routes from service schema.
				autoAliases: false,

				aliases: {
					...routes,
				},

				/**
				 * Before call hook. You can check the request.
				 * @param {Context} ctx
				 * @param {Object} route
				 * @param {IncomingRequest} req
				 * @param {ServerResponse} res
				 * @param {Object} data
				 *
				onBeforeCall(ctx, route, req, res) {
					// Set request headers to context meta
					ctx.meta.userAgent = req.headers["user-agent"];
				}, */

				onBeforeCall(ctx, route, req, res) {
					this.logger.info("onBeforeCall req.headers", req.headers);

					ctx.meta.ip =
						req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
						req.connection?.remoteAddress ||
						req.socket?.remoteAddress ||
						req.connection?.socket?.remoteAddress;
					ctx.meta.userAgent = req.headers["user-agent"];
					res.setHeader("X-Robots-Tag", "noindex, nofollow");
				},

				/**
				 * After call hook. You can modify the data.
				 * @param {Context} ctx
				 * @param {Object} route
				 * @param {IncomingRequest} req
				 * @param {ServerResponse} res
				 * @param {Object} data
				onAfterCall(ctx, route, req, res, data) {
					// Async function which return with Promise
					return doSomething(ctx, res, data);
				}, */

				// Calling options. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Calling-options
				callOptions: {},

				bodyParsers: {
					json: {
						strict: false,
						limit: "10MB",
					},
					urlencoded: {
						extended: true,
						limit: "10MB",
					},
				},

				// Mapping policy setting. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Mapping-policy
				mappingPolicy: "restrict", // Available values: "all", "restrict"

				cors: {
					// Configures the Access-Control-Allow-Origin CORS header.
					origin: "*",
					// Configures the Access-Control-Allow-Methods CORS header.
					methods: ["GET", "OPTIONS", "POST", "PUT", "DELETE"],
					// Configures the Access-Control-Allow-Headers CORS header.
					allowedHeaders: [
						"x-domain",
						"Content-Type",
						"Authorization",
						"cash_register_id",
						"store_id",
						"x-industry",
						"platform",
						"version",
					],
					// Configures the Access-Control-Expose-Headers CORS header.
					exposedHeaders: [],
					// Configures the Access-Control-Allow-Credentials CORS header.
					credentials: false,
					// Configures the Access-Control-Max-Age CORS header.
					maxAge: 3600,
				},

				// Enable/disable logging
				logging: true,
			},
			{
				path: "/assets",
				assets: {
					folder: path.join(__dirname, "../public"),
					dotfiles: "ignore", // Options: "allow", "deny", "ignore"
					etag: true, // Enable ETag headers
					maxAge: "1d", // Cache-Control max-age in milliseconds or string
					index: false, // Disable index.html fallback
				},
			},
		],

		// Do not log client side errors (does not log an error response when the error.code is 400<=X<500)
		log4XXResponses: false,
		// Logging the request parameters. Set to any log level to enable it. E.g. "info"
		logRequestParams: "info",
		// Logging the response data. Set to any log level to enable it. E.g. "info"
		logResponseData: "info",

		// Serve assets from "public" folder. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Serve-static-files
		assets: {
			folder: "public",

			// Options to `server-static` module
			options: {},
		},
	},

	methods: {
		/**
		 * Authenticate the request. It check the `Authorization` token value in the request header.
		 * Check the token value & resolve the user by the token.
		 * The resolved user will be available in `ctx.meta.user`
		 *
		 * PLEASE NOTE, IT'S JUST AN EXAMPLE IMPLEMENTATION. DO NOT USE IN PRODUCTION!
		 *
		 * @param {Context} ctx
		 * @param {Object} route
		 * @param {IncomingRequest} req
		 * @returns {Promise}
		 */
		// async authenticate(ctx, route, req) {
		// 	// Read the token from header
		// 	const auth = req.headers["authorization"];

		// 	if (auth && auth.startsWith("Bearer")) {
		// 		const token = auth.slice(7);

		// 		// Check the token. Tip: call a service which verify the token. E.g. `accounts.resolveToken`
		// 		if (token == "123456") {
		// 			// Returns the resolved user. It will be set to the `ctx.meta.user`
		// 			return { id: 1, name: "John Doe" };

		// 		} else {
		// 			// Invalid token
		// 			throw new ApiGateway.Errors.UnAuthorizedError(ApiGateway.Errors.ERR_INVALID_TOKEN);
		// 		}

		// 	} else {
		// 		// No token. Throw an error or do nothing if anonymous access is allowed.
		// 		// throw new E.UnAuthorizedError(E.ERR_NO_TOKEN);
		// 		return null;
		// 	}
		// },

		/**
		 * Authorize the request. Check that the authenticated user has right to access the resource.
		 *
		 * PLEASE NOTE, IT'S JUST AN EXAMPLE IMPLEMENTATION. DO NOT USE IN PRODUCTION!
		 *
		 * @param {Context} ctx
		 * @param {Object} route
		 * @param {IncomingRequest} req
		 * @returns {Promise}
		 */
		async authorize(ctx, route, req) {
			try {
				ctx.meta.origin = req.headers.origin;

				// It check the `auth` property in action schema.
				if (req.$action.auth == "required" && !ctx.meta.user) {
					throw new ApiGateway.Errors.UnAuthorizedError("NO_RIGHTS");
				}	
			} catch (error) {
				throw new MoleculerClientError(
					"Your session has been expired. Please login again",
					401
				);
			}
			// Get the authenticated user.
			
		},
	},
	started() {
		// Create a Socket.IO instance, passing it our server
		this.io = new IO.Server(this.server, {
			cors: {
				origin: [process.env.CLIENT_URL, "https://admin.socket.io"],
				methods: ["GET", "POST"],
				credentials: true,
			},
		});

		instrument(this.io, {
			auth: false,
			readonly: true,
			mode: "development",
		});

		// Add a connect listener
		this.io.on("connection", (client) => {
			this.socket = client;
			this.logger.info("Client connected via websocket!", client.id);

			client.emit("welcome", "Welcome to HRMS", (res) => {
				this.logger.info("welcome event response from client", res);
			});


			client.on("disconnect", () => {
				this.logger.info("Client disconnected", client.id);
			});
		});
	},
};
