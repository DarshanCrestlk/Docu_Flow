const Sequelize = require("sequelize");

module.exports = {
	name: "companies",
	define: {
		id: {
			type: Sequelize.INTEGER,
			autoIncrement: true,
			primaryKey: true,
			allowNull: false,
		},
		name: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		phone_no: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		from_email_name: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		from_email: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		industry: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		address: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		country: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		logo: {
			type: Sequelize.STRING,
		},
		theme: {
			type: Sequelize.STRING,
		},
		themejson: {
			type: Sequelize.JSON,
		},
		company_domain: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		document_storage: {
			type: Sequelize.BIGINT,
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
		timestamps: false,
		tableName: "companies",
	},
};

