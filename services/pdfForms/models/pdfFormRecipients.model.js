const Sequelize = require("sequelize");

module.exports = {
	name: "pdf_form_recipients",
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
		user_id: {
			type: Sequelize.INTEGER,
			allowNull: true,
			references: {
				model: "users",
				key: "id",
			},
			onDelete: "CASCADE",
			onUpdate: "CASCADE",
		},
		status: {
			type: Sequelize.ENUM,
			allowNull: true,
			values: [
				"pending",
				"mailed",
				"viewed",
				"completed",
				"revoked",
				"void",
				"expired",
				"bounced"
			],
			// defaultValue: "pending",
		},
		r_priority: {
			type: Sequelize.INTEGER,
			allowNull: true,
		},
		name: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		email: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		token: {
			type: Sequelize.TEXT,
			allowNull: true,
		},
		// password: {
		// 	type: Sequelize.STRING,
		// 	allowNull: true,
		// },
		color: {
			type: Sequelize.STRING(50),
			allowNull: true,
		},
		type: {
			type: Sequelize.ENUM,
			values: ["inside_organization", "outside_organization"],
		},
		is_changed: {
			type: Sequelize.BOOLEAN,
			allowNull: true,
			defaultValue: false,
		},
		is_declined: {
			type: Sequelize.BOOLEAN,
			defaultValue: false,
		},
		reason_for_declining: {
			type: Sequelize.TEXT,
			allowNull: true,
		},
		viewedAt: {
			type: Sequelize.DATE,
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
		role:{
			type: Sequelize.ENUM,
            values: ["viewer", "signer"],
            allowNull: true,
		},
		message_id:{
			type: Sequelize.STRING,
			allowNull: true
		}
	},
	options: {
		timestamps: true,
		tableName: "pdf_form_recipients",
	},
};
