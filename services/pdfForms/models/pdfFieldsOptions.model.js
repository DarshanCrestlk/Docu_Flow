const Sequelize = require("sequelize");

module.exports = {
	name: "pdf_fields_options",
	define: {
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
		field_id: {
			type: Sequelize.INTEGER,
			allowNull: false,
			references: {
				model: "pdf_form_fields",
				key: "id",
			},
			onDelete: "CASCADE",
		},
		label: {
			type: Sequelize.STRING,
			allowNull: false,
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
	options: {
		timestamps: true,
		tableName: "pdf_fields_options",
	},
};
