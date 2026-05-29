"use strict";

const RESPONSES = require("../../config/constants/messages");
const { Op } = require("sequelize");
const modelRelationsmixin = require("../../mixins/db/modelRelations.mixin");
const CacheCleanerMixin = require("../../mixins/cache.cleaner.mixin");

module.exports = {
	name: "emailLibrarys",

	settings: {},

	mixins: [modelRelationsmixin, CacheCleanerMixin(["emailLibrarys"])],

	actions: {
		getAllPdfFormEmails: {
			params: {
				search: { type: "string", optional: true, trim: true },
				page: {
					type: "number",
					integer: true,
					positive: true,
					optional: true,
					convert: true,
				},
				limit: {
					type: "number",
					integer: true,
					positive: true,
					optional: true,
					convert: true,
				},
				sortBy: { type: "string", optional: true, trim: true },
				order: { type: "string", optional: true, trim: true },
				company_id: {
					type: "number",
					integer: true,
					positive: true,
					optional: true,
					convert: true,
				},
			},
			async handler(ctx) {
				return this.getAllPdfFormEmails(ctx);
			},
		},

		getPdfFormEmailById: {
			params: {
				id: { type: "number", integer: true, positive: true, convert: true },
				company_id: {
					type: "number",
					integer: true,
					positive: true,
					optional: true,
					convert: true,
				},
			},
			async handler(ctx) {
				return this.getPdfFormEmailById(ctx);
			},
		},

		getPdfFormEmailByType: {
			params: {
				type: { type: "string", min: 1, max: 255, trim: true },
				company_id: {
					type: "number",
					integer: true,
					positive: true,
					optional: true,
					convert: true,
				},
			},
			async handler(ctx) {
				return this.getPdfFormEmailByType(ctx);
			},
		},

		getPdfFormEmailTypes: {
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
				return this.getPdfFormEmailTypes(ctx);
			},
		},

		createPdfFormEmail: {
			params: {
				name: { type: "string", min: 1, max: 255, trim: true },
				label_key: { type: "string", optional: true, trim: true, max: 255 },
				description: { type: "string", optional: true, trim: true, max: 1000 },
				mail_subject: { type: "string", optional: true, trim: true, max: 500 },
				email_type: {
					type: "number",
					integer: true,
					positive: true,
					convert: true,
				},
				email_template: { type: "string", optional: true },
				company_id: {
					type: "number",
					integer: true,
					positive: true,
					optional: true,
					convert: true,
				},
			},
			async handler(ctx) {
				const response = await this.createPdfFormEmail(ctx);
				this.broker.emit(`${this.name}.cache.clean`, { key: "emailLibrarys.**" });
				return response;
			},
		},

		updatePdfFormEmail: {
			params: {
				id: { type: "number", integer: true, positive: true, convert: true },
				name: { type: "string", optional: true, trim: true, max: 255 },
				label_key: { type: "string", optional: true, trim: true, max: 255 },
				description: { type: "string", optional: true, trim: true, max: 1000 },
				mail_subject: { type: "string", optional: true, trim: true, max: 500 },
				email_type: {
					type: "number",
					integer: true,
					positive: true,
					optional: true,
					convert: true,
				},
				email_template: { type: "string", optional: true },
				company_id: {
					type: "number",
					integer: true,
					positive: true,
					optional: true,
					convert: true,
				},
			},
			async handler(ctx) {
				const response = await this.updatePdfFormEmail(ctx);
				this.broker.emit(`${this.name}.cache.clean`, { key: "emailLibrarys.**" });
				return response;
			},
		},
	},

	methods: {
		resolveCompanyId(ctx) {
			return ctx?.meta?.user?.company_id || ctx?.params?.company_id;
		},

		async getAllPdfFormEmails(ctx) {
			try {
				const company_id = this.resolveCompanyId(ctx);
				if (!company_id) {
					return {
						code: RESPONSES.status.bad_request,
						message: "company_id is required",
					};
				}

				const search = ctx?.params?.search || "";
				const page = Number(ctx?.params?.page || 1);
				const limit = Number(
					ctx?.params?.limit || Number(process.env.PAGE_LIMIT || 10)
				);
				const offset = (page - 1) * limit;

				const allowedSortBy = ["createdAt", "updatedAt", "name", "id"];
				const sortBy = allowedSortBy.includes(ctx?.params?.sortBy)
					? ctx.params.sortBy
					: "createdAt";
				const order =
					String(ctx?.params?.order || "DESC").toUpperCase() === "ASC"
						? "ASC"
						: "DESC";

				const where = { company_id };
				if (search) {
					where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }];
				}

				const data = await this.settings.models.pdfFormEmailTemplates.findAll({
					where,
					include: [
						{
							model: this.settings.models.pdfFormEmailTypes,
							as: "email_type_details",
							attributes: ["id", "name", "label_key", "email_slugs"],
						},
						{
							model: this.settings.models.users,
							as: "created_user_details",
							attributes: ["id", "full_name", "profile_pic", "profile_bg_color"],
						},
					],
					attributes: [
						"id",
						"company_id",
						"name",
						"label_key",
						"description",
						"mail_subject",
						"email_type",
						"email_template",
						"created_by",
						"createdAt",
						"updatedAt",
					],
					limit,
					offset,
					order: [[sortBy, order]],
				});

				const total_count = await this.settings.models.pdfFormEmailTemplates.count({
					where,
				});

				return {
					code: RESPONSES.status.success,
					message: "PDF form email templates fetched successfully",
					data,
					total_count,
				};
			} catch (error) {
				return {
					code: RESPONSES.status.error,
					message: RESPONSES.messages.internal_server_error,
					error: error.message,
				};
			}
		},

		async getPdfFormEmailById(ctx) {
			try {
				const company_id = this.resolveCompanyId(ctx);
				const { id } = ctx.params;
				const where = company_id ? { id, company_id } : { id };

				const data = await this.settings.models.pdfFormEmailTemplates.findOne({
					where,
					include: [
						{
							model: this.settings.models.pdfFormEmailTypes,
							as: "email_type_details",
						},
					],
				});

				return {
					code: RESPONSES.status.success,
					message: "PDF form email template fetched successfully",
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

		async getPdfFormEmailByType(ctx) {
			try {
				const company_id = this.resolveCompanyId(ctx);
				if (!company_id) {
					return {
						code: RESPONSES.status.bad_request,
						message: "company_id is required",
					};
				}

				const { type } = ctx.params;
				const emailType = await this.settings.models.pdfFormEmailTypes.findOne({
					where: { company_id, label_key: type },
				});
				if (!emailType) {
					return {
						code: RESPONSES.status.not_found,
						message: "No email type found",
						data: null,
					};
				}

				const data = await this.settings.models.pdfFormEmailTemplates.findOne({
					where: {
						company_id,
						email_type: emailType.id,
					},
					include: [
						{
							model: this.settings.models.pdfFormEmailTypes,
							as: "email_type_details",
						},
					],
				});

				return {
					code: RESPONSES.status.success,
					message: "PDF form email template fetched successfully",
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

		async getPdfFormEmailTypes(ctx) {
			try {
				const company_id = this.resolveCompanyId(ctx);
				if (!company_id) {
					return {
						code: RESPONSES.status.bad_request,
						message: "company_id is required",
					};
				}

				const data = await this.settings.models.pdfFormEmailTypes.findAll({
					where: { company_id },
					order: [["id", "ASC"]],
				});

				return {
					code: RESPONSES.status.success,
					message: "PDF form email types fetched successfully",
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

		async createPdfFormEmail(ctx) {
			try {
				const company_id = this.resolveCompanyId(ctx);
				if (!company_id) {
					return {
						code: RESPONSES.status.bad_request,
						message: "company_id is required",
					};
				}

				const created_by = ctx?.meta?.user?.id || ctx?.params?.created_by || null;
				const payload = {
					company_id,
					name: ctx.params.name,
					label_key: ctx.params.label_key || null,
					description: ctx.params.description || null,
					mail_subject: ctx.params.mail_subject || null,
					email_type: ctx.params.email_type,
					email_template: ctx.params.email_template || null,
					created_by,
				};

				const data = await this.settings.models.pdfFormEmailTemplates.create(
					payload
				);
				return {
					code: RESPONSES.status.success,
					message: "PDF form email template created successfully",
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

		async updatePdfFormEmail(ctx) {
			try {
				const company_id = this.resolveCompanyId(ctx);
				const { id, ...rest } = ctx.params;
				if (!company_id) {
					return {
						code: RESPONSES.status.bad_request,
						message: "company_id is required",
					};
				}

				const existing =
					await this.settings.models.pdfFormEmailTemplates.findOne({
						where: { id, company_id },
					});
				if (!existing) {
					return {
						code: RESPONSES.status.not_found,
						message: "PDF form email template not found",
					};
				}

				const patch = { ...rest };
				delete patch.company_id;
				patch.updatedAt = new Date();
				if (ctx?.meta?.user?.id) patch.created_by = ctx.meta.user.id;

				await this.settings.models.pdfFormEmailTemplates.update(patch, {
					where: { id, company_id },
				});

				return {
					code: RESPONSES.status.success,
					message: "PDF form email template updated successfully",
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
