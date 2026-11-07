import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { getAuthenticatedDriveClient } from './auth.js';
import { GoogleDriveService } from './driveService.js';
import { MockDriveService } from './scripts/mockDrive.js';
import { DriveAgent } from './agent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, '../public');

const PORT = process.env.PORT || 3000;

let driveService;
let isMock = false;

// Initialize Drive backend
async function setupDrive() {
  if (config.mockMode || (!config.google.clientId && !config.google.serviceAccountKeyPath)) {
    console.log('[Server] Using Mock Drive simulator.');
    driveService = new MockDriveService();
    isMock = true;
    return;
  }

  try {
    const driveClient = await getAuthenticatedDriveClient();
    driveService = new GoogleDriveService(driveClient);
    isMock = false;
    console.log('[Server] Connected to live Google Drive API.');
  } catch (err) {
    console.warn(`[Server] Live Drive auth failed (${err.message}). Using Mock Drive.`);
    driveService = new MockDriveService();
    isMock = true;
  }
}

await setupDrive();

// Initialize Agent
let currentSessionTools = [];
const agent = new DriveAgent({
  apiKey: config.gemini.apiKey,
  model: config.gemini.model,
  driveService,
  onActivity: (activity) => {
    if (activity.type === 'tool_call') {
      currentSessionTools.push({
        name: activity.name,
        args: activity.args,
        result: null,
      });
    } else if (activity.type === 'tool_result') {
      const last = currentSessionTools[currentSessionTools.length - 1];
      if (last && last.name === activity.name) {
        last.result = activity.result;
      }
    }
  },
});

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // 1. API: Status
  if (url.pathname === '/api/status' && req.method === 'GET') {
    return sendJson(res, 200, {
      mode: isMock ? 'mock' : 'live',
      currentFolder: agent.sessionContext.currentFolderName || 'My Drive',
      currentFolderId: agent.sessionContext.currentFolderId || 'root',
    });
  }

  // 2. API: Starred Files
  if (url.pathname === '/api/starred' && req.method === 'GET') {
    try {
      const starred = await driveService.getStarredFiles({ pageSize: 10 });
      return sendJson(res, 200, { starred });
    } catch (e) {
      return sendJson(res, 500, { error: e.message });
    }
  }

  // 3. API: Chat
  if (url.pathname === '/api/chat' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const userMessage = body.message;

      if (!userMessage || !userMessage.trim()) {
        return sendJson(res, 400, { error: 'Message cannot be empty.' });
      }

      currentSessionTools = []; // Reset tool tracker for this turn
      const reply = await agent.chat(userMessage);

      // Get breadcrumbs for current location
      let currentPathStr = 'My Drive';
      try {
        const path = await driveService.getFolderPath({ folderId: agent.sessionContext.currentFolderId });
        currentPathStr = path.map(p => p.name).join(' / ');
      } catch (e) {
        // Fallback
      }

      return sendJson(res, 200, {
        reply,
        tools: currentSessionTools,
        currentFolder: currentPathStr,
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 4. API: Clear history
  if (url.pathname === '/api/clear' && req.method === 'POST') {
    agent.resetHistory();
    return sendJson(res, 200, { success: true });
  }

  // 5. Static: Serve index.html
  if (url.pathname === '/' || url.pathname === '/index.html') {
    try {
      const htmlPath = path.join(PUBLIC_DIR, 'index.html');
      const content = await fs.readFile(htmlPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
      return;
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error loading HTML interface.');
      return;
    }
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`\n=============================================================`);
  console.log(`🚀 DriveAgent AI Web Server is running!`);
  console.log(`👉 Open your browser at: http://localhost:${PORT}`);
  console.log(`=============================================================\n`);
});
