"use strict";
const RESPONSES = require("../../constants/responses.constants");

const Users = require("./models/users.model");
const DBmixin = require("../../mixins/db/connection.mixin");
const modelRelationsmixin = require("../../mixins/db/modelRelations.mixin");
const helperMixin = require("../../mixins/helper.mixin");
const CacheCleanerMixin = require("../../mixins/cache.cleaner.mixin");
const { cache } = require("../../constants/cache.constants");
const { Op, Sequelize } = require("sequelize");

module.exports = {
	name: "users",

	settings: {},

	mixins: [
		DBmixin("users"),
		modelRelationsmixin,
		helperMixin,
		CacheCleanerMixin(["users"]),
	],
	model: Users,

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
			cache,
			async handler(ctx) {
				const user = await this.getById(ctx, this.adapter.model);
				return user;
			},
		},
		getAllUsers: {
			cache,
			async handler(ctx) {
				const response = await this.getAllUsers(
					ctx,
					this.settings.models.users
				);

				return response;
			},
		},
		getAllUsersForDropDowns: {
			cache,
			async handler(ctx) {
				const response = await this.getAllUsersForDropDowns(
					ctx,
					this.settings.models.users
				);

				return response;
			},
		},
		getAllUsersForEmployeeCode: {
			cache,
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
		async getById(ctx, model) {
			try {
				const { id } = ctx.params;
				const user = await this.settings.models.users.findOne({
					where: {
						id: id,
					},
					include: [
						{
							model: this.settings.models.rolesPermission,
							attributes: ["id"],
							include: [
								{
									model: this.settings.models
										.rolesPermissionDetails,
									attributes: {
										exclude: [
											"createdAt",
											"updatedAt",
											"company_id",
										],
									},
									include: [
										{
											model: this.settings.models
												.allServices,
											attributes: ["id", "name", "key"],
										},
										{
											model: this.settings.models
												.rolesSubModules,
											attributes: ["id", "name", "key"],
										},
										{
											model: this.settings.models
												.roleDetailsTeamDepartment,
											attributes: [
												"id",
												"department_id",
												"team_id",
												"entity_id",
												"action",
											],
										},
									],
								},
							],
						},
						{
							model: this.settings.models.internalEmployee,
							as: "internal_employee_for_user",
							attributes: ["id", "job_title"],
							include: {
								model: this.settings.models.dropdown_job_title,
								attributes: ["id", "dropdown_value"],
							},
							// include: {
							// 	model: this.settings.models.designations,
							// 	attributes: ["id", "designation_name"],
							// },
						},
						{
							model: this.settings.models.external_employees,
							as: "external_employee_for_user",
							attributes: ["id", "employment_job_title"],
							include: {
								model: this.settings.models.dropdown_job_title,
								attributes: ["id", "dropdown_value"],
							},
						},
						{
							model: this.settings.models.dropdown_job_title,
							attributes: ["id", "dropdown_value"],
						},
					],
				});
				if (!user) {
					return {
						...RESPONSES.NOT_FOUND,
						Message: "User not found",
						data: null,
					};
				}
				return {
					...RESPONSES.SUCCESS,
					data: user,
				};
			} catch (error) {
				return {
					...RESPONSES.INTERNAL_SERVER_ERROR,
					Message: error.message,
				};
			}
		},
		async getAllUsers(ctx, model) {
			try {
				const search = ctx?.params?.search || "";
				let filter =
					(ctx?.params?.filter && JSON.parse(ctx?.params?.filter)) ||
					"";

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

				let company_id =
					ctx?.meta?.user?.company_id || ctx?.params?.company_id;
				let condition = {
					company_id,
				};

				let tableName = ctx?.params?.tableName;
				const order = ctx?.params?.order;
				const sortBy = ctx?.params?.sortBy;

				let sort = [];

				if (search !== "") {
					condition = {
						...condition,
						[Op.or]: [
							{ full_name: { [Op.like]: `%${search}%` } },
							{ employee_code: { [Op.like]: `%${search}%` } },
							{ mobile_number: { [Op.like]: `%${search}%` } },
							{ email: { [Op.like]: `%${search}%` } },
							Sequelize.literal(
								`EXISTS(SELECT * FROM departments WHERE id = users.department_id AND department_name LIKE "%${search}%")`
							),
							Sequelize.literal(
								`EXISTS(SELECT * FROM teams WHERE id = users.team_id AND team_name LIKE "%${search}%")`
							),
						],
					};
				}

				if (filter !== "") {
					if (filter.status && filter.status.length) {
						condition = {
							...condition,
							status: { [Op.in]: filter.status },
						};
					}
					if (filter.gender && filter.gender.length) {
						condition = {
							...condition,
							gender: { [Op.in]: filter.gender },
						};
					}
					if (filter.department && filter.department.length) {
						condition = {
							...condition,
							department_id: { [Op.in]: filter.department },
						};
					}
					if (filter.team && filter.team.length) {
						condition = {
							...condition,
							team_id: { [Op.in]: filter.team },
						};
					}
					if (filter.user_type && filter.user_type.length) {
						condition = {
							...condition,
							user_type: { [Op.in]: filter.user_type },
						};
					}
					if (filter?.entity?.length) {
						condition = {
							...condition,
							entity_id: { [Op.in]: filter.entity },
						};
					}
				}

				if (tableName) {
					tableName = JSON.parse(tableName);
					for (const ele of tableName) {
						sort.push(ele);
					}
				}

				sortBy ? sort.push(sortBy) : sort.push("id");
				order ? sort.push(order) : sort.push("ASC");

				const user = await model.findAll({
					where: condition,
					attributes: [
						"id",
						"full_name",
						"profile_bg_color",
						"profile_pic",
						"employment_status",
						"email",
						"mobile_number",
						"gender",
						"shore_type",
						"employee_code",
						"status",
						"user_type",
						"role_id",
						"role",
						"leave_id",
						"job_title",
					],
					offset,
					limit,
					order: [sort],
					include: [
						{
							model: this.settings.models.department,
							attributes: ["id", "department_name"],
						},
						{
							model: this.settings.models.teams,
							attributes: ["id", "team_name"],
						},
						{
							model: this.settings.models.entities,
							attributes: ["id", "name"],
						},
						{
							model: this.settings.models.rolesPermission,
							attributes: ["id", "name"],
						},
						{
							model: this.settings.models.leave_rules,
							attributes: ["id", "rule_name"],
						},
						{
							model: this.settings.models.dropdown_job_title,
							attributes: ["id", "dropdown_value"],
						},
					],
				});

				const total_count = await model.count({
					where: condition,
				});

				return {
					...RESPONSES.SUCCESS,
					data: user,
					total_count,
				};
			} catch (error) {
				return {
					...RESPONSES.INTERNAL_SERVER_ERROR,
					Message: error.message,
				};
			}
		},
		async getAllUsersForDropDowns(ctx, model) {
			try {
				const user_type =
					(ctx?.params?.user_type &&
						JSON.parse(ctx?.params?.user_type)) ||
					null;
				let whCondition = {
					employment_status: "active",
				};
				let filter =
					(ctx?.params?.filter && JSON.parse(ctx?.params?.filter)) ||
					"";
				const search = ctx?.params?.search || "";

				const isPermission = ctx?.params?.isPermission || false;

				if (user_type && user_type.length > 0) {
					whCondition = {
						...whCondition,
						user_type: {
							[Op.in]: user_type,
						},
					};
				}
				if (filter !== "") {
					if (filter.entity && filter.entity.length) {
						whCondition = {
							...whCondition,
							entity_id: { [Op.in]: filter.entity },
						};
					}
				}

				if (isPermission) {
					const roles_permission = ctx?.meta?.user?.roles_permission;
					if (roles_permission?.roles_permission_details?.length) {
						for (let role of roles_permission.roles_permission_details) {
							if (
								role?.all_service?.key === "sales" &&
								role?.roles_sub_module?.key === "submissions" &&
								role?.view_records !== "none"
							) {
								const userIdsArray =
									await this.rolesAndPermissions(
										role,
										ctx,
										"view_records"
									);

								if (role?.view_records !== "all_records") {
									whCondition = {
										...whCondition,
										id: userIdsArray,
									};
								}
							}
						}
					}
				}

				if (search !== "") {
					whCondition = {
						...whCondition,
						[Op.or]: [
							{ full_name: { [Op.like]: `%${search}%` } },
							{ employee_code: { [Op.like]: `%${search}%` } },
						],
					};
				}

				const user = await model.findAll({
					where: whCondition,
					attributes: [
						"id",
						"full_name",
						"profile_bg_color",
						"profile_pic",
						"employment_status",
						"employee_code",
						"shore_type",
						"status",
						"user_type",
						"email",
					],
				});

				return {
					...RESPONSES.SUCCESS,
					data: user,
				};
			} catch (error) {
				return {
					...RESPONSES.INTERNAL_SERVER_ERROR,
					Message: error.message,
				};
			}
		},
		async getAllUsersForEmployeeCode(ctx, model) {
			try {
				const entity_id = ctx?.params?.entity_id || "";
				const prefix = ctx?.params?.prefix || "";

				let condition = {
					company_id:
						ctx?.meta?.user?.company_id || ctx?.params?.company_id,
				};

				if (prefix !== "") {
					condition = {
						...condition,
						employee_code: {
							[Op.like]: `${prefix}%`,
						},
					};
				} else {
					condition = {
						...condition,
						employee_code: { [Op.regexp]: "^[0-9]" },
					};
				}

				if (entity_id !== "") {
					condition = {
						...condition,
						entity_id,
					};
				}

				const data = await model.findAll({
					where: condition,
				});

				return data;
			} catch (error) {
				return error;
			}
		},
		async fetchAllUsersTeamBasedOnTeamId(team_id) {
			try {
				const users = await this.settings.models.users.findAll({
					where: {
						team_id,
					},
					attributes: ["id"],
				});
				const userIdsArray = users.map((user) => user.id);
				return userIdsArray;
			} catch (error) {
				console.log(error);
				return error;
			}
		},
		async FetchAllUsersDepartmentBasedOnDepartmentId(department_id) {
			try {
				const users = await this.settings.models.users.findAll({
					where: {
						department_id,
					},
					attributes: ["id"],
				});
				const userIdsArray = users.map((user) => user.id);
				return userIdsArray;
			} catch (error) {
				console.log(error);
				return error;
			}
		},
		async getUsersByEntity(ctx) {
			try {
				let search = ctx.params.search ? ctx.params.search : "";

				const filter =
					(ctx?.params?.filter && JSON.parse(ctx?.params?.filter)) ||
					"";

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

				let entityWhereClause = {};
				let fiscalYearWhereClause = {};

				if (filter) {
					if (filter.entity && filter.entity.length) {
						entityWhereClause = {
							entity_id: {
								[Op.in]: filter.entity,
							},
						};
					}

					if (filter.fiscal_year) {
						fiscalYearWhereClause = {
							applicable_fiscal_year: filter.fiscal_year,
						};
					}
				}

				let searchWhereClause;
				if (search !== "") {
					searchWhereClause = {
						...searchWhereClause,
						[Op.or]: [
							{ full_name: { [Op.like]: `%${search}%` } },
							{ employee_code: { [Op.like]: `%${search}%` } },
						],
					};
				}

				const users = await this.settings.models.users.findAll({
					where: {
						company_id: ctx.meta.user.company_id,
						...searchWhereClause,
						...entityWhereClause,
					},
					attributes: [
						"id",
						"full_name",
						"profile_pic",
						"employee_code",
						"profile_bg_color",
						"role",
					],
					include: [
						{
							model: this.settings.models.entities,
							attributes: ["id", "name"],
							where: {
								...fiscalYearWhereClause,
							},
						},
						{
							model: this.settings.models.leave_rules,
							attributes: ["id", "rule_name"],
							include: [
								{
									model: this.settings.models
										.leave_allocation_details,
									attributes: ["id", "leave_name"],
								},
							],
						},
					],
					offset,
					limit,
				});

				const totalCount = await this.settings.models.users.count({
					where: {
						company_id: ctx.meta.user.company_id,
						...searchWhereClause,
						...entityWhereClause,
					},
					include: [
						{
							model: this.settings.models.entities,
							attributes: ["id", "name"],
							where: {
								...fiscalYearWhereClause,
							},
						},
						{
							model: this.settings.models.leave_rules,
							attributes: ["id", "rule_name"],
							include: [
								{
									model: this.settings.models
										.leave_allocation_details,
									attributes: ["id", "leave_name"],
								},
							],
						},
					],
				});

				return {
					...RESPONSES.SUCCESS,
					data: users,
					total_count: totalCount,
				};
			} catch (error) {
				console.log(error);
				return error;
			}
		},
	},

	created() {},
	async started() {},
	async stopped() {},
};
