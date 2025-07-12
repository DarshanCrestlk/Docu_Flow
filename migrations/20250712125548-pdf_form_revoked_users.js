"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable(
			"pdf_form_revoked_users",
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
					allowNull: false,
					references: {
						model: "pdf_forms",
						key: "id",
					},
					onDelete: "CASCADE",
				},
				name: {
					type: Sequelize.STRING,
					allowNull: true,
				},
				email: {
					type: Sequelize.STRING,
					allowNull: true,
				},
				token: {
					type: Sequelize.TEXT,
					allowNull: true,
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
				tableName: "pdf_form_revoked_users",
			}
		);
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable("pdf_form_revoked_users");
	},
};
