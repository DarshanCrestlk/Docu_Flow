"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable(
			"pdf_form_reminder_logs",
			{
				id: {
					type: Sequelize.INTEGER,
					autoIncrement: true,
					primaryKey: true,
					allowNull: false,
				},
				company_id: {
					type: Sequelize.INTEGER,
					allowNull: false,
					references: {
						model: "companies",
						key: "id",
					},
				},
				form_id: {
					type: Sequelize.INTEGER,
					allowNull: true,
					references: {
						model: "pdf_forms",
						key: "id",
					},
					onDelete: "CASCADE",
				},
				execution_date: {
					type: Sequelize.DATE,
					allowNull: true,
				},
				status: {
					type: Sequelize.ENUM,
					allowNull: true,
					values: ["success", "failed"],
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
			},
			{
				timestamps: true,
				tableName: "pdf_form_reminder_logs",
			}
		);
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable("pdf_form_reminder_logs");
	},
};
