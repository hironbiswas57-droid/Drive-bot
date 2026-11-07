import fs from 'fs/promises';
import { google } from 'googleapis';
import http from 'http';
import url from 'url';
import { config } from './config.js';

const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly'
];

/**
 * Creates and authenticates a Google Drive API client.
 */
export async function getAuthenticatedDriveClient() {
  // 1. Check if Service Account credentials are provided
  if (config.google.serviceAccountKeyPath) {
    const auth = new google.auth.GoogleAuth({
      keyFile: config.google.serviceAccountKeyPath,
      scopes: SCOPES,
    });
    return google.drive({ version: 'v3', auth });
  }

  // 2. OAuth2 Desktop client flow
  if (!config.google.clientId || !config.google.clientSecret) {
    throw new Error(
      'Missing Google Drive credentials. Please provide GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env, or set USE_MOCK_DRIVE=true.'
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );

  // Check if we already have saved tokens
  try {
    const tokenData = await fs.readFile(config.google.tokenPath, 'utf8');
    const tokens = JSON.parse(tokenData);
    oauth2Client.setCredentials(tokens);

    // Set automatic token refresh callback
    oauth2Client.on('tokens', async (newTokens) => {
      const mergedTokens = { ...tokens, ...newTokens };
      await fs.writeFile(config.google.tokenPath, JSON.stringify(mergedTokens, null, 2));
    });

    return google.drive({ version: 'v3', auth: oauth2Client });
  } catch (err) {
    // Tokens not found or invalid; perform user authorization flow
    return await authorizeWithLocalServer(oauth2Client);
  }
}

/**
 * Spins up a temporary local HTTP server to receive the OAuth2 callback.
 */
async function authorizeWithLocalServer(oauth2Client) {
  return new Promise((resolve, reject) => {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent'
    });

    console.log('\n============================================================');
    console.log('Google Drive Authorization Required');
    console.log('Please open this URL in your browser:');
    console.log(authUrl);
    console.log('============================================================\n');

    const server = http.createServer(async (req, res) => {
      try {
        const parsedUrl = url.parse(req.url, true);
        if (parsedUrl.pathname === '/oauth2callback') {
          const code = parsedUrl.query.code;
          if (!code) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Missing code parameter.');
            return;
          }

          const { tokens } = await oauth2Client.getToken(code);
          oauth2Client.setCredentials(tokens);

          // Save token to file
          await fs.writeFile(config.google.tokenPath, JSON.stringify(tokens, null, 2));

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h3>Authentication successful! You can close this tab and return to the terminal.</h3>');

          server.close();
          const drive = google.drive({ version: 'v3', auth: oauth2Client });
          resolve(drive);
        }
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Authentication error: ${e.message}`);
        server.close();
        reject(e);
      }
    });

    server.listen(3000, () => {
      console.log('Waiting for authentication on http://localhost:3000/oauth2callback ...');
    });

    server.on('error', (err) => {
      reject(new Error(`Failed to start local OAuth server: ${err.message}`));
    });
  });
}
