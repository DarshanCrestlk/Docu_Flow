const Sequelize = require("sequelize");

module.exports = {
	name: "pdf_form_history",
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

		form_id: {
			type: Sequelize.INTEGER,
			allowNull: false,
			references: {
				model: "pdf_forms",
				key: "id",
			},
			onDelete: "CASCADE",
		},

		performed_by: {
			type: Sequelize.INTEGER,
			allowNull: true,
			references: {
				model: "users",
				key: "id",
			},
			onDelete: "CASCADE",
		},
		ip: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		browser: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		performer_name: {
			type: Sequelize.STRING,
			allowNull: true,
		},

		activity: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		action: {
			type: Sequelize.ENUM,
			allowNull: true,
			values: [
				"voided",
				"drafted",
				"completed",
				"corrected",
				"mailed",
				"viewed",
				"signed",
				"declined",
				"bounced",
				"resent",
				"expired",
				"reminded",
			],
		},
		performer_color: {
			type: Sequelize.STRING,
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
		timestamps: true,
		tableName: "pdf_form_history",
	},
};
