const Sequelize = require("sequelize");

module.exports = {
	name: "pdf_tags",
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
	options: {
		timestamps: false,
		tableName: "pdf_tags",
	},
};
