"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable(
			"pdf_form_fields",
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

				form_recipient_id: {
					type: Sequelize.INTEGER,
					allowNull: true,
					references: {
						model: "pdf_form_recipients",
						key: "id",
					},
					onDelete: "CASCADE",
				},

				uuid_field_id: {
					type: Sequelize.STRING,
					allowNull: true,
					unique: true,
				},
				is_required: {
					type: Sequelize.BOOLEAN,
					defaultValue: false,
				},
				field_label: {
					type: Sequelize.STRING,
					allowNull: true,
				},
				type: {
					type: Sequelize.ENUM,
					allowNull: true,
					values: [
						"checkbox",
						"text",
						"signature",
						"digital signature",
						"date",
						"dropdown",
						"radio",
						"full_name",
						"signed_date",
						"email_id",
						"company",
						"title",
						"initial",
						"number",
					],
				},
				tooltip: {
					type: Sequelize.STRING,
					allowNull: true,
				},
				default_value: {
					type: Sequelize.TEXT,
					allowNull: true,
				},
				status: {
					type: Sequelize.ENUM,
					allowNull: true,
					values: ["pending", "completed"],
					defaultValue: "pending",
				},
				field_order: {
					type: Sequelize.INTEGER,
					allowNull: true,
				},
				x_coordinate: {
					type: Sequelize.FLOAT,
					allowNull: true,
				},
				y_coordinate: {
					type: Sequelize.FLOAT,
					allowNull: true,
				},
				width: {
					type: Sequelize.FLOAT,
					allowNull: true,
				},
				height: {
					type: Sequelize.FLOAT,
					allowNull: true,
				},
				zoom_x: {
					type: Sequelize.FLOAT,
					allowNull: true,
				},
				zoom_y: {
					type: Sequelize.FLOAT,
					allowNull: true,
				},
				scale_x: {
					type: Sequelize.FLOAT,
					allowNull: true,
				},
				scale_y: {
					type: Sequelize.FLOAT,
					allowNull: true,
				},
				fill: {
					type: Sequelize.STRING,
					allowNull: true,
				},
				pageIndex: {
					type: Sequelize.INTEGER,
					allowNull: true,
				},
				field_Data: {
					type: Sequelize.STRING,
					allowNull: true,
				},
				selected_option: {
					type: Sequelize.INTEGER,
					allowNull: true,
				},
				font_family: {
					type: Sequelize.STRING,
					allowNull: true,
					defaultValue: "Times-Roman",
				},
				character_limit: {
					type: Sequelize.INTEGER,
					allowNull: true,
				},
				date_format: {
					type: Sequelize.ENUM(
						"MM-DD-YYYY",
						"DD-MM-YYYY",
						"YYYY-MM-DD"
					),
					defaultValue: "MM-DD-YYYY",
					allowNull: true,
				},
				font_size: {
					type: Sequelize.INTEGER,
					allowNull: true,
				},
				rows: {
					type: Sequelize.INTEGER,
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
				tableName: "pdf_form_fields",
			}
		);
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable("pdf_form_fields");
	},
};
