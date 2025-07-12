require("dotenv").config();

module.exports = {
	username: process.env.SEQUELIZE_WRITE_DB_USER,
	password: process.env.SEQUELIZE_WRITE_DB_PASS,
	database: process.env.SEQUELIZE_WRITE_DB_NAME,
	host: process.env.SEQUELIZE_WRITE_DB_HOST,
	port: process.env.SEQUELIZE_WRITE_DB_PORT,
	dialect: "mysql",
	seederStorage: "sequelize",
	seederStorageTableName: "sequelizeData",
};
