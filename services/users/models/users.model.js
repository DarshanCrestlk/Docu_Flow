const Sequelize = require("sequelize");

/**
 * Users — identity for DocuFlow, HRMS, and ATS.
 * Aligned with migration: migrations/20250712114536-create_users.js
 *
 * - company_id: tenant (required for product users; see companies table)
 * - type: role within tenant (super_admin | admin | user)
 * - user_from: provenance (HRMS | ATS | DOCU_FLOW)
 * - status: account lifecycle (active | inactive)
 */
module.exports = {
	name: "users",
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
		full_name: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		password: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		email: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		mobile_number: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		profile_bg_color: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		type: {
			type: Sequelize.ENUM("super_admin", "admin", "user"),
			allowNull: false,
		},
		profile_pic: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		timezone: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		user_from: {
			type: Sequelize.ENUM("HRMS", "ATS", "DOCU_FLOW"),
			allowNull: true,
			comment: "User provenance: HRMS, ATS, or DocuFlow app",
		},
		status: {
			type: Sequelize.ENUM("active", "inactive"),
			allowNull: true,
		},
		createdAt: {
			type: Sequelize.DATE,
			allowNull: false,
			defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
		},
		updatedAt: {
			type: Sequelize.DATE,
			allowNull: true,
		},
	},

	options: {
		paranoid: false,
		tableName: "users",
	},
};
