const Sequelize = require("sequelize");

module.exports = {
	name: "pdf_form_tags",
	define: {
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
		pdf_tag_id: {
			type: Sequelize.INTEGER,
			allowNull: true,
			references: {
				model: "pdf_tags",
				key: "id",
			},
		},
		pdf_form_id: {
			type: Sequelize.INTEGER,
			allowNull: true,
			references: {
				model: "pdf_forms",
				key: "id",
			},
			onDelete: "CASCADE",
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
		timestamps: false,
		tableName: "pdf_form_tags",
	},
};
