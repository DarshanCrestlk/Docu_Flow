"use strict";
const RESPONSES = require("../../config/constants/messages.js");
const { MoleculerError } = require("moleculer").Errors;
const S3mixin = require("../../mixins/s3.mixin");
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const uploadDir = path.join(__dirname, "..", "..", "assets", "uploads");
const helperMixin = require("../../mixins/helper.mixin");
const modelRelationsmixin = require("../../mixins/db/modelRelations.mixin");
var convertapi = require("convertapi")(`${process.env.CONVERT_API_KEY}`);
const AWS = require("aws-sdk");
AWS.config.update({
	accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
	region: process.env.AWS_S3_REGION,
});
const s3 = new AWS.S3({
	accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
	region: process.env.AWS_S3_REGION,
	signatureVersion: "v4",
});
// const { convert } = require("pdf-poppler");
/**
 * @typedef {import('moleculer').ServiceSchema} ServiceSchema Moleculer's Service Schema
 * @typedef {import('moleculer').Context} Context Moleculer's Context
 */

/** @type {ServiceSchema} */
module.exports = {
	name: "s3",
	/**
	 * Settings
	 */
	settings: {},

	mixins: [S3mixin, helperMixin, modelRelationsmixin],
	model: "timesheets",
	/**
	 * Dependencies
	 */
	dependencies: [],

	/**
	 * Actions
	 */
	actions: {
		uploadToS3: {
			authorization: false,
			async handler(ctx) {
				try {
					const isOffice = ctx.meta.officeAPI;

					if (!isOffice) {
						if (ctx.meta?.$params?.pdf_token) {
							// need to call brocker
							const verificationResult = await this.broker.call(
								"pdfForms.verifyPDFToken",
								ctx.meta?.$params?.pdf_token
							);
							// const verificationResult =  await this.verifyPDFToken(ctx);
							if (verificationResult?.code === 400) {
								throw new MoleculerError(
									verificationResult?.message,
									verificationResult?.code,
									verificationResult?.error
								);
							} else if (verificationResult?.code === 200) {
								ctx.params.company_id =
									verificationResult.company_id;
								ctx.params.is_public =
									verificationResult.is_public;
							}
						} else if (ctx.meta?.$params?.e_form_token) {
							const verification = await this.broker.call(
								"i9Forms.validateToken",
								{
									st: ctx.meta?.$params?.e_form_token,
								}
							);
							if (verification?.code === 400) {
								throw new MoleculerError(
									verification?.message,
									verification?.code,
									verification?.error
								);
							} else if (verification?.code === 200) {
								ctx.params.company_id =
									verification.data?.dataValues?.company_id;
								ctx.params.is_public = true;
							}

							//
						} else {
							const verificationResult =
								await this.verifyAndExtractCompanyId(ctx);
							if (verificationResult) {
								return verificationResult;
							}
						}
						//-------------------------------CopyObject --change File gallery --- SFtart
						let uploadFromDocLib =
							ctx.meta.$multipart.uploadFromDocLib;
						let keyPrefix = ctx.meta.$multipart.keyPrefix;

						if (uploadFromDocLib && keyPrefix) {
							//we copy the object from AWS and set in related Org Folder
							let data = await this.copyObject(
								uploadFromDocLib,
								keyPrefix
							);
							return {
								code: RESPONSES.status.success,
								message: RESPONSES.messages.s3.uploaded,
								data: {
									url: data?.url,
									fileName: uploadFromDocLib?.file_name,
									Key: data?.key,
								},
							};
						}
						//-------------------------------CopyObject --change File gallery --- End
					}

					let company_id =
						ctx?.meta?.user?.company_id ||
						ctx?.params?.company_id ||
						ctx?.meta?.company_id;
					let findCompany = await this.broker.call(
						"companies.getById",
						{ id: company_id }
					);
					let uniqueName = Date.now();
					const isThumbnailRequired =
						ctx.meta.$multipart.isThumbnailRequired === "true"
							? true
							: false;

					if (
						ctx?.meta?.$multipart?.filename !== undefined ||
						ctx?.params?.filename !== undefined
					) {
						ctx.meta.filename =
							ctx?.meta?.$multipart?.filename ||
							ctx?.params?.filename;
					}
					if (ctx?.meta?.$multipart?.originalFileName !== undefined) {
						ctx.meta.filename = encodeURIComponent(
							ctx?.meta?.$multipart?.originalFileName
						);
					}

					const { filePath, fileSize } = await new this.Promise(
						(resolve, reject) => {
							//reject(new Error("Disk out of space"));
							const filePath = path.join(
								uploadDir,
								`${uniqueName}.${ctx.meta.filename}`
							);
							const f = fs.createWriteStream(filePath);

							f.on("close", async () => {
								// File written successfully
								fs.promises
									.stat(filePath)
									.then((stats) => {
										const fileSize = stats.size;
										this.logger.info(
											`Uploaded file stored in '${filePath}'`
										);
										resolve({
											filePath,
											meta: ctx.meta,
											fileSize,
										});
									})
									.catch((err) => reject(err));
							});

							ctx.params.on("error", (err) => {
								this.logger.info(
									"File error received",
									err.message
								);
								reject(err);

								// Destroy the local file
								f.destroy(err);
							});

							f.on("error", () => {
								// Remove the errored file.
								fs.unlinkSync(filePath);
							});

							ctx.params.pipe(f);
						}
					);

					const fileInfo = {
						originalname: ctx.meta.filename,
						mimetype: ctx.meta.mimetype,
						fileSize: fileSize,
					};
					console.log("ctx.meta", ctx.meta);

					if (
						Boolean(ctx.meta?.$multipart?.convert) &&
						ctx.meta?.$multipart?.convert_type
					) {
						const convertType = ctx.meta.$multipart.convert_type;

						const result = await convertapi.convert("pdf", {
							File: `${uploadDir}/${uniqueName}.${ctx.meta.filename}`,
						});

						const newName =
							ctx.meta.filename?.split(".")[0] +
							`.${convertType}`;

						await result.file.save(
							`${uploadDir}/${uniqueName}.${newName}`
						);

						fileInfo.customPath = `${uploadDir}/${uniqueName}.${newName}`;
						fileInfo.originalname = newName;
						fileInfo.mimetype = `application/${convertType}`;

						await fs.promises.unlink(
							`${uploadDir}/${uniqueName}.${ctx.meta.filename}`
						);
					}

					const dir = ctx.meta.$multipart.location;
					console.log("dir", dir);
					const uploadedImage = await this.upload(
						fileInfo,
						dir,
						findCompany.data.name,
						uniqueName,
						isThumbnailRequired // we will not delete the file for this case.
					);

					let thumbnailUpload;
					if (isThumbnailRequired) {
						// await this.thumbnailCreation(
						// 	filePath,
						// 	`${uniqueName}.${ctx.meta.filename.split(".")[0]}`
						// );
						// fs.unlinkSync(filePath);
						// thumbnailUpload = await this.upload(
						// 	{
						// 		originalname: `${
						// 			ctx.meta.filename.split(".")[0]
						// 		}.png`,
						// 		mimetype: "image/png",
						// 		// customPath: thumbnail?.thumbnailPath,
						// 	},
						// 	dir,
						// 	findCompany.data.name,
						// 	uniqueName
						// );
						// console.log("ThumbnailImage", thumbnailUpload);
					}
					return {
						code: RESPONSES.status.success,
						message: RESPONSES.messages.s3.uploaded,
						data: {
							url: uploadedImage.url,
							fileName: uploadedImage.fileName,
							size: uploadedImage.size,
							Key: uploadedImage.Key,
							thumbnailUrl: thumbnailUpload?.url,
							thumbnailKey: thumbnailUpload?.Key,
						},
					};
				} catch (error) {
					// return {
					// 	code: RESPONSES.status.error,
					// 	message: RESPONSES.messages.internal_server_error,
					// 	error: error.message,
					// };
					throw new MoleculerError(
						error?.message ||
							RESPONSES.messages.internal_server_error,
						error?.code || RESPONSES.status.error,
						error?.error || error.message
					);
				}
			},
		},

		// Not used
		// deleteFileFromS3: {
		// 	rest: {
		// 		method: "DELETE",
		// 		path: "/:fileUrl",
		// 		params: {
		// 			fileUrl: "string",
		// 		},
		// 	},
		// 	async handler(ctx) {
		// 		let fileUrl = ctx.params.fileUrl;
		// 		console.log("fileUrl", fileUrl);
		// 		const parts = fileUrl.split("/");
		// 		console.log("parts", parts);
		// 		const key = decodeURIComponent(parts.slice(2).join("/"));
		// 		console.log("key", key);
		// 		const deletedImage = await this.deleteFile(key);
		// 		return {
		// 			code: RESPONSES.status.success,
		// 			message: RESPONSES.messages.s3.deleted,
		// 			data: deletedImage,
		// 		};
		// 	},
		// },
		updateToS3: {
			authorization: false,
			async handler(ctx) {
				try {
					let fileName = ctx.meta.$multipart.file_name;
					let Key = ctx.meta.$multipart.key;
					let MimeType =
						ctx.meta?.$multipart?.mime_type === "null"
							? ctx.meta?.mimetype
							: ctx.meta?.$multipart?.mime_type;
					let Location = ctx.meta.$multipart.location;

					const { buffer, fileSize } = await new this.Promise(
						(resolve, reject) => {
							const chunks = [];

							ctx.params.on("data", (chunk) => {
								chunks.push(chunk);
							});

							ctx.params.on("end", () => {
								const buffer = Buffer.concat(chunks);
								const fileSize = buffer.length;
								this.logger.info(
									`Uploaded file size: ${fileSize} bytes`
								);
								resolve({
									buffer,
									meta: ctx.meta,
									fileSize,
								});
							});

							ctx.params.on("error", (err) => {
								this.logger.info(
									"File error received",
									err.message
								);
								reject(err);
							});
						}
					);

					let response = await this.updateFileData(
						fileName,
						Key,
						MimeType,
						Location,
						buffer
					);
					return {
						code: RESPONSES.status.success,
						message: RESPONSES.messages.s3.uploaded,
						data: {
							code: RESPONSES.status.success,
							message: "File Updated Successfully",
							response: response,
						},
					};
				} catch (error) {
					return {
						code: RESPONSES.status.error,
						message: RESPONSES.messages.internal_server_error,
						error: error.message,
					};
				}
			},
		},
		getSignedURL: {
			// authorization: false,
			async handler(ctx) {
				try {
					// params
					const Key = ctx.params.key;
					const id = ctx.params.id;

					const signedURL = await this.generateSignedURL(Key);

					return {
						code: RESPONSES.status.success,
						message: RESPONSES.messages.s3.signedUrl,
						data: {
							signedURL,
							id,
							Key,
						},
					};
				} catch (error) {
					console.log(error);
				}
			},
		},
		deleteUnUsedFiles: {
			async handler(ctx) {
				const response = await this.deleteUnUsedFiles(ctx);
				return response;
			},
		},
		addUnUsedFile: {
			async handler(ctx) {
				const response = await this.addUnUsedFile(ctx);
				return response;
			},
		},
		streamFileData: {
			async handler(ctx) {
				const response = await this.streamFileData(ctx);
				return response;
			},
		},
	},

	/**
	 * Events
	 */
	events: {},

	/**
	 * Methods
	 */
	methods: {
		// async thumbnailCreation(filePath, fileName) {
		// 	try {
		// 		const browser = await puppeteer.launch({
		// 			// executablePath: "/usr/bin/chromium", // Use the installed Chromium
		// 			args: ["--no-sandbox", "--disable-setuid-sandbox"], // Required for Docker
		// 		});
		// 		const page = await browser.newPage();
		// 		// Load the PDF file
		// 		await page.goto(`file://${filePath}`, {
		// 			waitUntil: "networkidle2",
		// 		});
		// 		await page.setViewport({
		// 			width: 500,
		// 			height: 700,
		// 		});
		// 		// Take a screenshot of the visible content
		// 		const screenshotBuffer = await page.screenshot({
		// 			type: "png",
		// 			clip: {
		// 				x: 0,
		// 				y: 0,
		// 				width: 500,
		// 				height: 700,
		// 			},
		// 		});
		// 		const thumbnailPath = `${uploadDir}/${fileName}.png`;
		// 		fs.writeFileSync(thumbnailPath, screenshotBuffer);
		// 		await browser.close();
		// 		return {
		// 			path: thumbnailPath,
		// 		};
		// 	} catch (error) {
		// 		console.error("Error creating PDF thumbnail:", error);
		// 	}
		// },

		async addUnUsedFile(ctx) {
			try {
				const { key, company_id } = ctx.params;

				await this.settings.models.deleteAttachments.create({
					key,
					company_id,
				});
				return {
					code: RESPONSES.status.success,
					message: RESPONSES.messages.s3.file_added,
				};
			} catch (error) {
				console.error("Error adding unused file:", error);
				return {
					code: RESPONSES.status.error,
					message: RESPONSES.messages.internal_server_error,
					error: error.message,
				};
			}
		},

		async deleteUnUsedFiles(ctx) {
			try {
				// delete unused files logic
				// get all files from delete_attachments table
				const allFiles =
					await this.settings.models.deleteAttachments.findAll({
						attribute: ["key"],
					});

				if (!allFiles || allFiles.length === 0) {
					return {
						code: RESPONSES.status.success,
						message: "No unused files found.",
					};
				}
				// now we need to bulk delete files from S3

				const keys = allFiles.map((file) => ({ Key: file.key }));

				const ids = allFiles.map((file) => file.id);

				await Promise.all([
					this.bulkDeleteFromS3(keys),
					this.settings.models.deleteAttachments.destroy({
						where: {
							id: ids,
						},
					}),
				]);

				return {
					code: RESPONSES.status.success,
					message: "Unused files deleted successfully.",
				};
			} catch (error) {
				console.error("Error creating PDF thumbnail:", error);
			}
		},

		async streamFileData(ctx) {
			try {
				const fileUrl = ctx?.params?.file_url;
				const fileKey = ctx?.params?.key || this.getKeyFromUrl(fileUrl);

				const params = {
					Bucket: process.env.AWS_S3_BUCKET_NAME,
					Key: fileKey,
				};

				// get the metaData of the file
				const head = await s3.headObject(params).promise();

				ctx.meta.$responseType = "stream";
				ctx.meta.$responseHeaders = {
					"Content-Type":
						head.ContentType || "application/octet-stream",
					"Content-Length": head.ContentLength,
					"Content-Disposition": `attachment; filename="${fileKey
						.split("/")
						.pop()}"`,
				};

				const fileStream = s3.getObject(params).createReadStream();

				return fileStream;
			} catch (error) {
				console.error("Error streaming file data:", error);
			}
		},
	},

	/**
	 * Service created lifecycle event handler
	 */
	created() {},

	/**
	 * Service started lifecycle event handler
	 */
	async started() {
		const cronJobs = [
			{
				name: "s3DeleteUnUsedFilesCron",
				schedule: "0 0 * * *", // every day at midnight
				action: "s3.deleteUnUsedFiles",
				description: "Cron job executed for S3 unused files deletion",
			},
		];

		this.documentCrons = cronJobs.reduce((acc, job) => {
			acc[job.name] = cron.schedule(job.schedule, async () => {
				console.log(job.description);
				try {
					await this.broker.call(job.action);
				} catch (error) {
					console.error(`Error executing ${job.log}:`, error);
				}
			});
			return acc;
		}, {});
	},

	/**
	 * Service stopped lifecycle event handler
	 */
	async stopped() {
		Object.values(this.documentCrons).forEach((job) => job.stop());
	},
};
