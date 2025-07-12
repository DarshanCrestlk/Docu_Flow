"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable(
			"pdf_form_signature_initials",
			{
				id: {
					type: Sequelize.INTEGER,
					autoIncrement: true,
					primaryKey: true,
					allowNull: false,
				},
				sign_uuid: {
					type: Sequelize.STRING,
					allowNull: true,
					unique: true,
				},
				company_id: {
					type: Sequelize.INTEGER,
					allowNull: true,
					references: {
						model: "companies",
						key: "id",
					},
					onDelete: "CASCADE",
				},
				user_id: {
					type: Sequelize.INTEGER,
					allowNull: true,
					references: {
						model: "users",
						key: "id",
					},
					onDelete: "CASCADE",
				},
				initials_url: {
					type: Sequelize.STRING(255),
					allowNull: true,
				},
				signature_url: {
					type: Sequelize.STRING(255),
					allowNull: true,
				},
				signature_key: {
					type: Sequelize.STRING(255),
					allowNull: true,
				},
				initials_key: {
					type: Sequelize.STRING(255),
					allowNull: true,
				},
				email: {
					type: Sequelize.STRING(255),
					allowNull: true,
				},
				createdAt: {
					type: Sequelize.DATE,
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
				tableName: "pdf_form_signature_initials",
			}
		);
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable("pdf_form_signature_initials");
	},
};
