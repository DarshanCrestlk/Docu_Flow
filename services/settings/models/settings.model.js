const Sequelize = require("sequelize");

module.exports = {
	name: "settings",
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
			unique: true,
			references: {
				model: "companies",
				key: "id",
			},
			onDelete: "CASCADE",
		},
		reminder_days: {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 3,
		},
		session_timeout_for_recipient: {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 30,
		},
		show_signer_name: {
			type: Sequelize.BOOLEAN,
			allowNull: false,
			defaultValue: true,
		},
		show_signer_datetime: {
			type: Sequelize.BOOLEAN,
			allowNull: false,
			defaultValue: true,
		},
		show_signer_ip: {
			type: Sequelize.BOOLEAN,
			allowNull: false,
			defaultValue: true,
		},
		show_signer_id: {
			type: Sequelize.BOOLEAN,
			allowNull: false,
			defaultValue: false,
		},
		date_format: {
			type: Sequelize.ENUM("MM-DD-YYYY", "DD-MM-YYYY", "YYYY-MM-DD"),
			allowNull: false,
			defaultValue: "MM-DD-YYYY",
		},
		time_format: {
			type: Sequelize.ENUM("12-Hours", "24-Hours"),
			allowNull: false,
			defaultValue: "12-Hours",
		},
		document_id_prefix: {
			type: Sequelize.STRING,
			allowNull: true,
			defaultValue: "DOC",
		},
		createdAt: {
			type: Sequelize.DATE,
			allowNull: false,
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
		tableName: "settings",
	},
};
