require("dotenv").config();
const serverURL = process.env.STATIC_ASSETS_URL;
function getStaticPartForMail(type, isDocumentLibraryMail) {
	if (isDocumentLibraryMail) {
		switch (type) {
			case "recipient_removed":
				return `<td align="center" class="notification-box" style="background: #fa5252; color: white">
                                <img class="icon" alt="action-icon" src="${serverURL}/email/remove-icon.png" width="50" height="50" />
                                <h1 style="color: white;">Document Access Revoked</h1>
                            </td>`;
			case "shared_document":
				return `<td align="center" class="notification-box">
                                <img class="icon" alt="action-icon" src="${serverURL}/email/DocIcon.png" width="50" height="50" />
                                <h1>Shared Documents</h1>
                            </td>`;
		}
	} else {
		switch (type) {
			case "document_sign_request":
			case "document_resend":
				return `<td align="center" class="notification-box">
                                <img class="icon" alt="action-icon" src="${serverURL}/email/signature-icon.png" color:"red" width="50" height="50" />
                                <h1>Action Required: Sign Document</h1>
                                <p>
                         The document <b>"\${document_name}"</b> has been
                         shared with you for signing
                     </p>
                    <!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
href="\${signature_link}" style="height:50px;v-text-anchor:middle;width:250px;" arcsize="10%" strokecolor="#e6a728" fillcolor="white">
<w:anchorlock/>
<center style="color:#e6a728;font-family:sans-serif;font-size:14px;font-weight:bold;">Review & Sign Document</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-->
                     <a href="\${signature_link}" class="view-button">
                         Review & Sign Document
                     </a>
                    <!--<![endif]-->
                            </td>`;
			case "document_viewer":
				return `<td align="center" class="notification-box">
                                <img class="icon" alt="action-icon" src="${serverURL}/email/viewer-icon.png" width="50" height="50" />
                                <h1>Document Available for Viewing</h1>
                     <p>
                         The document <b>"\${document_name}"</b> has been
                         shared with you for viewing
                     </p>
                    <!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
href="\${signature_link}" style="height:50px;v-text-anchor:middle;width:250px;" arcsize="10%" strokecolor="#e6a728" fillcolor="white">
<w:anchorlock/>
<center style="color:#e6a728;font-family:sans-serif;font-size:14px;font-weight:bold;">View Document</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-->
                     <a href="\${signature_link}" class="view-button">
                         View Document
                     </a>
                    <!--<![endif]-->
                            </td>`;
			case "document_signed_by_all_recipients":
				return `<td align="center" class="notification-box">
                                <img class="icon" alt="action-icon" src="${serverURL}/email/completed-icon.png" width="50" height="50" />
                                <h1>Document Fully Signed</h1>
                     <p>
                         The document <b>"\${document_name}"</b> has been
                         signed and completed
                     </p>
                    <!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
href="\${signature_link}" style="height:50px;v-text-anchor:middle;width:250px;" arcsize="10%" strokecolor="#e6a728" fillcolor="white">
<w:anchorlock/>
<center style="color:#e6a728;font-family:sans-serif;font-size:14px;font-weight:bold;">View Document</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-->
                     <a href="\${signature_link}" class="view-button">
                         View Document
                     </a>
                    <!--<![endif]-->
                            </td>`;
			case "document_link_expired":
				return `<td align="center" class="notification-box" style="background: #fa5252; color: white">
                                <img class="icon" alt="action-icon" src="${serverURL}/email/expired-icon.png" width="50" height="50" />
                                <h1 style="color: white;">Document Expired</h1>
                     <p>
                         The link for the document{" "}
                         <b>"\${document_name}"</b> has expired and is no
                        longer accessible for signing
                     </p>
                    <!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
href="\${signature_link}" style="height:50px;v-text-anchor:middle;width:250px;" arcsize="10%" strokecolor="#c92a2a" fillcolor="white">
<w:anchorlock/>
<center style="color:#c92a2a;font-family:sans-serif;font-size:14px;font-weight:bold;">Resend Document</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-->
                     <a
                         href="\${signature_link}"
                         class="view-button"
                         style="color: #c92a2a; border-color: #c92a2a;"
                     >
                         Resend Document
                     </a>
                            </td>`;
			case "document_voided":
				return `<td align="center" class="notification-box" style="background: #fa5252; color: white">
                                <img class="icon" alt="action-icon" src="${serverURL}/email/stamping-void-icon.png" width="60" height="60" />
                                <h1 style="color: white;">Document Voided</h1>
             <p>The document <b>"\${document_name}"</b> has been voided</p>
             <!--<a href="\${signature_link}" class="view-button" style="color: #c92a2a; border-color: #c92a2a;">Resend Document</a>-->
                            </td>`;
			case "document_deleted":
				return `<td align="center" class="notification-box" style="background: #fa5252; color: white">
                                <img class="icon" alt="action-icon" src="${serverURL}/email/delete-icon.png" width="50" height="50" />
                                <h1 style="color: white;">Document Deleted</h1>
             <p>The document <b>"\${document_name}"</b> has been deleted</p>
             <!--<a href="\${signature_link}" class="view-button" style="color: #c92a2a; border-color: #c92a2a;">Resend Document</a>-->
                            </td>`;
			case "recipient_removed":
				return `<td align="center" class="notification-box" style="background: #fa5252; color: white">
                                <img class="icon" alt="action-icon" src="${serverURL}/email/remove-icon.png" width="50" height="50" />
                                <h1 style="color: white;">Document Access Revoked</h1>
             <p>The access to the document <b>"\${document_name}"</b> has been revoked, and it can no longer be signed</p>
             <!--<a href="\${signature_link}" class="view-button" style="color: #c92a2a; border-color: #c92a2a;">Resend Document</a>-->
                            </td>`;
			case "reminder_to_sign_document":
				return `<td align="center" class="notification-box">
                                <img class="icon" alt="action-icon" src="${serverURL}/email/reminder-icon.png" width="50" height="50" />
                                <h1>Reminder: Please Sign Document</h1>
             <!--<p>The access to the document <b>"\${document_name}"</b> has been revoked, and it can no longer be signed</p>-->
             <!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
href="\${signature_link}" style="height:50px;v-text-anchor:middle;width:250px;" arcsize="10%" strokecolor="#e6a728" fillcolor="white">
<w:anchorlock/>
<center style="color:#e6a728;font-family:sans-serif;font-size:14px;font-weight:bold;">Sign Document</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-->
             <a href="\${signature_link}" class="view-button">Sign Document</a>
             <!--<![endif]-->
                            </td>`;
			case "document_declined_by_recipient":
				return `<td align="center" class="notification-box" style="background: #fa5252; color: white">
                                <img class="icon" alt="action-icon" src="${serverURL}/email/void-icon.png" width="50" height="50" />
                                <h1 style="color: white;">Document Declined</h1>
             <p>
                 The document <b>"\${document_name}"</b> was declined for signing
             </p>
                            </td>`;
			case "undeliverable_document":
				return `<td align="center" class="notification-box" style="background: #fa5252; color: white">
                                <img class="icon" alt="action-icon" src="${serverURL}/email/bounce-mail.png" width="50" height="50" />
                               <h1 style="color: white;">Document Undeliverable</h1>
             <p>
                 The document <b>"\${document_name}"</b> is undeliverable
             </p>
                            </td>`;
			case "reminder_to_sign_document_forever":
				return `<td align="center" class="notification-box">
                                <img class="icon" alt="action-icon" src="${serverURL}/email/reminder-icon.png" width="50" height="50" />
                                <h1>Reminder: Please Sign Document</h1>
             <!--<p>The access to the document <b>"\${document_name}"</b> has been revoked, and it can no longer be signed</p>-->
             <!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
href="\${signature_link}" style="height:50px;v-text-anchor:middle;width:250px;" arcsize="10%" strokecolor="#e6a728" fillcolor="white">
<w:anchorlock/>
<center style="color:#e6a728;font-family:sans-serif;font-size:14px;font-weight:bold;">Sign Document</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-->
             <a href="\${signature_link}" class="view-button">Sign Document</a>
             <!--<![endif]-->
                            </td>`;
			default:
				break;
		}
	}
}

const documentTemplate = function (
	type,
	dynamicContent,
	isDocumentLibraryMail
) {
	return `<html>

<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Document Notification</title>
<style>
@import url("https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,200..1000;1,200..1000&display=swap");

body {
    margin: 0;
    padding: 0;
    background: #f3f3f3;
}

table {
    border-spacing: 0;
    width: 100%;
    border: collapse;
}

.p-0 {
    padding: 0;
}

.email-wrapper {
    max-width: 800px;
    margin: 0 auto;
    padding: 40px;
}

.email-container {
    width: 100%;
    border: 1px solid #001689;
    border-radius: 15px;
    overflow: hidden;
    background: #001689;
}

.email-content {
    width: 100%;
    background: white;
    border-bottom-right-radius: 100px;
}

.corner-top {
    height: 8px;
    width: 95%;
    background: #001689;
    margin: 0 auto;
    border-bottom-left-radius: 10px;
    border-bottom-right-radius: 10px;
}

.notification-box-container {
   padding: 25px 42px;
}

.notification-box {
    background-color: #ffcc80;
    padding: 10px;
    text-align: center;
    border-radius: 10px;
    width: 100%;
}

.icon {
    width: ${type === "document_voided" ? "60px" : "50px"};
    height: ${type === "document_voided" ? "60px" : "50px"};
    margin-bottom: 0px;
}

.view-button {
    display: inline-block;
    background-color: #ffffff;
    color: #e6a728 !important;
    padding: 12px 30px;
    text-decoration: none;
    border-radius: 6px;
    border: 1px solid #e6a728;
    margin: 6px 0 20px 0;
    font-weight: bold;
}

a[href] {
    color: #e6a728 !important;
}

.content {
    padding: 0 42px 12px 42px;
    line-height: 1.6;
}

.footer {
    text-align: center;
    margin-top: 20px;
    color: #888;
    font-size: 16px;
}

.footer-td {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: center;
    gap: 10px;
}

h1 {
    color: #232323;
    font-size: 24px;
    margin-bottom: 15px;
}

.logo {
    max-width: 90px;
    height: 30px;
    vertical-align: middle;
    margin-left: 4px;
}
</style>
</head>

<body>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f3f3f3; width: 100%; margin: 0; padding: 0;">
<table class="email-wrapper" align="center">
<tr>
    <td>
        <table class="email-container" align="center">
            <tr class="p-0">
                <td class="p-0">
                    <table class="email-content">
                        <tr class="p-0">
                            <td class="p-0">
                                <div class="corner-top"></div>
                            </td>
                        </tr>
                        <tr >
                        <td class="notification-box-container">
                                <table width="100%" cellspacing="0" cellpadding="0">
                                    <tr>
   
           ${getStaticPartForMail(type, isDocumentLibraryMail)}
             </tr>
                                </table>
                            </td>
             </tr>
   
             <tr>
                            <td class="content">
               ${dynamicContent}
             </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
         
        <table align="center" class="footer" style="width: 100%; text-align: center;">
            <tr>
                <!-- Empty cell for spacing -->
                <td style="width: 35%;"></td>

                <!-- Centered content -->
                <td style="text-align: center; font-size: 16px; color: #888; white-space: nowrap;" valign="middle">
                    Powered by
                    <img src="${serverURL}/email/logo.png" alt="Company Logo" class="logo" width="90" height="30" style="max-width: 90px; vertical-align: middle; margin-left: 5px;" />
                </td>

                <!-- Empty cell for spacing -->
                <td style="width: 35%;"></td>
            </tr>
        </table>
    </td>
</tr>
</table>
</table>
</body>

</html>`;
};

module.exports = {
	documentTemplate,
	getStaticPartForMail,
};
