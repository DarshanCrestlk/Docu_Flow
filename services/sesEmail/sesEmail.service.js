"use strict";

const https = require("https");
const { SESv2Client, SendEmailCommand } = require("@aws-sdk/client-sesv2");
const RESPONSES = require("../../config/constants/messages");

const sesClient = new SESv2Client({
	region: process.env.AWS_SES_REGION || process.env.AWS_S3_REGION || "us-east-2",
	credentials: {
		accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
		secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
	},
});

const FROM_EMAIL =
	process.env.SES_FROM_EMAIL || "no-reply@slicehr.com";
const SES_CONFIGURATION_SET =
	process.env.SES_PDF_FORM_CONFIGURATION_SET || "HRMS-SliceSeal";

module.exports = {
	name: "sesEmail",

	settings: {},

	methods: {
		buildRawHtmlEmail({ senderName, recipient, subject, mailBody }) {
			const boundary = "----=_NextPart_001_0000_01D3_0A00_12345678";

			return [
				`From: ${senderName} <${FROM_EMAIL}>`,
				`To: ${recipient}`,
				`Subject: ${subject}`,
				"MIME-Version: 1.0",
				`Content-Type: multipart/mixed; boundary="${boundary}"`,
				`X-SES-CONFIGURATION-SET: ${SES_CONFIGURATION_SET}`,
				"",
				`--${boundary}`,
				"Content-Type: text/html; charset=UTF-8",
				"Content-Transfer-Encoding: 7bit",
				"",
				mailBody,
				"",
				`--${boundary}--`,
			].join("\r\n");
		},

		async sendRawHtmlEmail({ senderName, recipient, subject, mailBody }) {
			const rawMessage = this.buildRawHtmlEmail({
				senderName,
				recipient,
				subject,
				mailBody,
			});

			return sesClient.send(
				new SendEmailCommand({
					FromEmailAddress: `${senderName} <${FROM_EMAIL}>`,
					Destination: {
						ToAddresses: [recipient],
					},
					Content: {
						Raw: {
							Data: Buffer.from(rawMessage, "utf-8"),
						},
					},
				})
			);
		},
	},

	actions: {
		sendSliceSealForm: {
			async handler(ctx) {
				try {
					const { mailArr, trackEvent } = ctx.params;

					if (!mailArr?.length) {
						return {
							code: RESPONSES.status.bad_request,
							message: "mailArr is required",
						};
					}

					const responseArr = await Promise.all(
						mailArr.map(async (email) => {
							const {
								formId,
								companyId,
								senderName,
								recipient,
								subject,
								mailBody,
								role,
							} = email;

							const emailResponse = await this.sendRawHtmlEmail({
								senderName,
								recipient,
								subject,
								mailBody,
							});

							return {
								formId,
								companyId,
								email: recipient,
								role,
								...emailResponse,
							};
						})
					);

					if (trackEvent && responseArr.length) {
						await this.broker.call("pdfForms.updateRecipientStatus", {
							data: responseArr,
							event: "send",
							company_id: responseArr[0]?.companyId,
						});
					}

					return {
						code: RESPONSES.status.success,
						message: "Email sent successfully",
						data: responseArr,
					};
				} catch (err) {
					this.logger.error("Error sending PDF form email", err);
					return {
						code: RESPONSES.status.error,
						message: RESPONSES.messages.internal_server_error,
						error: err.message,
					};
				}
			},
		},

		trackEventSliceSealForm: {
			authorization: false,
			async handler(ctx) {
				try {
					let { Type, Message, SubscribeURL } = ctx.params;

					if (Type === "SubscriptionConfirmation") {
						this.logger.info(
							`Confirming SNS subscription at: ${SubscribeURL}`
						);
						https.get(SubscribeURL, (response) => {
							this.logger.info(
								"SNS subscription confirmed:",
								response.statusCode
							);
						});
						return { code: RESPONSES.status.success };
					}

					if (Type !== "Notification") {
						return { code: RESPONSES.status.success };
					}

					Message = JSON.parse(ctx.params.Message);

					if (Message.eventType === "Bounce") {
						await this.broker.call("pdfForms.updateRecipientStatus", {
							event: "bounced",
							data: Message?.mail?.messageId,
						});
					}

					return { code: RESPONSES.status.success };
				} catch (err) {
					this.logger.error("Error processing SES SNS event", err);
					return {
						code: RESPONSES.status.error,
						message: RESPONSES.messages.internal_server_error,
						error: err.message,
					};
				}
			},
		},
	},
};
