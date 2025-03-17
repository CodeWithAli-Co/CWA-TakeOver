import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
// Need to work on Making this work
// Middleware
app.use('*', cors());

// Support both JSON and URL-encoded data
app.use(bodyParser.json({ 
  verify: (req, res, buf) => { req.rawBody = buf; } 
}));
app.use(bodyParser.urlencoded({ 
  extended: true,
  verify: (req, res, buf) => { req.rawBody = buf; }
}));

// Store webhooks in memory
// JSON Dummy Data
const webhooks = [];

// Save to file
const saveWebhooks = () => {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'github-webhooks.json'), JSON.stringify(webhooks.slice(-100)));
};

// GitHub webhook endpoint
app.post('/api/webhooks/github', (req, res) => {
  try {
    const event = req.headers['x-github-event'];
    console.log(`Received GitHub ${event} event`);
    console.log('Headers:', JSON.stringify(req.headers));
    console.log('Body:', JSON.stringify(req.body));
    
    // Handle ping event
    if (event === 'ping') {
      console.log('Ping event received - webhook verified');
      return res.status(200).send({ pingRes: "Pong!" });
    }
    
    // Handle push event
    if (event === 'push') {
      const payload = req.body;
      
      const webhookEvent = {
        id: `github_${Date.now()}`,
        event_type: 'push',
        repo: payload.repository?.full_name || 'unknown',
        branch: payload.ref ? payload.ref.split('/').pop() : 'unknown',
        author: payload.pusher?.name || 'unknown',
        author_avatar: payload.sender?.avatar_url || '',
        timestamp: new Date().toISOString(),
        commits: (payload.commits || []).map(commit => ({
          id: commit.id || 'unknown',
          message: commit.message || '',
          author: commit.author?.name || 'unknown',
          timestamp: commit.timestamp || new Date().toISOString(),
        })),
      };
      
      webhooks.push(webhookEvent);
      saveWebhooks();
      console.log(`Processed webhook for ${webhookEvent.repo}`);
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error:', error);
    res.status(200).send('Processed with errors');
  }
});

// API endpoint to get webhooks
app.get('/webhooks/github', (req, res) => {
  console.log('Fetched Data Server-side:', webhooks)
  res.send(webhooks);
});

app.get('/testhook', (req, res) => {
  console.log('Fetched Data Server-side')
  res.send({ testHook: "bruh" });
});

// Catch-all handler
app.all('*', (req, res) => {
  console.log(`Received ${req.method} request to ${req.path}`);
  res.status(404).send('Not found');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Webhook server running at http://localhost:${PORT}`);
});