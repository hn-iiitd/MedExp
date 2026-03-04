// Google OAuth and Gmail API service
const { google } = require('googleapis');

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function getAuthUrl() {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/gmail.readonly',
    ],
  });
}

async function getTokensFromCode(code) {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

async function getUserInfo(accessToken) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();
  return data;
}

function getAuthenticatedClient(accessToken, refreshToken) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return oauth2Client;
}

async function fetchEmailsWithAttachments(accessToken, refreshToken) {
  const auth = getAuthenticatedClient(accessToken, refreshToken);
  const gmail = google.gmail({ version: 'v1', auth });

  // Search for emails with attachments that look like bills/invoices
  const query = 'has:attachment (filename:pdf OR filename:xlsx OR filename:xls OR filename:csv) newer_than:6m';
  
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: 50,
  });

  const messages = res.data.messages || [];
  return messages;
}

async function getEmailDetails(accessToken, refreshToken, messageId) {
  const auth = getAuthenticatedClient(accessToken, refreshToken);
  const gmail = google.gmail({ version: 'v1', auth });

  const msg = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  return msg.data;
}

async function getAttachment(accessToken, refreshToken, messageId, attachmentId) {
  const auth = getAuthenticatedClient(accessToken, refreshToken);
  const gmail = google.gmail({ version: 'v1', auth });

  const attachment = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId: messageId,
    id: attachmentId,
  });

  // Attachment data is base64url encoded
  return Buffer.from(attachment.data.data, 'base64');
}

module.exports = {
  getAuthUrl,
  getTokensFromCode,
  getUserInfo,
  fetchEmailsWithAttachments,
  getEmailDetails,
  getAttachment,
};
