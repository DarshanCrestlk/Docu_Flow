const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");
const csv = require("csv-parser");
const csvwriter = require("csv-writer");
let createCsvWriter = csvwriter.createObjectCsvWriter;
const x1 = require("excel4node");
const xlsx = require("xlsx");
const moment = require("moment/moment");
let { Op } = require("sequelize");
// const filterConstants = require("../constants/filter.constants");
const _ = require("lodash");
const { parsePhoneNumber } = require("awesome-phonenumber");
const { MoleculerClientError } = require("moleculer").Errors;
const axios = require("axios");
const AWS = require("aws-sdk");

module.exports = {
	name: "helper",
	methods: {
		signJWT: async function (user) {
			return jwt.sign({
				id: user.id,
				email: user.email,
				role: user.role,
				companyId: user.companyId || null,
			});
		},
		verifyJWT: async function (token, isOffice) {
			return isOffice
				? jwt.verify(token, process.env.office.OFFICE_SECRET)
				: jwt.verify(token, process.env.JWT_SECRET);
		},
		hashPassword: async function (password) {
			return await bcrypt.hash(password, 10);
		},
		sendEmail: async function (options) {
			try {
				const transporter = nodemailer.createTransport({
					service: "gmail",
					auth: {
						user: process.env.EMAIL || "ahmedasif2676@gmail.com",
						pass: process.env.PASSWORD || "opbiloblmblugnin",
					},
				});

				const email = await transporter.sendMail(options);
				console.log("Email sent successfully", email);
				return {
					success: true,
					message: "Email sent successfully",
				};
			} catch (error) {
				console.log("error", error);
				// return {
				// 	success: false,
				// 	message: error.message,
				// };
			}
		},
		sendEmailUsingSES: async function (params) {
			try {
				// Configure AWS
				AWS.config.update({
					accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
					secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
					region: process.env.AWS_S3_REGION,
				});

				// Create an SES object
				const ses = new AWS.SES();

				// Send the email
				ses.sendEmail(params, (err, data) => {
					if (err) {
						console.error("Error sending email", err);
					} else {
						console.log(
							"Email sent successfully using AWS SES",
							data
						);
					}
				});
				console.log();
			} catch (error) {
				console.log("error", error);
				return;
			}
		},
		validateEmail: function (email) {
			const re = /\S+@\S+\.\S+/;
			return re.test(email);
		},
		readCsv: async function (csvName) {
			return new Promise((resolve, reject) => {
				try {
					const csvFilePath = path.join(
						__dirname,
						`../assets/uploads/${csvName}`
					);
					const dataFromCsv = [];

					fs.createReadStream(csvFilePath)
						.pipe(csv())
						.on("headers", (headers) => {
							// Store the column names in the result array
							dataFromCsv.push(headers);
						})
						.on("data", (data) => {
							// Store each row of data in the result array
							dataFromCsv.push(data);
						})
						.on("end", () => {
							resolve({
								status: true,
								message: "CSV read successfully",
								data: dataFromCsv,
							});
						});
				} catch (error) {
					reject({
						status: false,
						message: error.message,
					});
				}
			});
		},
		createCsv: async function (fileName, headers, data = []) {
			try {
				// Headers Example
				// const headers = [
				//     { id: "name", title: "Name" },
				//     { id: "lang", title: "Language" },
				//     { id: "dob", title: "Date of Birth" },
				//     { id: "address", title: "Address" },
				//   ];
				const downloadPath = path.join(
					__dirname,
					`../assets/reports/${fileName}`
				);
				const csvWriter = createCsvWriter({
					path: downloadPath,
					header: headers,
				});
				await new Promise((resolve) => {
					csvWriter.writeRecords(data).then(() => {
						resolve(downloadPath);
					});
				});

				return {
					status: true,
					message: "CSV created successfully",
					downloadPath: downloadPath,
				};
			} catch (error) {
				return {
					status: false,
					message: error.message,
				};
			}
		},
		createExcel: async function (
			sheetNameArray,
			headerArray,
			filePath,
			excelData
		) {
			try {
				//Create Workbook
				const wb = new x1.Workbook();
				//Adding sheets
				let sheets = [];
				for (let i = 0; i < sheetNameArray.length; i++) {
					const ws = wb.addWorksheet(sheetNameArray[i]);
					sheets.push(ws);
				}
				let sheet1 = sheets[0];
				let sheet2 = sheets[1];
				//Filling first sheet headers
				for (let j = 0; j < headerArray.length; j++) {
					sheet1.cell(1, j + 1).string(headerArray[j]);
				}
				// Adding excelData in sheet 2
				for (let i = 0; i < excelData.length; i++) {
					const header = excelData[i].field;
					sheet2.cell(1, i + 1).string(header);
					const values = excelData[i].dropdownValues;
					for (let j = 0; j < values.length; j++) {
						sheet2.cell(j + 2, i + 1).string(values[j]);
					}
				}
				//Adding dropdown in sheet 1 using sheet 2 data at dropdownColumnNames
				for (let i = 0; i < excelData.length; i++) {
					const columnName = excelData[i].field;

					// Find if this columnName exists in sheet1
					let ifExistInSheetOne = headerArray.findIndex(
						(x) => x == columnName
					);
					if (ifExistInSheetOne > -1) {
						let columnLetter = this.colName(ifExistInSheetOne);
						let secondSheetColumnLetter = this.colName(i);
						let sqref = `${columnLetter}1:${columnLetter}500`;
						let dropdownLength =
							excelData[i].dropdownValues.length + 1;
						let formula = `='${sheetNameArray[1]}'!$${secondSheetColumnLetter}$2:$${secondSheetColumnLetter}$${dropdownLength}`;
						sheet1.addDataValidation({
							type: "list",
							allowBlank: true,
							prompt: "Choose from dropdown",
							errorTitle: "Invalid Option",
							error: "Select Option from Dropdown",
							showDropDown: true,
							sqref: sqref,
							formulas: [formula],
						});
					}
				}
				// await wb.write(filePath);
				const buffer = await wb.writeToBuffer();
				await new Promise((resolve, reject) => {
					fs.writeFile(filePath, buffer, (e) => {
						if (e) reject(e);
						else resolve(filePath);
					});
				});
				return {
					status: true,
					message: "Excel created successfully",
					downloadPath: filePath,
				};
			} catch (error) {
				return {
					status: false,
					message: error.message,
				};
			}
		},

		colName: function (n) {
			let ordA = "a".charCodeAt(0);
			let ordZ = "z".charCodeAt(0);
			let len = ordZ - ordA + 1;

			let s = "";
			while (n >= 0) {
				s = String.fromCharCode((n % len) + ordA) + s;
				n = Math.floor(n / len) - 1;
			}
			return s.toUpperCase();
		},
		readExcel: function (filePath) {
			try {
				const workbook = xlsx.readFile(filePath);
				const worksheet = workbook.Sheets[workbook.SheetNames[0]];
				const jsonData = xlsx.utils.sheet_to_json(worksheet, {
					raw: true,
					defval: "",
				});

				jsonData.map((data) => {
					Object.keys(data).map((key) => {
						if (
							key === "DOB*" ||
							key === "Joining Date*" ||
							key === "From Date" ||
							key === "To Date" ||
							key === "DOB" ||
							key === "Joining Date"
						) {
							if (typeof data[key] === "number") {
								if (key === "DOB*" || key === "Joining Date*") {
									data[key] = this.excelDateToJSDate(
										data[key]
									);

									data[key] = moment(
										data[key],
										"DD/MM/YYYY"
									).format("MM-DD-YYYY");
								} else {
									data[key] = this.excelDateToJSDate(
										data[key]
									);
								}
							}
						}
					});
					return data;
				});
				const headers = Object.keys(jsonData[0]);
				return {
					status: true,
					message: "Excel read successfully",
					data: [headers, jsonData],
				};
			} catch (error) {
				return {
					status: false,
					message: error.message,
				};
			}
		},
		excelDateToJSDate: function (excelDate) {
			// I want this in format MM-DD-YYYY
			return new Date(
				Math.round((excelDate - 25569) * 86400 * 1000)
			).toLocaleDateString("en-UK");
		},
		sendSMS: async function (body, to) {
			const accountSid = process.env.TWILIO_ACCOUNT_SID;
			const authToken = process.env.TWILIO_AUTH_TOKEN;
			const client = require("twilio")(accountSid, authToken);
			client.messages
				.create({
					body,
					from: process.env.TWILIO_PHONE_NUMBER,
					to: `${to}`,
				})
				.then((message) => console.log("message.sid", message.sid))
				.catch((error) => {
					console.error("Error sending SMS:", error.status);
					return error.status;
				});
		},

		fetchDynamicAttributes: async function (listAttributes) {
			let attributes = [];
			let include = [];
			const entitySelections = listAttributes.split("&");

			// Create an empty array to store the result
			const result = [];
			const rootModel = entitySelections.splice(0, 1);
			const [mainTable, mainTableFields] = rootModel[0].split("=");
			attributes = mainTableFields.split(",");

			// Loop through each entity selection
			entitySelections.forEach((selection) => {
				// Split each entity selection by "=" to separate the entity name and fields
				const [entityName, fields, alias] = selection.split("=");

				// Split the fields by "," to create an array of field names
				const temp = fields.split("#");
				const fieldNames = temp[0].split(",");

				// Add the entity name and field names to the result object
				result.push({
					[entityName]: fieldNames,
					alias,
				});
			});

			result.forEach((entity) => {
				include.push({
					model: this.settings.models[Object.keys(entity)[0]],
					as: entity.alias,
					attributes: entity[Object.keys(entity)[0]],
				});
			});

			return {
				attributes,
				include,
			};
		},
		generateDarkColorHex: function () {
			const red = Math.floor(Math.random() * 128);
			const green = Math.floor(Math.random() * 128);
			const blue = Math.floor(Math.random() * 128);
			const redHex = red.toString(16).padStart(2, "0");
			const greenHex = green.toString(16).padStart(2, "0");
			const blueHex = blue.toString(16).padStart(2, "0");
			return `#${redHex}${greenHex}${blueHex}`;
		},
		generateLightColorHex: function () {
			const red = Math.floor(Math.random() * 150) + 50; // Random between 128 and 255
			const green = Math.floor(Math.random() * 150) + 50;
			const blue = Math.floor(Math.random() * 150) + 50;
			const redHex = red.toString(16).padStart(2, "0");
			const greenHex = green.toString(16).padStart(2, "0");
			const blueHex = blue.toString(16).padStart(2, "0");
			return `#${redHex}${greenHex}${blueHex}`;
		},
		// EXTRACT FILE NAME FROM AWS LINK
		extractFilename: function (url) {
			if (!url) return null;

			const decoded_url = decodeURIComponent(url); // Decode the URL first
			const parts = decoded_url.split("/");
			const final_name = parts.at(-1).split(".");
			final_name.splice(0, 1);
			const filename = final_name.join(".");
			return filename;
		},
		// Function to apply dunamic filters
		// dynamicFilters: function (filterArray) {
		// 	const temp = {};
		// 	// Create a mapping from key to Sequelize operator
		// 	const operatorMap = {};
		// 	filterConstants.forEach((op) => {
		// 		operatorMap[op.key] = op.operator;
		// 	});

		// 	filterArray.map((filter) => {
		// 		const { field, key, value, type } = filter;
		// 		const sequelizeOperator = operatorMap[key];

		// 		if (!sequelizeOperator) {
		// 			throw new Error(`Unknown operator key: ${key}`);
		// 		}

		// 		if (!temp[field]) {
		// 			temp[field] = {};
		// 		}

		// 		if (type === "dropdown") {
		// 			if (key === "is") {
		// 				temp[field][Op.eq] = value;
		// 			} else if (key === "is_not") {
		// 				temp[field][Op.or] = {
		// 					[Op.ne]: value,
		// 					[Op.is]: null,
		// 				};
		// 			} else if (key === "is_empty") {
		// 				temp[field] = { [Op.is]: null };
		// 			} else if (key === "is_not_empty") {
		// 				temp[field] = { [Op.ne]: null };
		// 			} else if (key === "list") {
		// 				temp[field][Op.in] = Array.isArray(value)
		// 					? value
		// 					: [value];
		// 			} else if (key === "not_in_list") {
		// 				temp[field][Op.or] = {
		// 					[Op.notIn]: Array.isArray(value) ? value : [value],
		// 					[Op.is]: null,
		// 				};
		// 			}
		// 		} else if (type === "date") {
		// 			if (
		// 				[
		// 					"yesterday",
		// 					"today",
		// 					"tomorrow",
		// 					"this_week",
		// 					"this_month",
		// 					"this_year",
		// 					"last_n_weeks",
		// 					"next_n_weeks",
		// 					"last_n_days",
		// 					"next_n_days",
		// 					"last_n_months",
		// 					"next_n_months",
		// 					"last_n_years",
		// 					"next_n_years",
		// 				].includes(key)
		// 			) {
		// 				const [startDate, endDate] = this.getDateRange(
		// 					key,
		// 					value
		// 				);
		// 				temp[field][Op.between] = [startDate, endDate];
		// 			} else if (key === "before") {
		// 				temp[field][Op.lt] = value;
		// 			} else if (key === "after") {
		// 				temp[field][Op.gt] = value;
		// 			} else if (key === "between") {
		// 				temp[field][Op.between] = value;
		// 			} else if (key === "not_between") {
		// 				temp[field][Op.notBetween] = value;
		// 			} else if (key === "is_empty") {
		// 				temp[field] = { [Op.is]: null };
		// 			} else if (key === "is_not_empty") {
		// 				temp[field] = { [Op.ne]: null };
		// 			} else {
		// 				temp[field][Op[sequelizeOperator.slice(4, -1)]] = value;
		// 			}
		// 		} else if (type === "number") {
		// 			if (key === "equals") {
		// 				temp[field][Op.eq] = value;
		// 			} else if (key === "greater_than") {
		// 				temp[field][Op.gt] = value;
		// 			} else if (key === "less_than") {
		// 				temp[field][Op.lt] = value;
		// 			} else if (key === "between") {
		// 				temp[field][Op.between] = value;
		// 			} else if (key === "is_empty") {
		// 				temp[field] = { [Op.is]: null };
		// 			} else if (key === "is_not_empty") {
		// 				temp[field] = { [Op.ne]: null };
		// 			}
		// 		} else {
		// 			if (key === "starts_with") {
		// 				temp[field][Op.like] = `${value}%`;
		// 			} else if (key === "ends_with") {
		// 				temp[field][Op.like] = `%${value}`;
		// 			} else if (key === "contains") {
		// 				temp[field][Op.like] = `%${value}%`;
		// 			} else if (key === "not_contains") {
		// 				temp[field][Op.or] = {
		// 					[Op.notLike]: `%${value}%`,
		// 					[Op.is]: null,
		// 				};
		// 			} else if (key === "is_not") {
		// 				temp[field][Op.or] = {
		// 					[Op.ne]: value,
		// 					[Op.is]: null,
		// 				};
		// 			} else {
		// 				temp[field][Op[sequelizeOperator.slice(4, -1)]] = value;
		// 			}
		// 		}
		// 	});
		// 	console.log("temp", temp);
		// 	return temp;
		// },
		// Function to get date range for relative date keys
		getDateRange(key, value) {
			const now = moment();
			let startDate, endDate;

			switch (key) {
				case "yesterday":
					startDate = now.clone().subtract(1, "days").startOf("day");
					endDate = now.clone().subtract(1, "days").endOf("day");
					break;
				case "today":
					startDate = now.clone().startOf("day");
					endDate = now.clone().endOf("day");
					break;
				case "tomorrow":
					startDate = now.clone().add(1, "days").startOf("day");
					endDate = now.clone().add(1, "days").endOf("day");
					break;
				case "this_week":
					startDate = now.clone().startOf("week");
					endDate = now.clone().endOf("week");
					break;
				case "this_month":
					startDate = now.clone().startOf("month");
					endDate = now.clone().endOf("month");
					break;
				case "this_year":
					startDate = now.clone().startOf("year");
					endDate = now.clone().endOf("year");
					break;
				case "last_n_weeks":
					startDate = now
						.clone()
						.subtract(value, "weeks")
						.startOf("day");
					endDate = now.clone().endOf("day");
					break;
				case "next_n_weeks":
					startDate = now.clone().startOf("day");
					endDate = now.clone().add(value, "weeks").endOf("day");
					break;
				case "last_n_days":
					startDate = now
						.clone()
						.subtract(value, "days")
						.startOf("day");
					endDate = now.clone().endOf("day");
					break;
				case "next_n_days":
					startDate = now.clone().startOf("day");
					endDate = now.clone().add(value, "days").endOf("day");
					break;
				case "last_n_months":
					startDate = now
						.clone()
						.subtract(value, "months")
						.startOf("day");
					endDate = now.clone().endOf("day");
					break;
				case "next_n_months":
					startDate = now.clone().startOf("day");
					endDate = now.clone().add(value, "months").endOf("day");
					break;
				case "last_n_years":
					startDate = now
						.clone()
						.subtract(value, "years")
						.startOf("day");
					endDate = now.clone().endOf("day");
					break;
				case "next_n_years":
					startDate = now.clone().startOf("day");
					endDate = now.clone().add(value, "years").endOf("day");
					break;
				default:
					throw new Error(`Unknown relative date key: ${key}`);
			}

			return [startDate.toDate(), endDate.toDate()];
		},

		// COMPARE TWO ARRAYS OF OBJECTS BY SPECIFIED FIELDS
		compareArraysByFields: function (array1, array2, fields) {
			// Extract specified fields and sort them
			const extractAndSort = (array, fields) => {
				return _.sortBy(
					array.map((item) => {
						return _.pick(item, fields);
					}),
					fields
				);
			};

			const sortedArray1 = extractAndSort(array1, fields);
			const sortedArray2 = extractAndSort(array2, fields);

			// Compare the sorted arrays
			return _.isEqual(sortedArray1, sortedArray2);
		},

		// FORMAT PHONE NUMBER
		formatPhoneNumber: (phoneNo) => {
			const parsedNo = parsePhoneNumber(phoneNo);

			// Format US number
			if (parsedNo?.countryCode === 1) {
				const numericOnly = parsedNo?.number?.significant;
				const areaCode = numericOnly?.slice(0, 3);
				const localNumber1 = numericOnly?.slice(3, 6);
				const localNumber2 = numericOnly?.slice(6);
				return `+1 (${areaCode}) ${localNumber1}-${localNumber2}`;
			}

			// Format Indian number
			else if (parsedNo?.countryCode === 91) {
				const numericOnly = parsedNo?.number?.significant;
				const localNumber1 = numericOnly?.slice(0, 5);
				const localNumber2 = numericOnly?.slice(5);
				return `+91 ${localNumber1}-${localNumber2}`;
			}

			// Other country number
			else {
				return parsedNo?.number?.international;
			}
		},
		// Function to extract local date part (yyyy-mm-dd) from a date string
		extractLocalDate(dateString) {
			const date = new Date(dateString);
			const year = date.getFullYear();
			const month = (date.getMonth() + 1).toString().padStart(2, "0");
			const day = date.getDate().toString().padStart(2, "0");
			return `${year}-${month}-${day}`;
		},
		async fetchReportingManagers(
			user_id,
			currentLevel = 0,
			maxLevels = 10,
			managerChain = []
		) {
			if (currentLevel >= maxLevels) {
				return managerChain;
			}

			const employee =
				await this.settings.models.internalEmployee.findOne({
					where: { user_id },
				});

			if (!employee || employee.reporting_managers === null) {
				return managerChain;
			}

			const managerId = employee.reporting_managers;

			if (managerId) {
				managerChain.push(managerId);
			}

			if (managerId === user_id || managerId === null) {
				return managerChain;
			}

			return this.fetchReportingManagers(
				managerId,
				currentLevel + 1,
				maxLevels,
				managerChain
			);
		},
		async rolesAndPermissions(role, ctx, type) {
			try {
				let userIdsArray = [];

				if (role[type] === "my_records") {
					userIdsArray = [ctx.meta.user.id];
				} else if (role[type] === "my_team_records") {
					console.log("team_id", ctx?.meta?.user?.team_id);
					const userId = await this.settings.models.users.findAll({
						where: {
							team_id: ctx?.meta?.user?.team_id,
						},
						attributes: ["id"],
					});
					userIdsArray = userId.map((user) => user.id);
				} else if (role[type] === "my_department_records") {
					console.log(
						"department_id",
						ctx?.meta?.user?.department_id
					);
					const userId = await this.settings.models.users.findAll({
						where: {
							department_id: ctx?.meta?.user?.department_id,
						},
						attributes: ["id"],
					});
					userIdsArray = userId.map((user) => user.id);
					console.log("Length", userIdsArray?.length);
				} else if (
					role[type] === "custom" &&
					role?.role_details_team_departments?.length > 0
				) {
					let departmentArr = [];
					let teamArr = [];

					role?.role_details_team_departments?.map((detail) => {
						if (
							detail?.department_id &&
							detail?.action === "view" &&
							type === "view_records"
						) {
							departmentArr.push(detail?.department_id);
						}

						if (
							detail?.department_id &&
							detail?.action === "edit" &&
							type === "edit_records"
						) {
							departmentArr.push(detail?.department_id);
						}

						if (
							detail?.team_id &&
							detail?.action === "view" &&
							type === "view_records"
						) {
							teamArr?.push(detail?.team_id);
						}

						if (
							detail?.team_id &&
							detail?.action === "edit" &&
							type === "edit_records"
						) {
							teamArr?.push(detail?.team_id);
						}
					});

					const userId = await this.settings.models.users.findAll({
						where: {
							[Op.or]: [
								{
									department_id: departmentArr,
								},
								{ team_id: teamArr },
							],
						},
						attributes: ["id"],
					});

					userIdsArray = userId.map((user) => user.id);
				} else if (role[type] === "hierarchy") {
					userIdsArray = await this.getAllEmployees(
						ctx?.meta?.user?.id
					);
				}
				return userIdsArray;
			} catch (error) {
				console.log(error);
			}
		},
		async getAllEmployees(userId) {
			const subordinateIds = await this.findSubordinateEmployees(userId);

			if (subordinateIds.length === 0) {
				return [userId];
			}

			return [userId, ...subordinateIds];
		},
		async findSubordinateEmployees(userId, level = 0, maxLevels = 6) {
			if (level > maxLevels) {
				return [];
			}
			const internalSubordinates =
				await this.settings.models.internalEmployee.findAll({
					where: {
						reporting_managers: userId,
					},
					attributes: ["user_id"],
				});

			const externalSubordinates =
				await this.settings.models.external_employees.findAll({
					where: {
						employment_supervisor_name: userId,
					},
					attributes: ["user_id"],
				});

			const internalUserIds = internalSubordinates.map(
				(emp) => emp.user_id
			);
			const externalUserIds = externalSubordinates.map(
				(emp) => emp.user_id
			);
			const subordinateUserIds = [
				...new Set([...internalUserIds, ...externalUserIds]),
			];

			if (subordinateUserIds.length === 0) {
				return [];
			}

			const allSubordinateIds = [];
			for (let subordinateUserId of subordinateUserIds) {
				const lowerLevelSubordinates =
					await this.findSubordinateEmployees(
						subordinateUserId,
						level + 1,
						maxLevels
					);
				allSubordinateIds.push(...lowerLevelSubordinates);
			}

			return [...new Set([...subordinateUserIds, ...allSubordinateIds])];
		},
		async findSubordinateEmployeesForEngage(
			userId,
			level = 1,
			maxLevels = 4
		) {
			if (level > maxLevels) {
				return [];
			}

			// Fetch internal subordinates
			const internalSubordinates =
				await this.settings.models.internalEmployee.findAll({
					where: {
						// user_id: { [Op.ne]: userId },
						reporting_managers: userId,
					},
					attributes: ["user_id"],
				});

			// Fetch external subordinates
			const externalSubordinates =
				await this.settings.models.external_employees.findAll({
					where: {
						// user_id: { [Op.ne]: userId },
						employment_supervisor_name: userId,
					},
					attributes: ["user_id"],
				});

			// Extract user IDs
			const subordinateUserIds = [
				...new Set([
					...internalSubordinates.map((emp) => emp.user_id),
					...externalSubordinates.map((emp) => emp.user_id),
				]),
			];

			if (subordinateUserIds.length === 0) {
				return [];
			}

			// Create an array to store results
			let results = subordinateUserIds.map((userId) => ({
				userId,
				level: `level${level}`,
			}));

			// Recursively find subordinates for each user
			for (let subordinateUserId of subordinateUserIds) {
				if (subordinateUserId === userId) continue;
				const lowerLevelSubordinates =
					await this.findSubordinateEmployeesForEngage(
						subordinateUserId,
						level + 1,
						maxLevels
					);
				results = results.concat(lowerLevelSubordinates);
			}

			return results;
		},
		async findReportingManagerForUpToLevel(
			userId,
			level = 1,
			maxLevels = 4,
			userList = new Set()
		) {
			if (level > maxLevels) {
				return Array.from(userList);
			}

			let internalEmployee = await this.broker.call(
				"internalEmployees.getInternalEmployeeByUserId",
				{
					user_id: userId,
				}
			);

			if (!internalEmployee?.data?.id) {
				internalEmployee =
					await this.settings.models.external_employees.findOne({
						where: {
							user_id: userId,
						},
					});
			}

			const nextUserId =
				internalEmployee?.data?.reporting_managers ||
				internalEmployee?.employment_supervisor_name;

			if (!nextUserId) {
				return Array.from(userList);
			}

			userList.add(nextUserId);

			return await this.findReportingManagerForUpToLevel(
				nextUserId,
				level + 1,
				maxLevels,
				userList
			);
		},

		async verifyAndExtractCompanyId(ctx) {
			try {
				const token =
					ctx.params.href_token ||
					ctx.meta.token ||
					ctx.meta?.$params?.pdf_token;
				if (!token) {
					throw new MoleculerClientError(
						"Your session has been expired. Please login again",
						401
					);
				}
				let companyId;
				let isPublic = false;
				let isVerify = true;

				if (ctx.params.href_token) {
					const timesheet_request_processors = await this.broker.call(
						"timesheets.getTimesheetRP",
						{
							id: ctx?.params?.timesheet_id || ctx?.params?.id,
							token: token,
						}
					);

					if (!timesheet_request_processors?.data?.length) {
						return {
							code: 401,
							message: "Invalid token",
						};
					}

					try {
						const decoded = await this.verifyJWT(token);
					} catch (error) {
						isVerify = false;
					}

					if (!isVerify) {
						const timesheet =
							await this.settings.models.timesheets.findOne({
								where: {
									id:
										ctx?.params?.timesheet_id ||
										ctx?.params?.id,
								},
							});

						return {
							code: 403,
							message: "Token expired",
							timesheet_status: timesheet?.status,
						};
					}

					companyId =
						timesheet_request_processors?.data[0]?.company_id;
					isPublic = true;
				} else {
					const decoded = await this.verifyJWT(token);
					const user = await this.broker.call("users.getById", {
						id: decoded.id,
						company_id: decoded.company_id,
					});

					if (!user.data) {
						throw new MoleculerClientError(
							"Your session has been expired. Please login again",
							401
						);
					}

					ctx.meta.user = user?.data;
					ctx.meta.company_id = decoded?.company_id;
					companyId = user?.data?.company_id;
				}

				ctx.params.company_id = companyId;
				ctx.params.is_public = isPublic;
				return null;
			} catch (error) {
				throw new MoleculerClientError(
					"Your session has been expired. Please login again",
					401
				);
			}
		},

		async verifyAndExtractCompanyIdForExpense(ctx) {
			try {
				const token = ctx.params.href_token || ctx.meta.token;
				if (!token) {
					throw new MoleculerClientError(
						"Your session has been expired. Please login again",
						401
					);
				}
				let companyId;
				let isPublic = false;
				let isVerify = true;

				if (ctx.params.href_token) {
					//find expense_request_processors by token and expense id
					const request_processors =
						await this.settings.models.expense_request_processors.findAll(
							{
								where: {
									expense_id:
										ctx?.params?.id ||
										ctx?.params?.expense_id,
									token: token,
								},
								include: [
									{
										model: this.settings.models.users,
										attributes: [
											"id",
											"full_name",
											"profile_pic",
											"profile_bg_color",
											"email",
										],
									},
								],
							}
						);

					if (!request_processors?.length) {
						return {
							code: 401,
							message: "Invalid token",
						};
					}

					try {
						const decoded = await this.verifyJWT(token);
					} catch (error) {
						isVerify = false;
					}

					if (!isVerify) {
						const expense =
							await this.settings.models.expenses.findOne({
								where: {
									id:
										ctx?.params?.id ||
										ctx?.params?.expense_id,
								},
							});

						return {
							code: 403,
							message: "Invalid token",
							expense_status: expense?.status,
							reimbursement_status: expense?.reimbursement_status,
						};
					}

					companyId = request_processors?.[0]?.company_id;
					isPublic = true;
				} else {
					const decoded = await this.verifyJWT(token);
					const user = await this.broker.call("users.getById", {
						id: decoded.id,
						company_id: decoded.company_id,
					});

					if (!user.data) {
						throw new MoleculerClientError(
							"Your session has been expired. Please login again",
							401
						);
					}

					ctx.meta.user = user?.data;
					ctx.meta.company_id = decoded?.company_id;
					companyId = user?.data?.company_id;
				}

				ctx.params.company_id = companyId;
				ctx.params.is_public = isPublic;
				return null;
			} catch (error) {
				throw new MoleculerClientError(
					"Your session has been expired. Please login again",
					401
				);
			}
		},
		convertDecimalHours(decimalHours) {
			const hours = Math.floor(decimalHours);
			const minutes = Math.round((decimalHours - hours) * 60);
			return `${hours}h ${minutes}m`;
		},

		/**
		 * Joins an array of nullable strings using the specified joining symbol.
		 * @param {Array<string|null>} strArr - The array of nullable strings to be joined.
		 * @param {string} [joinSymbol=' '] - The symbol used to join the strings. (Optional)
		 * @returns {string} The joined string, excluding null or undefined values.
		 */
		joinNullableStrings(strArr, joinSymbol = " ") {
			return strArr.filter((part) => part)?.join(joinSymbol);
		},

		async encodeFileToBase64(filePath) {
			try {
				const fileData = await fs.promises.readFile(filePath, {
					encoding: "base64",
				});
				return fileData;
			} catch (error) {
				console.error("Error reading file:", error);
				return null;
			}
		},

		async downloadFile(url, destinationPath) {
			try {
				const writer = fs.createWriteStream(destinationPath); // Create write stream

				const response = await axios.get(url, {
					responseType: "stream", // Stream response
				});

				response.data.pipe(writer); // Pipe response stream to file

				return new Promise((resolve, reject) => {
					writer.on("finish", () => resolve(destinationPath)); // Resolve when done
					writer.on("error", reject); // Reject on error
				});
			} catch (error) {
				console.error(
					`Failed to download file from ${url}:`,
					error.message
				);
				throw new Error(`Unable to download file: ${error.message}`);
			}
		},
	},
};
