"use strict";

const AWS = require("aws-sdk");
AWS.config.update({
	accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
	region: process.env.AWS_S3_REGION,
});
const path = require("path");
const uploadDir = path.join(__dirname, "..", "..", "assets", "uploads");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });
const s3 = new AWS.S3({
	accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
	region: process.env.AWS_S3_REGION,
	signatureVersion: "v4",
});
const {
	SESv2Client,
	SendEmailCommand,
	GetSuppressedDestinationCommand,
} = require("@aws-sdk/client-sesv2");
const sesClient = new SESv2Client({
	region: "us-east-2",
	credentials: {
		accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
		secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
	},
});
module.exports = {
	name: "s3",
	events: {},
	hooks: {},
	methods: {
		async upload(
			fileInfo,
			dir,
			companyName,
			uniqueName,
			preserveAfterUpload = false,
			isTemporary = false
		) {
			const filePath = fileInfo.customPath
				? fileInfo.customPath
				: path.join(
						uploadDir,
						`${uniqueName}.${fileInfo.originalname}`
				  );
			try {
				const stats = await fs.promises.stat(filePath);
				const size = stats.size / 1024 ; // Convert to KB
				console.log("File size:", size, "KB");
				const fileStream = fs.createReadStream(filePath);
				// const fileBuff = fs.readFileSync(filePath);
				let DateTime = Date.now();
				const s3Key = `${companyName}/images/${dir}/${DateTime}.${fileInfo.originalname}`;
				const fileName = encodeURIComponent(fileInfo.originalname);
				const uploadedImage = await s3
					.upload({
						Bucket: `${process.env.AWS_S3_BUCKET_NAME}`,
						Key: s3Key,
						Body: fileStream,
						ContentType: fileInfo.mimetype,
						ContentDisposition: `attachment; filename="${fileName}"`,
						// Expires: 60 * 60 * 24 * 365,
						Tagging: isTemporary ? "auto-delete=24h" : undefined,
					})
					.promise();

				// Delete the local file after successful upload
				if (!preserveAfterUpload) {
					fs.unlinkSync(filePath);
				}
				return {
					url: uploadedImage.Location,
					fileName: `${DateTime}.${fileInfo.mimetype.split("/")[1]}`,
					size: size || fileInfo.fileSize, // Use size from stats or fallback to fileInfo
					Key: uploadedImage.Key,
				};
			} catch (error) {
				fs.unlinkSync(filePath);
				console.log(error, "error");
				return {
					error: error.message,
				};
			}
		},

		//used for deleting files from the s3
		async fileDeleteFromS3(Key, url) {
			try {
				if (url) {
					const s3Object = url?.split("/");
					let key = s3Object?.slice(3)?.join("/");
					key = decodeURIComponent(key);
					//if key has + in it, replace it with space
					Key = key?.replace(/\+/g, " ");
				}

				const params = {
					Bucket: process.env.AWS_S3_BUCKET_NAME,
					Key: Key,
				};
				const data = await s3.deleteObject(params).promise();
				console.log("File deleted successfully!", data);
				return data;
			} catch (err) {
				console.error("Error deleting file:", err);
			}
		},

		async readFileIntoBuffer(url, keyObj) {
			try {
				// Fetch the S3 object metadata to get the file's key
				const s3Object = url.split("/");
				let key = keyObj ? keyObj : s3Object.slice(3).join("/");
				key = decodeURIComponent(key);
				//if key has + in it, replace it with space
				key = key.replace(/\+/g, " ");
				// Get the S3 object
				const params = {
					Bucket: process.env.AWS_S3_BUCKET_NAME,
					Key: key,
				};

				const s3ObjectData = await s3.getObject(params).promise();

				// Read the S3 object into a buffer
				const buffer = Buffer.from(s3ObjectData.Body);
				return buffer;
			} catch (error) {
				console.error("Error reading S3 file:", error);
				throw error;
			}
		},

		//used for zip & digitally signed pdf file upload
		async directUpload(fileInfo, dir, companyName) {
			// console.log(
			// 	"directUpload***************************************** [1]",
			// 	fileInfo.buffer.data
			// );

			// const filePath = path.join(uploadDir, fileInfo.originalname);
			const fileStream = Buffer.from(fileInfo?.buffer?.data);
			// console.log(
			// 	"directUpload***************************************** [2]",
			// 	fileStream
			// );

			// const fileBuff = fs.readFileSync(filePath);
			let DateTime = Date.now();
			const s3Key = `${companyName}/images/${dir}/${DateTime}.${fileInfo.originalname}`;

			const uploadedImage = await s3
				.upload({
					Bucket: `${process.env.AWS_S3_BUCKET_NAME}`,
					Key: s3Key,
					Body: fileStream,
					ContentType: fileInfo.mimetype,
					ContentDisposition: `attachment; filename="${fileInfo.originalname}"`,
					// Expires: 60 * 60 * 24 * 365,
				})
				.promise();

			console.log(
				"uploadedImage***************************************** [3]",
				uploadedImage
			);

			// Delete the local file after successful upload
			return {
				url: uploadedImage.Location,
				fileName: `${DateTime}.${fileInfo.mimetype.split("/")[1]}`,
				size: fileInfo.fileSize,
				Key: uploadedImage.Key,
			};
		},

		async readFileIntoBufferUsingKey(Key) {
			try {
				const params = {
					Bucket: process.env.AWS_S3_BUCKET_NAME,
					Key,
				};

				const s3ObjectData = s3.getObject(params).createReadStream();

				return s3ObjectData;
			} catch (error) {
				console.error("Error reading S3 file:", error);
				throw error;
			}
		},

		//used for download file functionality
		async getFileAndWrite(Key, path, fileUrl) {
			try {
				if (fileUrl) {
					const s3Object = fileUrl.split("/");
					let key = s3Object.slice(3).join("/");
					key = decodeURIComponent(key);
					Key = key.replace(/\+/g, " ");
				}

				const params = {
					Bucket: process.env.AWS_S3_BUCKET_NAME,
					Key: Key,
				};

				await s3.headObject(params).promise();

				const file = fs.createWriteStream(path);
				const s3Stream = s3.getObject(params).createReadStream();

				const { filePath, fileSize } = await new Promise(
					(resolve, reject) => {
						file.on("finish", async () => {
							try {
								const stats = await fs.promises.stat(path);
								console.log(
									`Uploaded file stored in '${path}'`
								);
								resolve({
									filePath: path,
									fileSize: stats.size,
								});
							} catch (error) {
								reject(error);
							}
						});

						file.on("error", (error) => {
							console.error(
								`File write error for key: ${params.Key}, Error: ${error.message}`
							);
							reject(error);
						});

						s3Stream.on("error", (error) => {
							console.error(
								`S3 stream error for key: ${params.Key}, Error: ${error.message}`
							);
							reject(error);
						});

						s3Stream.pipe(file);
					}
				);
				return { filePath, fileSize, Key: params.Key };
			} catch (error) {
				console.error(
					`Unexpected error in getFileAndWrite for key : ${Key}, Error: ${error.message}`
				);
				return Promise.resolve();
			}
			// return new Promise((resolve, reject) => {
			// 	try {
			// 		const headObject = s3.headObject(params).promise();
			// 		headObject
			// 			.then(() => {
			// 				const file = fs.createWriteStream(path);

			// 				file.on("finish", () => {
			// 					file.close(() => resolve());
			// 				});

			// 				file.on("error", (error) => {
			// 					console.error(
			// 						File write error for key : ${Key}, Error: ${error.message}
			// 					);
			// 					reject(error); // Reject if file write fails
			// 				});

			// 				const s3Stream = s3
			// 					.getObject(params)
			// 					.createReadStream();
			// 				s3Stream.on("error", (error) => {
			// 					// Handle S3 stream errors
			// 					console.error(
			// 						S3 stream error for key : ${Key}, Error: ${error.message}
			// 					);
			// 					reject(error); // Reject if S3 streaming fails
			// 				});
			// 				s3Stream.pipe(file);
			// 			})
			// 			.catch((error) => {
			// 				// Skip if S3 key is invalid
			// 				console.error(
			// 					Invalid S3 key b: ${Key}, Error: ${error.message}
			// 				);
			// 				resolve(); // Resolve to skip this key  and move on
			// 			});
			// 	} catch (error) {
			// 		console.error(
			// 			Error checking S3 key: ${Key}, Error: ${error.message}
			// 		);
			// 		resolve(); // Skip this file and resolve the promise
			// 	}
			// });
		},
		//used for copy & cut files
		async copyFile(oldKey, newKey, fileInfo) {
			try {
				let fileStream = await this.readFileIntoBufferUsingKey(oldKey);

				const uploadedImage = await s3
					.upload({
						Bucket: `${process.env.AWS_S3_BUCKET_NAME}`,
						Key: newKey,
						Body: fileStream,
						ContentType: fileInfo?.mime_type,
						// ContentType: fileInfo?.original_mime_type,
						ContentDisposition: `attachment; filename="${fileInfo?.file_name}"`,
					})
					.promise();
				return {
					objectUrl: uploadedImage.Location,
					key: uploadedImage.Key,
				};
			} catch (err) {
				console.error("Error renaming file:", err);
			}
		},

		//Delete Multiple Files at one time [1000]
		async bulkDeleteFromS3(
			fileKeyArray,
			cb = (err, data) => {
				if (err) console.log("Error deleting objects:", err);
				else {
					console.log("Deleted objects:", data.Deleted);
					return data.Deleted;
				}
			}
		) {
			const params = {
				Bucket: process.env.AWS_S3_BUCKET_NAME,
				Delete: {
					Objects: fileKeyArray,
					Quiet: false,
				},
			};

			s3.deleteObjects(params);
			// s3.deleteObjects(params, (err, data) => {
			// 	if (err) console.log("Error deleting objects:", err);
			// 	else {
			// 		console.log("Deleted objects:", data.Deleted);
			// 		return data.Deleted;
			// 	}
			// });
		},

		//Update File data
		async updateFileData(
			fileName,
			Key,
			MimeType,
			Location,
			updatedFileData
		) {
			const text = updatedFileData.toString("utf-8"); // Specif

			// console.log(text);
			const uploadParams = {
				Bucket: process.env.AWS_S3_BUCKET_NAME,
				Key: Key,
				ContentType: MimeType,
				ContentDisposition: `attachment; filename="${fileName}"`,
				// Location:Location
				Body: updatedFileData,
			};

			s3.putObject(uploadParams, (err, data) => {
				if (err) {
					console.log("Error", err);
				} else {
					console.log("Success", data);
				}
			});
		},

		async getInfo(Key) {
			const params = {
				Bucket: process.env.AWS_S3_BUCKET_NAME,
				Key: Key,
			};
			const data = await s3.headObject(params).promise();

			const size = data.ContentLength;
			return {
				size: size,
				mimeType: data.ContentType,
			};
		},
		async generateSignedURL(Key) {
			const params = {
				Bucket: process.env.AWS_S3_BUCKET_NAME,
				Key,
				Expires: 60 * 60 * 24, // 1 day
			};
			try {
				const url = s3.getSignedUrl("getObject", params);
				return url;
			} catch (error) {
				console.log(error);
			}
		},
		async copyObject(fileInfo, keyPrefix) {
			try {
				let lastSlashIndex = fileInfo?.key?.lastIndexOf("/");
				let subStr = fileInfo?.key?.substring(0, lastSlashIndex);
				let DateTime = Date.now();
				let newKey = `${keyPrefix ? keyPrefix : subStr}${DateTime}.${
					fileInfo?.file_name
				}`;
				let newUrl =
					`https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_S3_REGION}.amazonaws.com/${newKey}`.replace(
						/ /g,
						"+"
					);

				const params = {
					Bucket: process.env.AWS_S3_BUCKET_NAME,
					CopySource: encodeURIComponent(
						`${process.env.AWS_S3_BUCKET_NAME}/${fileInfo?.key}`
					),
					Key: newKey,
				};
				// Function to copy the object

				await s3
					.copyObject(params, (err, data) => {
						if (err) {
							console.log("Error", err);
						} else {
							console.log("Success, object copied", data);
						}
					})
					.promise();

				return {
					fileUrl: newUrl,
					key: newKey,
				};
			} catch (err) {
				console.error("Error renaming file:", err);
			}
		},
		async isEmailSuppressed(email) {
			try {
				const command = new GetSuppressedDestinationCommand({
					EmailAddress: email,
				});
				const response = await sesClient.send(command);
				console.log("Email is in suppression list:");
				console.log("Reason:", response.SuppressedDestination.Reason);
				console.log(
					"LastUpdateTime:",
					response.SuppressedDestination.LastUpdateTime
				);
				return true;
			} catch (error) {
				if (error.name === "NotFoundException") {
					console.log("Email is NOT in the suppression list.");
					return false;
				} else {
					console.error("Error checking suppression list:", error);
					throw error;
				}
			}
		},
	},
	settings: {},
	actions: {},
};
