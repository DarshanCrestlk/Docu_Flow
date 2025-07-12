const Sequelize = require("sequelize");
const modelRelations = require("./model_relations/model_relations.js");

module.exports = {
	name: "sequelize",
	settings: {
		models: {},
	},
	async created() {
		const connMainObj = {
			read: {
				host: process.env.SEQUELIZE_READ_DB_HOST,
				port: process.env.SEQUELIZE_READ_DB_PORT,
				username: process.env.SEQUELIZE_READ_DB_USER,
				password: process.env.SEQUELIZE_READ_DB_PASS,
				database: process.env.SEQUELIZE_READ_DB_NAME,
				dialect: "mysql",
				logging: false,
			},
			write: {
				host: process.env.SEQUELIZE_WRITE_DB_HOST,
				port: process.env.SEQUELIZE_WRITE_DB_PORT,
				username: process.env.SEQUELIZE_WRITE_DB_USER,
				password: process.env.SEQUELIZE_WRITE_DB_PASS,
				database: process.env.SEQUELIZE_WRITE_DB_NAME,
				dialect: "mysql",
				logging: false,
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
				dialect: "mysql",
				logging: false,
			}
		);

		let models = modelRelations(sequelize);
		this.settings.models = models;
	},
};
