const Sequelize = require("sequelize");

module.exports = {
	name: "pdf_form_email_templates",
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
		name: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		label_key: {
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
		},
		description: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		mail_subject: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		email_type: {
			type: Sequelize.INTEGER,
			allowNull: true,
			references: {
				model: "pdf_form_email_types",
				key: "id",
			},
		},
		email_template: {
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
	options: {
		timestamps: false,
		tableName: "pdf_form_email_templates",
	},
};
