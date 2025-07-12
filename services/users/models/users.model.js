const Sequelize = require("sequelize");

module.exports = {
	name: "users",
	define: {
		id: {
			type: Sequelize.INTEGER,
			autoIncrement: true,
			primaryKey: true,
			allowNull: false,
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
		profile_bg_color: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		role: {
			type: Sequelize.ENUM("super_admin", "internal", "external", "both"),
			allowNull: false,
		},
		leave_id: {
			type: Sequelize.BIGINT,
			allowNull: true,
			references: {
				model: "leave_rules",
				key: "id",
			},
		},
		profile_pic: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		timezone: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		mobile_number: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		user_type: {
			type: Sequelize.ENUM("staff", "both", "consultant"),
			allowNull: true,
		},
		role_id: {
			type: Sequelize.BIGINT,
			allowNull: true,
			references: {
				model: "roles_permissions",
				key: "id",
			},
		},
		team_id: {
			type: Sequelize.INTEGER,
			allowNull: true,
			references: {
				model: "teams",
				key: "id",
			},
		},
		department_id: {
			type: Sequelize.INTEGER,
			allowNull: true,
			references: {
				model: "departments",
				key: "id",
			},
		},
		job_title: {
			type: Sequelize.INTEGER,
			allowNull: true,
			references: {
				model: "dropdown_job_titles",
				key: "id",
			},
		},
		effective_date: {
			type: Sequelize.ENUM,
			allowNull: true,
			values: ["assigned_date", "allocation_start_date"],
		},
		leave_assigned_date: {
			type: Sequelize.DATEONLY,
			allowNull: true,
		},
		shore_type: {
			type: Sequelize.ENUM("onshore", "offshore"),
			allowNull: true,
		},
		entity_id: {
			type: Sequelize.INTEGER,
			references: {
				model: "entities",
				key: "id",
			},
			allowNull: true,
		},
		employee_code: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		gender: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		status: {
			type: Sequelize.BOOLEAN,
			allowNull: false,
			defaultValue: true,
		},
		employment_status: {
			type: Sequelize.ENUM("active", "inactive", "terminated"),
			allowNull: true,
		},
		company_id: {
			type: Sequelize.INTEGER,
			allowNull: true,
			references: {
				model: "companies",
				key: "id",
			},
		},
		leave_assigned_by: {
			type: Sequelize.INTEGER,
			allowNull: true,
			references: {
				model: "users",
				key: "id",
			},
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
