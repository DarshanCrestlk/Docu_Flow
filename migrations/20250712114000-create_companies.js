"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable(
			"companies",
			{
				id: {
					type: Sequelize.INTEGER,
					autoIncrement: true,
					primaryKey: true,
					allowNull: false,
				},
				name: {
					type: Sequelize.STRING,
					allowNull: false,
				},
				phone_no: {
					type: Sequelize.STRING,
					allowNull: false,
				},
				from_email_name: {
					type: Sequelize.STRING,
					allowNull: false,
				},
				from_email: {
					type: Sequelize.STRING,
					allowNull: false,
				},
				industry: {
					type: Sequelize.STRING,
					allowNull: false,
				},
				address: {
					type: Sequelize.STRING,
					allowNull: false,
				},
				country: {
					type: Sequelize.STRING,
					allowNull: false,
				},
				logo: {
					type: Sequelize.STRING,
					allowNull: true,
				},
				theme: {
					type: Sequelize.STRING,
					allowNull: true,
				},
				themejson: {
					type: Sequelize.JSON,
					allowNull: true,
				},
				company_domain: {
					type: Sequelize.STRING,
					allowNull: true,
				},
				document_storage: {
					type: Sequelize.BIGINT,
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
				},
			},
			{
				paranoid: false,
				tableName: "companies",
			}
		);
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable("companies");
	},
};

