"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable(
			"pdf_form_email_types",
			{
				id: {
					type: Sequelize.INTEGER,
					autoIncrement: true,
					primaryKey: true,
					allowNull: false,
				},
				company_id: {
					type: Sequelize.INTEGER,
					allowNull: true,
					references: {
						model: "companies",
						key: "id",
					},
				},
				name: {
					type: Sequelize.STRING,
					allowNull: true,
				},
				label_key: {
					type: Sequelize.STRING,
					allowNull: true,
				},
				email_slugs: {
					type: Sequelize.JSON,
					allowNull: true,
				},
				createdAt: {
					type: Sequelize.DATE,
					allowNull: false,
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
				tableName: "pdf_form_email_types",
			}
		);
	},

	async down(queryInterface) {
		await queryInterface.dropTable("pdf_form_email_types");
	},
};
