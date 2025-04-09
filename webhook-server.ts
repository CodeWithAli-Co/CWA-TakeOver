import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Type definitions
interface GitHubCommit {
  id: string;
  message: string;
  author: string;
  timestamp: string;
}

interface GitHubWebhookEvent {
  id: string;
  event_type: string;
  repo: string;
  branch: string;
  author: string;
  author_avatar: string;
  timestamp: string;
  commits: GitHubCommit[];
  received_at?: string;
}

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 1420; // Match your frontend port

// Middleware
app.use(cors());

// Support both JSON and URL-encoded data
app.use(bodyParser.json({ 
  verify: (req: RequestWithRawBody, res: Response, buf: Buffer) => { 
    req.rawBody = buf; 
  } 
}));

app.use(bodyParser.urlencoded({ 
  extended: true,
  verify: (req: RequestWithRawBody, res: Response, buf: Buffer) => { 
    req.rawBody = buf;
  }
}));

// Store webhooks in memory
const webhooks: GitHubWebhookEvent[] = [
  {
    "id": "github_1634560000000",
    "event_type": "push",
    "repo": "aalibrahimi/cwa_takeover",
    "branch": "main",
    "author": "aalibrahimi",
    "author_avatar": "https://avatars.githubusercontent.com/u/166450703?v=4",
    "timestamp": "2025-03-12T18:30:45Z",
    "commits": [{
      "id": "abcd1234",
      "message": "Added webhook integration",
      "author": "aalibrahimi",
      "timestamp": "2025-03-12T18:29:30Z"
    }]
  }
];

// Save to file
const saveWebhooks = (): void => {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataDir, 'github-webhooks.json'), 
    JSON.stringify(webhooks.slice(-100), null, 2)
  );
};

// GitHub webhook endpoint
app.post('/webhooks/github', (req: Request, res: Response) => {
  try {
    const event = req.headers['x-github-event'] as string | undefined;
    console.log(`Received GitHub ${event || 'unknown'} event`);
    console.log('Headers:', JSON.stringify(req.headers));
    console.log('Body:', JSON.stringify(req.body));
    
    // Handle ping event
    if (event === 'ping') {
      console.log('Ping event received - webhook verified');
      
      // Create a ping event
      const pingEvent: GitHubWebhookEvent = {
        id: `github_ping_${Date.now()}`,
        event_type: 'ping',
        repo: req.body.repository?.full_name || 'unknown',
        branch: 'main',
        author: req.body.sender?.login || 'github',
        author_avatar: req.body.sender?.avatar_url || '',
        timestamp: new Date().toISOString(),
        commits: []
      };
      
      webhooks.unshift(pingEvent); // Add to beginning
      saveWebhooks();
      
      return res.status(200).json({
        success: true,
        message: 'Ping received',
        webhook: pingEvent
      });
    }
    
    // Handle push event
    if (event === 'push') {
      const payload = req.body;
      
      const webhookEvent: GitHubWebhookEvent = {
        id: `github_${Date.now()}`,
        event_type: 'push',
        repo: payload.repository?.full_name || 'unknown',
        branch: payload.ref ? payload.ref.split('/').pop() : 'unknown',
        author: payload.pusher?.name || 'unknown',
        author_avatar: payload.sender?.avatar_url || '',
        timestamp: new Date().toISOString(),
        commits: (payload.commits || []).map((commit: any) => ({
          id: commit.id || 'unknown',
          message: commit.message || '',
          author: commit.author?.name || 'unknown',
          timestamp: commit.timestamp || new Date().toISOString(),
        })),
      };
      
      webhooks.unshift(webhookEvent); // Add to beginning
      saveWebhooks();
      console.log(`Processed webhook for ${webhookEvent.repo}`);
      
      return res.status(200).json({
        success: true,
        message: 'Webhook processed',
        webhook: webhookEvent
      });
    }
    
    // Default response for other events
    res.status(200).json({
      success: true,
      message: 'Webhook received'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API endpoint to get webhooks
app.get('/webhooks/github', (req: Request, res: Response) => {
  console.log(`Returning ${webhooks.length} webhooks`);
  res.json(webhooks);
});

// Test webhook endpoint
app.post('/webhooks/github/test', (req: Request, res: Response) => {
  try {
    console.log('Test webhook requested');
    
    // Create a test webhook event
    const testEvent: GitHubWebhookEvent = {
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
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Catch-all handler
app.all('*', (req: Request, res: Response) => {
  console.log(`Received ${req.method} request to ${req.path}`);
  res.status(404).json({
    success: false,
    error: 'Not found'
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Webhook server running at http://localhost:${PORT}`);
  console.log(`Endpoints available:`);
  console.log(`  GET  /webhooks/github       - Get all webhooks`);
  console.log(`  POST /webhooks/github       - Receive GitHub webhook`);
  console.log(`  POST /webhooks/github/test  - Create test webhook`);
});