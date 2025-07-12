"use strict";
const DbService = require("moleculer-db");

const SqlAdapter = require("moleculer-db-adapter-sequelize");

/**
 * @typedef {import('moleculer').ServiceSchema} ServiceSchema Moleculer's Service Schema
 * @typedef {import('moleculer').Context} Context Moleculer's Context
 * @typedef {import('moleculer-db').MoleculerDB} MoleculerDB  Moleculer's DB Service Schema
 */


module.exports = function (collection) {
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

	const schema = {
		mixins: [DbService],
		adapter: new SqlAdapter(
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
				dialect: "mysql",
				logging: false,
			}
		),
		collection,
	};

	return schema;
};
