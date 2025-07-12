"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable(
			"users",
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
				tag_name: {
					type: Sequelize.STRING,
					allowNull: true,
				},
				user_id: {
					type: Sequelize.INTEGER,
					allowNull: true,
					references: {
						model: "users",
						key: "id",
					},
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
				tableName: "pdf_tags",
			}
		);
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable("pdf_tags");
	},
};
