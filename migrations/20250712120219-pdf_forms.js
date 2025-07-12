"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable(
			"pdf_forms",
			{
				id: {
					type: Sequelize.INTEGER,
					autoIncrement: true,
					primaryKey: true,
					allowNull: false,
				},
				document_id: {
					type: Sequelize.STRING,
					allowNull: true,
					// unique: true,
				},
				company_id: {
					type: Sequelize.INTEGER,
					allowNull: false,
					references: {
						model: "companies",
						key: "id",
					},
				},
				size: {
					type: Sequelize.BIGINT,
					allowNull: true,
				},
				title: {
					type: Sequelize.STRING,
					allowNull: true,
				},
				is_priority_required: {
					type: Sequelize.BOOLEAN,
					defaultValue: false,
				},
				file_id: {
					type: Sequelize.INTEGER,
					allowNull: true,
					references: {
						model: "pdf_form_files",
						key: "id",
					},
					onDelete: "CASCADE",
				},
				created_by: {
					type: Sequelize.INTEGER,
					allowNull: true,
					references: {
						model: "users",
						key: "id",
					},
				},
				// is_protected: {
				// 	type: Sequelize.BOOLEAN,
				// 	defaultValue: false,
				// },
				form_url: {
					type: Sequelize.TEXT,
					allowNull: true,
				},

				form_original_url: {
					type: Sequelize.TEXT,
					allowNull: true,
				},
				key: {
					type: Sequelize.STRING,
					allowNull: true,
				},
				form_original_key: {
					type: Sequelize.STRING,
					allowNull: true,
				},
				// expiration_days: {
				// 	type: Sequelize.INTEGER,
				// 	allowNull: true,
				// },

				expiration_date: {
					type: Sequelize.DATE,
					allowNull: true,
				},

				//settings
				reminder_days: {
					type: Sequelize.INTEGER,
					allowNull: true,
				},
				// settings
				// validity_type: {
				// 	type: Sequelize.ENUM,
				// 	allowNull: true,
				// 	values: ["forever", "days", "date"],
				// 	defaultValue: "forever",
				// },
				initiate: {
					type: Sequelize.BOOLEAN,
					allowNull: true,
				},
				void_reason: {
					type: Sequelize.TEXT,
					allowNull: true,
				},
				is_template: {
					type: Sequelize.BOOLEAN,
					allowNull: true,
				},
				// thumbnail_key: {
				// 	type: Sequelize.STRING,
				// 	allowNull: true,
				// },

				// thumbnail_url: {
				// 	type: Sequelize.TEXT,
				// 	allowNull: true,
				// },

				// cc_email: {
				// 	type: Sequelize.TEXT,
				// 	allowNull: true,
				// 	get() {
				// 		const value = this.getDataValue("cc_email");
				// 		return value ? JSON.parse(value) : null;
				// 	},
				// 	set(value) {
				// 		this.setDataValue("cc_email", JSON.stringify(value));
				// 	},
				// },

				attach_audit_log: {
					type: Sequelize.BOOLEAN,
					allowNull: true,
					defaultValue: false,
				},
				audit_log_file_url: {
					type: Sequelize.TEXT,
					allowNull: true,
				},
				combined_file_url: {
					type: Sequelize.TEXT,
					allowNull: true,
				},
				status: {
					type: Sequelize.ENUM,
					allowNull: true,
					values: [
						"pending",
						"completed",
						"voided",
						"draft",
						"expired",
						"declined",
						"deleted",
					],
					defaultValue: "pending",
				},
				version: {
					type: Sequelize.FLOAT,
					allowNull: true,
				},
				is_deleted: {
					type: Sequelize.BOOLEAN,
					allowNull: true,
					defaultValue: false,
				},
				// expiration_at: {
				// 	type: Sequelize.DATE,
				// 	allowNull: true,
				// },
				note: {
					type: Sequelize.TEXT,
					allowNull: true,
				},
				email_template: {
					type: Sequelize.TEXT,
					allowNull: true,
				},
				email_subject: {
					type: Sequelize.TEXT,
					allowNull: true,
				},
				reason_for_deletion: {
					type: Sequelize.TEXT,
					allowNull: true,
				},
				form_token: {
					type: Sequelize.STRING,
					allowNull: true,
				},
				self_signed: {
					type: Sequelize.BOOLEAN,
					allowNull: true,
					defaultValue: false,
				},
				createdAt: {
					type: Sequelize.DATE,
					allowNull: true,
					defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
				},
				updatedAt: {
					type: Sequelize.DATE,
					allowNull: true,
					defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
				},
				mailedAt: {
					type: Sequelize.DATE,
					allowNull: true,
					defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
				},
			},
			{
				timestamps: true,
				tableName: "pdf_forms",
			}
		);
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable("pdf_forms");
	},
};
