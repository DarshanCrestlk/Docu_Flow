"use strict";

const RESPONSES = require("../../config/constants/messages.js");
const Companies = require("./models/companies.model");
const modelRelationsmixin = require("../../mixins/db/modelRelations.mixin");
const helperMixin = require("../../mixins/helper.mixin");
const CacheCleanerMixin = require("../../mixins/cache.cleaner.mixin");
// const { cache } = require("../../constants/cache.constants");

module.exports = {
	name: "companies",

	settings: {},

	mixins: [
		modelRelationsmixin,
		helperMixin,
		CacheCleanerMixin(["companies"]),
	],

	model: Companies,

	dependencies: [],

	actions: {
		getById: {
			rest: {
				method: "GET",
				path: "/:id",
				params: {
					id: "string",
				},
			},
			async handler(ctx) {
				try {
					const { id } = ctx.params;
					const company = await this.settings.models.companies.findOne({
						where: { id },
					});

					if (!company) {
						return {
							...RESPONSES.NOT_FOUND,
							Message: "Company not found",
							data: null,
						};
					}

					return {
						...RESPONSES.SUCCESS,
						data: company,
					};
				} catch (error) {
					return {
						...RESPONSES.INTERNAL_SERVER_ERROR,
						Message: error.message,
					};
				}
			},
		},
	},

	events: {},
	methods: {},

	created() {},
	async started() {},
	async stopped() {},
};

