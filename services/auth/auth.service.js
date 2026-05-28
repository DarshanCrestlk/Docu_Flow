"use strict";

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const RESPONSES = require("../../config/constants/messages");
const modelRelationsmixin = require("../../mixins/db/modelRelations.mixin");

module.exports = {
	name: "auth",

	settings: {},

	mixins: [modelRelationsmixin],

	actions: {
		login: {
			authorization: false,
			params: {
				email: { type: "email", normalize: true },
				password: { type: "string", min: 1, max: 128 },
				company_id: {
					type: "string",
					integer: true,
					positive: true,
					optional: true,
				},
				company_domain: {
					type: "string",
					optional: true,
					trim: true,
					max: 255,
				},
			},
			async handler(ctx) {
				return this.login(ctx);
			},
		},
		// officeLogin: {
		// 	authorization: false,
		// 	rest: {
		// 		method: "POST",
		// 		path: "/office-login",
		// 	},
		// 	// params: {
		// 	// 	serverurl: { type: "string", min: 1, max: 500, trim: true },
		// 	// 	email: { type: "email", normalize: true },
		// 	// 	password: { type: "string", min: 1, max: 128 },
		// 	// 	timezone: {
		// 	// 		type: "string",
		// 	// 		optional: true,
		// 	// 		trim: true,
		// 	// 		max: 120,
		// 	// 	},
		// 	// },
		// 	async handler(ctx) {
		// 		return this.officeLogin(ctx);
		// 	},
		// },
	},

	methods: {
		normalizeCompanyDomain(serverurl) {
			if (!serverurl || typeof serverurl !== "string") return null;
			const trimmed = serverurl.trim();
			const withoutProtocol = trimmed.replace(/^https?:\/\//i, "");
			const host = withoutProtocol.split("/")[0].toLowerCase();

			// Existing office local mapping for development use.
			if (host === "localhost:3005") return "devecs.slicehr.com";
			return host || null;
		},

		async login(ctx) {
			try {
				const { email, password, company_id, company_domain } =
					ctx.params;

				if (!process.env.JWT_SECRET) {
					return {
						code: RESPONSES.status.error,
						message: "JWT secret is not configured",
					};
				}

				let resolvedCompanyId = company_id || null;

				if (!resolvedCompanyId && company_domain) {
					const company =
						await this.settings.models.companies.findOne({
							where: { company_domain },
							attributes: ["id"],
						});
					if (!company) {
						return {
							code: RESPONSES.status.not_found,
							message: RESPONSES.messages.company.not_found,
						};
					}
					resolvedCompanyId = company.id;
				}

				const whereCondition = resolvedCompanyId
					? { email, company_id: resolvedCompanyId }
					: { email };

				const user = await this.settings.models.users.findOne({
					where: whereCondition,
					attributes: [
						"id",
						"company_id",
						"full_name",
						"email",
						"password",
						"type",
						"status",
						"timezone",
					],
				});

				if (!user) {
					return {
						code: RESPONSES.status.not_found,
						message: RESPONSES.messages.user.not_found,
					};
				}

				if (user.status !== "active") {
					return {
						code: RESPONSES.status.unauthorized,
						message: RESPONSES.messages.user.inactive,
					};
				}

				const validPassword = await bcrypt.compare(
					password,
					user.password || ""
				);
				if (!validPassword) {
					return {
						code: RESPONSES.status.user_failed_credential,
						message: RESPONSES.messages.user.failed_credential,
					};
				}

				const token = jwt.sign(
					{
						id: user.id,
						email: user.email,
						type: user.type,
						company_id: user.company_id,
					},
					process.env.JWT_SECRET,
					{ expiresIn: "24h" }
				);

				return {
					code: RESPONSES.status.success,
					message: RESPONSES.messages.user.log_in,
					data: {
						access_token: token,
						user: {
							id: user.id,
							full_name: user.full_name,
							email: user.email,
							type: user.type,
							company_id: user.company_id,
							timezone: user.timezone,
						},
					},
				};
			} catch (error) {
				return {
					code: RESPONSES.status.error,
					message: RESPONSES.messages.internal_server_error,
					error: error.message,
				};
			}
		},
		// async officeLogin(ctx) {
		// 	try {
		// 		const { serverurl, email, password, timezone } = ctx.params;

		// 		if (!process.env.JWT_SECRET) {
		// 			return {
		// 				code: RESPONSES.status.error,
		// 				message: "JWT secret is not configured",
		// 			};
		// 		}

		// 		const company_domain = this.normalizeCompanyDomain(serverurl);
		// 		if (!company_domain) {
		// 			return {
		// 				code: RESPONSES.status.bad_request,
		// 				message: RESPONSES.messages.bad_request,
		// 			};
		// 		}

		// 		const company = await this.settings.models.companies.findOne({
		// 			where: { company_domain },
		// 			attributes: ["id", "name", "company_domain"],
		// 		});
		// 		if (!company) {
		// 			return {
		// 				code: RESPONSES.status.not_found,
		// 				message: "Please enter correct URL",
		// 			};
		// 		}

		// 		const company_id = company.id;

		// 		const user = await this.settings.models.users.findOne({
		// 			where: { email, company_id },
		// 			attributes: [
		// 				"id",
		// 				"full_name",
		// 				"password",
		// 				"email",
		// 				"profile_bg_color",
		// 				"status",
		// 				"type",
		// 				"company_id",
		// 				"timezone",
		// 			],
		// 		});

		// 		if (!user) {
		// 			return {
		// 				code: RESPONSES.status.not_found,
		// 				message: RESPONSES.messages.user.not_found,
		// 			};
		// 		}

		// 		if (user.status !== "active") {
		// 			return {
		// 				code: RESPONSES.status.unauthorized,
		// 				message: RESPONSES.messages.user.inactive,
		// 			};
		// 		}
		// 		const isPasswordValid = await bcrypt.compare(
		// 			password,
		// 			user.password || ""
		// 		);
		// 		if (!isPasswordValid) {
		// 			return {
		// 				code: RESPONSES.status.user_failed_credential,
		// 				message: RESPONSES.messages.user.failed_credential,
		// 			};
		// 		}

		// 		const token = jwt.sign(
		// 			{
		// 				id: user.id,
		// 				email: user.email,
		// 				type: user.type,
		// 				company_id: user.company_id,
		// 			},
		// 			process.env.JWT_SECRET,
		// 			{ expiresIn: "24h" }
		// 		);

		// 		if (timezone) {
		// 			await this.settings.models.users.update(
		// 				{ timezone },
		// 				{ where: { id: user.id, company_id } }
		// 			);
		// 		}

		// 		return {
		// 			code: RESPONSES.status.success,
		// 			message: RESPONSES.messages.user.log_in,
		// 			data: {
		// 				access_token: token,
		// 				user: {
		// 					id: user.id,
		// 					full_name: user.full_name,
		// 					email: user.email,
		// 					type: user.type,
		// 					company_id: user.company_id,
		// 					timezone: timezone || user.timezone,
		// 					profile_bg_color: user.profile_bg_color,
		// 				},
		// 				company: {
		// 					id: company.id,
		// 					name: company.name,
		// 					company_domain: company.company_domain,
		// 				},
		// 			},
		// 		};
		// 	} catch (error) {
		// 		return {
		// 			code: RESPONSES.status.error,
		// 			message: RESPONSES.messages.internal_server_error,
		// 			error: error.message,
		// 		};
		// 	}
		// },
	},
};
