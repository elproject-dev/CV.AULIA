import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8098;
const LOG_FILE = path.join(__dirname, '..', 'ide_bridge_logs.md');

// Initialize or reset the log file on server start
try {
  fs.writeFileSync(LOG_FILE, '# IDE Bridge Active Logs\n\n*Server started. Listening for incoming console/element logs...*\n\n');
  console.log(`[IDE Bridge Server] Initialized log file: ${LOG_FILE}`);
} catch (e) {
  console.error('[IDE Bridge Server] Failed to initialize log file:', e);
}

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/collect') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const { type, content, timestamp } = payload;

        // Construct markdown entry
        const timeStr = new Date(timestamp).toLocaleTimeString();
        const logEntry = `### [${type.toUpperCase()}] at ${timeStr}\n\`\`\`${type === 'element' ? 'html' : 'json'}\n${content}\n\`\`\`\n\n`;

        // 1. Append to log file in workspace
        fs.appendFileSync(LOG_FILE, logEntry);

        // 2. Print directly to terminal console (agent will receive this message)
        console.log(`\n--- IDE BRIDGE RECEIVED [${type.toUpperCase()}] at ${timeStr} ---`);
        console.log(content);
        console.log('-----------------------------------------------------\n');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success' }));
      } catch (err) {
        console.error('[IDE Bridge Server] Error parsing request body:', err);
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, () => {
  console.log(`[IDE Bridge Server] Listening on http://localhost:${PORT}`);
});
