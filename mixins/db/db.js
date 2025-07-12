const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const Sequelize = require("sequelize");
const db = {};
const connMainObj = {
	read: {
		host: process.env.SEQUELIZE_READ_DB_HOST,
		port: process.env.SEQUELIZE_READ_DB_PORT,
		username: process.env.SEQUELIZE_READ_DB_USER,
		password: process.env.SEQUELIZE_READ_DB_PASS,
		database: process.env.SEQUELIZE_READ_DB_NAME,
		dialect: "mysql",
		logging: false,
		pool: {
			max: 20,
			min: 0,
			acquire: 30000,
			idle: 10000,
		},
	},
	write: {
		host: process.env.SEQUELIZE_WRITE_DB_HOST,
		port: process.env.SEQUELIZE_WRITE_DB_PORT,
		username: process.env.SEQUELIZE_WRITE_DB_USER,
		password: process.env.SEQUELIZE_WRITE_DB_PASS,
		database: process.env.SEQUELIZE_WRITE_DB_NAME,
		dialect: "mysql",
		logging: false,
		pool: {
			max: 20,
			min: 0,
			acquire: 30000,
			idle: 10000,
		},
	},
};

let sequelize = new Sequelize(
	process.env.SEQUELIZE_WRITE_DB_HOST,
	process.env.SEQUELIZE_WRITE_DB_NAME,
	process.env.SEQUELIZE_WRITE_DB_PASS,
	{
		replication: {
			read: {
				...connMainObj.read,
			},
			write: {
				...connMainObj.write,
			},
		},
		logging: false,
		dialect: "mysql",
		pool: {
			max: 20,
			min: 0,
			acquire: 30000,
			idle: 10000,
		},
	}
);

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
