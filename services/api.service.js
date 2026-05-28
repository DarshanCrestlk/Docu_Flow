/* eslint-disable no-empty */
"use strict";
const multer = require("multer");
const storage = multer.memoryStorage();
const ApiGateway = require("moleculer-web");
const routes = require("../routes/routes");
const helperMixin = require("../mixins/helper.mixin");
const IO = require("socket.io");
const { instrument } = require("@socket.io/admin-ui");
const compression = require("compression");
const path = require("path");

const { MoleculerClientError, ServiceNotFoundError } =
	require("moleculer").Errors;
/**
 * @typedef {import('moleculer').ServiceSchema} ServiceSchema Moleculer's Service Schema
 * @typedef {import('moleculer').Context} Context Moleculer's Context
 * @typedef {import('http').IncomingMessage} IncomingRequest Incoming HTTP Request
 * @typedef {import('http').ServerResponse} ServerResponse HTTP Server Response
 * @typedef {import('moleculer-web').ApiSettingsSchema} ApiSettingsSchema API Setting Schema
 */

module.exports = {
	name: "api",
	mixins: [ApiGateway, helperMixin],

	/** @type {ApiSettingsSchema} More info about settings: https://moleculer.services/docs/0.14/moleculer-web.html */
	settings: {
		// Exposed port
		port: process.env.PORT || 3001,

		// Exposed IP
		ip: "0.0.0.0",

		// Global Express middlewares. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Middlewares
		use: [compression(1)],

		routes: [
			{
				path: "/api",

				whitelist: ["**"],

				// Enable/disable parameter merging method. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Disable-merging
				mergeParams: true,

				// Enable authentication. Implement the logic into `authenticate` method. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Authentication
				authentication: false,
				authorization: true,
				// Enable authorization. Implement the logic into `authorize` method. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Authorization

				// The auto-alias feature allows you to declare your route alias directly in your services.
				// The gateway will dynamically build the full routes from service schema.
				autoAliases: false,

				aliases: {
					...routes,

					"POST /s3/upload": {
						type: "multipart",
						busboyConfig: {
							limits: {
								files: 1,
								fileSize: 50 * 1024 * 1024, // 50MB
							},
							onPartsLimit(busboy, alias, svc) {
								this.logger.info("Busboy parts limit!", busboy);
							},
							onFilesLimit(busboy, alias, svc) {
								console.log("Busboy file limit reached!");
								// Emitting an error will cancel further processing
								busboy.emit(
									"error",
									new Error(
										"Too many files uploaded. Maximum 1 files allowed."
									)
								);
							},
							onFileSizeLimit(busboy, alias, svc) {
								console.log("Busboy file size limit reached!");
								busboy.emit(
									"error",
									new Error(
										"File size exceeds the 50MB limit."
									)
								);
							},
							onFieldsLimit(busboy, alias, svc) {
								this.logger.info(
									"Busboy fields limit!",
									busboy
								);
							},
						},
						action: "s3.uploadToS3",
					},
					// "POST /pdf-forms/fill-pdf-form-sign": {
					// 	type: "multipart",
					// 	busboyConfig: {
					// 		limits: {
					// 			files: 4,
					// 			fileSize: 50 * 1024 * 1024, // 50MB
					// 		},
					// 		onPartsLimit(busboy, alias, svc) {
					// 			this.logger.info("Busboy parts limit!", busboy);
					// 		},
					// 		onFilesLimit(busboy, alias, svc) {
					// 			this.logger.info("Busboy file limit!", busboy);
					// 		},
					// 		onFileSizeLimit(busboy, alias, svc) {
					// 			this.logger.info(
					// 				"Busboy file size limit!",
					// 				busboy
					// 			);
					// 		},
					// 		onFieldsLimit(busboy, alias, svc) {
					// 			this.logger.info(
					// 				"Busboy fields limit!",
					// 				busboy
					// 			);
					// 		},
					// 	},
					// 	action: "pdfForms.fillFormFields",
					// },

					"POST /s3/update": {
						type: "multipart",
						busboyConfig: {
							limits: {
								files: 1,
								fileSize: 50 * 1024 * 1024, // 50MB
							},
							onPartsLimit(busboy, alias, svc) {
								this.logger.info("Busboy parts limit!", busboy);
							},
							onFilesLimit(busboy, alias, svc) {
								this.logger.info("Busboy file limit!", busboy);
							},
							onFileSizeLimit(busboy, alias, svc) {
								this.logger.info(
									"Busboy file size limit!",
									busboy
								);
							},
							onFieldsLimit(busboy, alias, svc) {
								this.logger.info(
									"Busboy fields limit!",
									busboy
								);
							},
						},
						action: "s3.updateToS3",
					},
					// "POST /pdf-form-s3/upload": {
					// 	type: "multipart",
					// 	busboyConfig: {
					// 		limits: {
					// 			files: 5,
					// 			fileSize: 50 * 1024 * 1024, // 50MB
					// 		},
					// 		onPartsLimit(busboy, alias, svc) {
					// 			this.logger.info("Busboy parts limit!", busboy);
					// 		},
					// 		onFilesLimit(busboy, alias, svc) {
					// 			this.logger.info("Busboy file limit!", busboy);
					// 		},
					// 		onFileSizeLimit(busboy, alias, svc) {
					// 			this.logger.info(
					// 				"Busboy file size limit!",
					// 				busboy
					// 			);
					// 		},
					// 		onFieldsLimit(busboy, alias, svc) {
					// 			this.logger.info(
					// 				"Busboy fields limit!",
					// 				busboy
					// 			);
					// 		},
					// 	},
					// 	action: "s3.uploadToS3",
					// },
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
				callingOptions: {},

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
				// Set CORS headers
				cors: {
					// Configures the Access-Control-Allow-Origin CORS header.
					origin: "*",
					// Configures the Access-Control-Allow-Methods CORS header.
					methods: ["GET", "OPTIONS", "POST", "PUT", "DELETE"],
					// Configures the Access-Control-Allow-Headers CORS header.
					allowedHeaders: [
						"x_authorization", //--- for e-forms  NOT REMOVE THIS LINE
						"x-domain",
						"Content-Type",
						"Authorization",
						"cash_register_id",
						"store_id",
						"x-industry",
						"platform",
						"version",
						"ngrok-skip-browser-warning", // After MS office plug release Please remove this line
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

		// 	if (req.$endpoint.action.authentication !== "disabled") {
		// 		console.log("Inside authentication logic");
		// 	} else {
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
				// Get the authenticated user.
				// ctx.meta.req = req;
				ctx.meta.origin = req.headers.origin;

				//check whether its office api or not
				let fetchedToken = req.headers.authorization
					? req.headers.authorization.split(" ")[1]
					: null;

				if (req.headers.x_authorization) {
					fetchedToken = req.headers.x_authorization.split(" ")[1];
				}

				if (fetchedToken === "office") {
					try {
						let encodedString =
							req.headers.authorization.split(" ")[2];
						const decodedString = Buffer.from(
							encodedString,
							"base64"
						).toString();
						const fid = decodedString.split(" ")[1];
						const appKey = decodedString.split(" ")[0];

						const authorDetails = await this.broker.call(
							"documents.checkAppKey",
							{
								appKey: appKey,
								fid: fid,
							}
						);

						const user = await this.broker.call("users.getById", {
							id: authorDetails?.data?.user_id,
							company_id: authorDetails?.data?.company_id,
						});

						ctx.meta.user = user.data;
						ctx.meta.company_id = authorDetails?.data?.company_id;
						ctx.params.company_id = user.data.company_id;
						ctx.meta.officeAPI = true;
					} catch (error) {
						throw new MoleculerClientError(
							"Your session has been expired. Please login again",
							401
						);
					}
				} else if (fetchedToken === "pdf-editor") {
					try {
						const token = req.$params.token
							? req.$params.token
							: null;

						if (token) {
							// check if token is exists or not
							const tokenDetails = await this.broker.call(
								"documents.getValidatePdfToken",
								{
									token,
								}
							);

							if (tokenDetails?.code !== 200) {
								throw new MoleculerClientError(
									"Your session has been expired. Please login again",
									401
								);
							} else {
								const user = await this.broker.call(
									"users.getById",
									{
										id: tokenDetails?.data?.user_id,
										company_id:
											tokenDetails?.data?.company_id,
									}
								);
								if (!user.data || !user?.data?.status) {
									throw new MoleculerClientError(
										"Your session has been expired. Please login again",
										401
									);
								}

								ctx.meta.user = user.data;
								ctx.meta.company_id = user.data.company_id;
								ctx.params.company_id = user.data.company_id;
							}
						} else {
							// throw new Error("Unauthorized");
							throw new MoleculerClientError(
								"Your session has been expired. Please login again",
								401
							);
							// return null;
						}
					} catch (error) {
						throw new MoleculerClientError(
							"Your session has been expired. Please login again",
							401
						);
					}
				}  else {
					// const fetchedToken = req.headers.authorization
					// 	? req.headers.authorization.split(" ")[1]
					// 	: null;
					if (fetchedToken) {
						ctx.meta.token = fetchedToken;
					}

					// It check the `auth` property in action schema.
					if (
						req.$endpoint.action.authorization === false ||
						req.$endpoint.action.name === "$node.actions" ||
						req.$endpoint.action.name === "$node.options" ||
						req.$endpoint.action.name === "$node.services" ||
						req.$endpoint.action.name === "$node.list"
					) {
						return null;
					} else {
						const token = req.headers.authorization
							? req.headers.authorization.split(" ")[1]
							: null;
						if (token) {
							const decoded = await this.verifyJWT(token);
							const user = await this.broker.call(
								"users.getById",
								{
									id: decoded.id,
									company_id: decoded.company_id,
								}
							);
							if (!user.data || !user?.data?.status) {
								throw new MoleculerClientError(
									"Your session has been expired. Please login again",
									401
								);
							}
							ctx.meta.user = user.data;
							ctx.meta.company_id = decoded.company_id;
							ctx.params.company_id = user.data.company_id;
							// ctx.meta.io = this.io;
							// ctx.meta.socket = this.socket;
						} else {
							// throw new Error("Unauthorized");
							throw new MoleculerClientError(
								"Your session has been expired. Please login again",
								401
							);
							// return null;
						}
					}
				}
			} catch (error) {
				throw new MoleculerClientError(
					"Your session has been expired. Please login again",
					401
				);
			}
		},
	},
	events: {
	},

	actions: {
		/**
		 * Check whether the sender (admin/employer) currently has their
		 * LocationVerificationSpinner open for the given formId.
		 * Called by i9Forms.validateGeoFencing before processing the employee request.
		 */
		checkSenderPresence: {
			authorization: false,
			params: {
				formId: { type: "any" },
			},
			handler(ctx) {
				const formId = String(ctx.params.formId);
				const isActive = this.activeSenderSessions.has(formId);
				this.logger.info(
					`checkSenderPresence for formId=${formId}: ${isActive}`
				);
				return { isActive };
			},
		},
	},

	started() {
		// In-memory set of formIds where the sender tab is currently open
		// (spinner visible). Populated by socket events; cleaned up on disconnect.
		this.activeSenderSessions = new Set();

		// Create a Socket.IO instance, passing it our server
		this.io = new IO.Server(this.server, {
			cors: {
				origin: [process.env.CLIENT_URL, "https://admin.socket.io"],
				methods: ["GET", "POST"],
				credentials: true,
			},
		});

		if (process.env.SOCKET_ADMIN_ENABLE === "true") {
			instrument(this.io, {
				auth: false,
				readonly: true,
				mode: "development",
			});
		}

		// Add a connect listener
		this.io.on("connection", (client) => {
			this.socket = client;
			this.logger.info("Client connected via websocket!", client.id);

			client.emit("welcome", "Welcome to DocuFlow", (res) => {
				this.logger.info("welcome event response from client", res);
			});

			client.on("join_room", (roomId, clb) => {
				const strRoomId = String(roomId);
				client.join(strRoomId);
				clb(`User joined to room: ${strRoomId}`);
			});

			client.on("disconnect", () => {
				this.logger.info("Client disconnected", client.id);
			});
		});
	},
};
