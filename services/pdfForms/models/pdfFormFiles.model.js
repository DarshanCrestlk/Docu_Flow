const Sequelize = require("sequelize");

module.exports = {
	name: "pdf_form_files",
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

		file_name: {
			type: Sequelize.STRING,
			allowNull: true,
		},

		created_by: {
			type: Sequelize.INTEGER,
			allowNull: true,
			references: {
				model: "users",
				key: "id",
			},
			onDelete: "CASCADE",
		},
		file_url: {
			type: Sequelize.TEXT,
			allowNull: true,
		},
		size: {
			type: Sequelize.BIGINT,
			allowNull: true,
		},
		key: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		is_deleted: {
			type: Sequelize.BOOLEAN,
			allowNull: true,
			defaultValue: false,
		},
		// is_flag: {
		// 	type: Sequelize.BOOLEAN,
		// 	allowNull: true,
		// },
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
		tableName: "pdf_form_files",
	},
};
