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
const PORT = process.env.PORT || 1420; // Match your frontend port

// Middleware
app.use(cors());

// Support both JSON and URL-encoded data
app.use(bodyParser.json({ 
  verify: (req, res, buf) => { req.rawBody = buf; } 
}));
app.use(bodyParser.urlencoded({ 
  extended: true,
  verify: (req, res, buf) => { req.rawBody = buf; }
}));

// Store webhooks in memory
const webhooks = [
  {"id": "github_1634560000000","event_type": "push","repo": "aalibrahimi/cwa_takeover","branch": "main","author": "aalibrahimi","author_avatar": "https://avatars.githubusercontent.com/u/166450703?v=4","timestamp": "2025-03-12T18:30:45Z","commits":[{"id": "abcd1234","message": "Added webhook integration","author": "aalibrahimi","timestamp": "2025-03-12T18:29:30Z"}]}
];

// Save to file
const saveWebhooks = () => {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'github-webhooks.json'), JSON.stringify(webhooks.slice(-100)));
};

// Test endpoint to verify server is running
app.get('/test', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// GitHub webhook endpoint - support both /api and non-api paths
app.post(['/api/webhooks/github', '/webhooks/github'], (req, res) => {
  try {
    const event = req.headers['x-github-event'];
    console.log(`Received GitHub ${event || 'unknown'} event`);
    
    // If no event header, assume this is a test
    if (!event) {
      console.log('Test request received (no GitHub event header)');
      // Create a test event
      const testEvent = {
        id: `github_test_${Date.now()}`,
        event_type: 'test',
        repo: 'test/repository',
        branch: 'main',
        author: 'test-user',
        author_avatar: '',
        timestamp: new Date().toISOString(),
        commits: [{
          id: 'test123',
          message: 'Test commit from webhook test',
          author: 'test-user',
          timestamp: new Date().toISOString()
        }]
      };
      
      webhooks.unshift(testEvent); // Add to the beginning
      saveWebhooks();
      
      return res.status(200).json({
        success: true,
        message: 'Test webhook processed',
        webhook: testEvent
      });
    }
    
    // Handle ping event
    if (event === 'ping') {
      console.log('Ping event received - webhook verified');
      
      // Create a ping event
      const pingEvent = {
        id: `github_ping_${Date.now()}`,
        event_type: 'ping',
        repo: req.body.repository?.full_name || 'unknown',
        branch: 'main',
        author: req.body.sender?.login || 'github',
        author_avatar: req.body.sender?.avatar_url || '',
        timestamp: new Date().toISOString(),
        commits: []
      };
      
      webhooks.unshift(pingEvent); // Add to the beginning
      saveWebhooks();
      
      return res.status(200).json({
        success: true,
        message: 'Ping event received',
        webhook: pingEvent
      });
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
      
      webhooks.unshift(webhookEvent); // Add to the beginning
      saveWebhooks();
      console.log(`Processed webhook for ${webhookEvent.repo}`);
      
      return res.status(200).json({
        success: true,
        message: 'Webhook processed',
        webhook: webhookEvent
      });
    }
    
    // Default response for unhandled events
    res.status(200).json({ success: true, message: 'Event received but not processed' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false, 
      error: String(error) 
    });
  }
});

// Dedicated test webhook endpoint
app.post(['/api/webhooks/github/test', '/webhooks/github/test'], (req, res) => {
  try {
    console.log('Test webhook endpoint called');
    
    // Create a test event
    const testEvent = {
      id: `github_test_${Date.now()}`,
      event_type: 'test',
      repo: 'aalibrahimi/cwa_takeover',
      branch: 'main',
      author: 'test-user',
      author_avatar: 'https://avatars.githubusercontent.com/u/1',
      timestamp: new Date().toISOString(),
      commits: [{
        id: 'test123',
        message: 'Test commit from webhook test endpoint',
        author: 'test-user',
        timestamp: new Date().toISOString()
      }]
    };
    
    // Add to webhooks array
    webhooks.unshift(testEvent); // Add to the beginning
    saveWebhooks();
    
    res.status(200).json({
      success: true,
      message: 'Test webhook created',
      webhook: testEvent
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: String(error)
    });
  }
});

// API endpoint to get webhooks - support both /api and non-api paths
app.get(['/api/webhooks/github', '/webhooks/github'], (req, res) => {
  try {
    console.log(`Returning ${webhooks.length} webhooks`);
    res.status(200).json(webhooks);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false, 
      error: String(error) 
    });
  }
});

// Catch-all handler
app.all('*', (req, res) => {
  console.log(`Received ${req.method} request to ${req.path}`);
  res.status(404).json({ 
    success: false, 
    error: 'Not found' 
  });
});
// Add this endpoint
app.post('/webhooks/github/test', (req, res) => {
  try {
    console.log('Test webhook requested');
    
    // Create a test webhook event
    const testEvent = {
      id: `github_test_${Date.now()}`,
      event_type: 'test',
      repo: 'aalibrahimi/cwa_takeover',
      branch: 'main',
      author: 'test-user',
      author_avatar: 'https://avatars.githubusercontent.com/u/1',
      timestamp: new Date().toISOString(),
      commits: [{
        id: 'test123',
        message: 'Test commit from webhook test endpoint',
        author: 'test-user',
        timestamp: new Date().toISOString()
      }]
    };
    
    // Add to webhooks array
    webhooks.unshift(testEvent); // Add to the beginning
    saveWebhooks();
    
    res.status(200).json({
      success: true,
      message: 'Test webhook created',
      webhook: testEvent
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: String(error)
    });
  }
});
// Start the server
app.listen(PORT, () => {
  console.log(`Webhook server running at http://localhost:${PORT}`);
  console.log(`Endpoints available:`);
  console.log(`  GET  /api/webhooks/github     - Get all webhooks`);
  console.log(`  POST /api/webhooks/github     - Receive GitHub webhook`);
  console.log(`  POST /api/webhooks/github/test - Create test webhook`);
});