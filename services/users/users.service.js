"use strict";
const RESPONSES = require("../../config/constants/messages.js");

const Users = require("./models/users.model");
const modelRelationsmixin = require("../../mixins/db/modelRelations.mixin");
const helperMixin = require("../../mixins/helper.mixin");
const CacheCleanerMixin = require("../../mixins/cache.cleaner.mixin");
const { Op } = require("sequelize");

module.exports = {
	name: "users",

	settings: {},

	mixins: [
		modelRelationsmixin,
		helperMixin,
		CacheCleanerMixin(["users"]),
	],

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
				const user = await this.getById(ctx);
				return user;
			},
		},
		getAllUsers: {
			async handler(ctx) {
				const response = await this.getAllUsers(
					ctx,
					this.settings.models.users
				);

				return response;
			},
		},
		getAllUsersForDropDowns: {

			async handler(ctx) {
				const response = await this.getAllUsersForDropDowns(
					ctx,
					this.settings.models.users
				);

				return response;
			},
		},
		getAllUsersForEmployeeCode: {
			async handler(ctx) {
				const response = await this.getAllUsersForEmployeeCode(
					ctx,
					this.adapter.model
				);
				return response;
			},
		},
		FetchAllUsersTeamBasedOnTeamId: {
			async handler(ctx) {
				const response = await this.FetchAllUsersTeamBasedOnTeamId(
					ctx.params.team_id
				);
				return response;
			},
		},
		FetchAllUsersDepartmentBasedOnDepartmentId: {
			async handler(ctx) {
				const response =
					await this.FetchAllUsersDepartmentBasedOnDepartmentId(
						ctx.params.department_id
					);
				return response;
			},
		},
		getUsersByEntity: {
			async handler(ctx) {
				const response = await this.getUsersByEntity(ctx);
				return response;
			},
		},
	},

	events: {},

	methods: {
		buildCompanyScope(ctx) {
			return ctx?.meta?.user?.company_id || ctx?.params?.company_id || null;
		},

		async getById(ctx) {
			try {
				const { id } = ctx.params || {};
				const companyId = this.buildCompanyScope(ctx);
				const where = { id };
				if (companyId) where.company_id = companyId;

				const user = await this.settings.models.users.findOne({
					where,
					attributes: [
						"id",
						"company_id",
						"full_name",
						"email",
						"mobile_number",
						"profile_bg_color",
						"profile_pic",
						"timezone",
						"type",
						"user_from",
						"status",
						"createdAt",
						"updatedAt",
					],
				});

				if (!user) {
					return {
						code: RESPONSES.status.not_found,
						message: RESPONSES.messages.user.not_found,
						data: null,
					};
				}

				return {
					code: RESPONSES.status.success,
					message: RESPONSES.messages.success,
					data: user,
				};
			} catch (error) {
				return {
					code: RESPONSES.status.error,
					message: RESPONSES.messages.internal_server_error,
					error: error.message,
				};
			}
		},

		async getAllUsers(ctx, model) {
			try {
				const search = ctx?.params?.search || "";
				const filter =
					(ctx?.params?.filter && JSON.parse(ctx?.params?.filter)) || {};

				let page =
					parseInt(
						ctx.params.page ? ctx.params.page : undefined,
						10
					) || 1;
				let limit =
					parseInt(
						ctx.params.limit ? ctx.params.limit : undefined,
						10
					) || Number(process.env.PAGE_LIMIT);
				let offset = (page - 1) * limit;

				const company_id = this.buildCompanyScope(ctx);
				if (!company_id) {
					return {
						code: RESPONSES.status.bad_request,
						message: "company_id is required",
					};
				}

				const condition = { company_id };

				if (search !== "") {
					condition[Op.or] = [
						{ full_name: { [Op.like]: `%${search}%` } },
						{ email: { [Op.like]: `%${search}%` } },
						{ mobile_number: { [Op.like]: `%${search}%` } },
					];
				}

				if (filter.status?.length) {
					condition.status = { [Op.in]: filter.status };
				}
				if (filter.type?.length) {
					condition.type = { [Op.in]: filter.type };
				}
				if (filter.user_from?.length) {
					condition.user_from = { [Op.in]: filter.user_from };
				}

				const allowedSort = [
					"id",
					"full_name",
					"email",
					"status",
					"type",
					"user_from",
					"createdAt",
					"updatedAt",
				];
				const sortBy = allowedSort.includes(ctx?.params?.sortBy)
					? ctx.params.sortBy
					: "id";
				const order =
					(ctx?.params?.order || "ASC").toUpperCase() === "DESC"
						? "DESC"
						: "ASC";

				const users = await model.findAll({
					where: condition,
					attributes: [
						"id",
						"company_id",
						"full_name",
						"email",
						"mobile_number",
						"profile_bg_color",
						"profile_pic",
						"timezone",
						"type",
						"user_from",
						"status",
						"createdAt",
						"updatedAt",
					],
					offset,
					limit,
					order: [[sortBy, order]],
				});

				const total_count = await model.count({
					where: condition,
				});

				return {
					code: RESPONSES.status.success,
					message: RESPONSES.messages.success,
					data: users,
					total_count,
					page,
					limit,
				};
			} catch (error) {
				return {
					code: RESPONSES.status.error,
					message: RESPONSES.messages.internal_server_error,
					error: error.message,
				};
			}
		},

		async getAllUsersForDropDowns(ctx, model) {
			try {
				const company_id = this.buildCompanyScope(ctx);
				if (!company_id) {
					return {
						code: RESPONSES.status.bad_request,
						message: "company_id is required",
					};
				}

				const user_type =
					(ctx?.params?.user_type &&
						JSON.parse(ctx?.params?.user_type)) ||
					null;
				const search = ctx?.params?.search || "";

				const whCondition = {
					company_id,
					status: "active",
				};
				if (user_type && user_type.length > 0) {
					whCondition.type = { [Op.in]: user_type };
				}
				if (search !== "") {
					whCondition[Op.or] = [
						{ full_name: { [Op.like]: `%${search}%` } },
						{ email: { [Op.like]: `%${search}%` } },
					];
				}

				const user = await model.findAll({
					where: whCondition,
					attributes: [
						"id",
						"full_name",
						"email",
						"profile_bg_color",
						"profile_pic",
						"status",
						"type",
					],
					order: [["full_name", "ASC"]],
				});

				return {
					code: RESPONSES.status.success,
					message: RESPONSES.messages.success,
					data: user,
				};
			} catch (error) {
				return {
					code: RESPONSES.status.error,
					message: RESPONSES.messages.internal_server_error,
					error: error.message,
				};
			}
		},

		async getAllUsersForEmployeeCode(ctx, model) {
			try {
				const prefix = ctx?.params?.prefix || "";
				const company_id = this.buildCompanyScope(ctx);

				if (!company_id) {
					return {
						code: RESPONSES.status.bad_request,
						message: "company_id is required",
					};
				}

				const condition = { company_id };

				if (prefix !== "") {
					condition[Op.or] = [
						{ full_name: { [Op.like]: `${prefix}%` } },
						{ email: { [Op.like]: `${prefix}%` } },
					];
				}

				const data = await model.findAll({
					where: condition,
					attributes: ["id", "full_name", "email"],
					order: [["full_name", "ASC"]],
					limit: 50,
				});

				return {
					code: RESPONSES.status.success,
					message: RESPONSES.messages.success,
					data,
				};
			} catch (error) {
				return {
					code: RESPONSES.status.error,
					message: RESPONSES.messages.internal_server_error,
					error: error.message,
				};
			}
		},

		// Legacy compatibility methods retained with lean implementation
		async FetchAllUsersTeamBasedOnTeamId(team_id) {
			void team_id;
			return [];
		},

		async FetchAllUsersDepartmentBasedOnDepartmentId(department_id) {
			void department_id;
			return [];
		},

		async getUsersByEntity(ctx) {
			try {
				// Entity-specific data is no longer part of the current user schema.
				return this.getAllUsers(ctx, this.settings.models.users);
			} catch (error) {
				return {
					code: RESPONSES.status.error,
					message: RESPONSES.messages.internal_server_error,
					error: error.message,
				};
			}
		},
	},

	created() {},
	async started() {},
	async stopped() {},
};
