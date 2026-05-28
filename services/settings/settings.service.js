"use strict";

const RESPONSES = require("../../config/constants/messages");
const modelRelationsmixin = require("../../mixins/db/modelRelations.mixin");
const CacheCleanerMixin = require("../../mixins/cache.cleaner.mixin");

const DEFAULT_SETTINGS = {
	reminder_days: 3,
	session_timeout_for_recipient: 30,
	show_signer_name: true,
	show_signer_datetime: true,
	show_signer_ip: true,
	show_signer_id: false,
	date_format: "MM-DD-YYYY",
	time_format: "12-Hours",
	document_id_prefix: "DOC",
};

module.exports = {
	name: "settings",

	settings: {},

	mixins: [modelRelationsmixin, CacheCleanerMixin(["settings"])],

	actions: {
		getSettingsList: {
			rest: {
				method: "GET",
				path: "/",
			},
			params: {
				company_id: {
					type: "number",
					integer: true,
					positive: true,
					optional: true,
					convert: true,
				},
			},
			async handler(ctx) {
				return this.getSettingsList(ctx);
			},
		},
	},

	methods: {
		async getSettingsList(ctx) {
			try {
				const company_id =
					ctx?.meta?.user?.company_id || ctx?.params?.company_id;

				if (!company_id) {
					return {
						code: RESPONSES.status.bad_request,
						message: "company_id is required",
						data: null,
					};
				}

				let settings = await this.settings.models.settings.findOne({
					where: { company_id },
					attributes: [
						"id",
						"company_id",
						"reminder_days",
						"session_timeout_for_recipient",
						"show_signer_name",
						"show_signer_datetime",
						"show_signer_ip",
						"show_signer_id",
						"date_format",
						"time_format",
						"document_id_prefix",
					],
				});

				// Safety net for companies without seeded settings.
				if (!settings) {
					settings = await this.settings.models.settings.create({
						company_id,
						...DEFAULT_SETTINGS,
					});
				}

				return {
					code: RESPONSES.status.success,
					message: RESPONSES.messages.settings?.list || "Settings list",
					data: settings,
				};
			} catch (error) {
				return {
					code: RESPONSES.status.error,
					message: RESPONSES.messages.internal_server_error,
					error: error.message,
				};
			}
		},
	},
};
