const Sequelize = require("sequelize");

module.exports = {
	name: "pdf_form_radio_buttons",
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
		field_id: {
			type: Sequelize.INTEGER,
			allowNull: true,
			references: {
				model: "pdf_form_fields",
				key: "id",
			},
			onDelete: "CASCADE",
		},
		uuid_field_id: {
			type: Sequelize.STRING,
			allowNull: true,
			unique: true,
		},
		field_label: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		order: {
			type: Sequelize.INTEGER,
			allowNull: true,
		},
		x_coordinate: {
			type: Sequelize.FLOAT,
			allowNull: true,
		},
		y_coordinate: {
			type: Sequelize.FLOAT,
			allowNull: true,
		},
		scale_x: {
			type: Sequelize.FLOAT,
			allowNull: true,
		},
		scale_y: {
			type: Sequelize.FLOAT,
			allowNull: true,
		},
		zoom_x: {
			type: Sequelize.FLOAT,
			allowNull: true,
		},
		zoom_y: {
			type: Sequelize.FLOAT,
			allowNull: true,
		},
		height: {
			type: Sequelize.FLOAT,
			allowNull: true,
		},
		width: {
			type: Sequelize.FLOAT,
			allowNull: true,
		},
		fill: {
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
		tableName: "pdf_form_radio_buttons",
	},
};
