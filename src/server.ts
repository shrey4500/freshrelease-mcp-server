import express from 'express';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

const app = express();
const PORT = process.env.PORT || 3000;

const API_TOKEN = process.env.FRESHRELEASE_API_TOKEN || '';

if (!API_TOKEN) {
  console.error('FRESHRELEASE_API_TOKEN environment variable is required');
  process.exit(1);
}

app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'freshrelease-mcp-server',
    version: '1.0.0',
    endpoints: {
      health: '/',
      mcp_sse: '/sse',
      tools_list: '/tools',
      tools_call: '/tools/call'
    }
  });
});

app.get('/tools', (req, res) => {
  res.json({
    tools: [
      {
        name: "freshrelease_get_users",
        description: "Get all users in the Freshrelease project",
        inputSchema: {
          type: "object",
          properties: {
            page: { type: "number", description: "Page number", default: 1 },
          },
        },
      },
      {
        name: "freshrelease_get_issue",
        description: "Get a specific issue by key",
        inputSchema: {
          type: "object",
          properties: {
            issue_key: { type: "string", description: "Issue key (e.g., FBOTS-123)" },
          },
          required: ["issue_key"],
        },
      },
    ],
  });
});

app.post('/tools/call', async (req, res) => {
  try {
    const { name, arguments: args } = req.body;
    
    const BASE_URL = "https://freshworks.freshrelease.com";
    const PROJECT_KEY = "FBOTS";
    
    const headers: Record<string, string> = {
      "Authorization": `Token ${API_TOKEN}`,
      "Content-Type": "application/json",
    };

    switch (name) {
      case "freshrelease_get_users": {
        const page = args?.page || 1;
        const response = await fetch(`${BASE_URL}/${PROJECT_KEY}/users?page=${page}`, {
          method: "GET",
          headers,
        });
        const data = await response.json();
        res.json({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
        break;
      }

      case "freshrelease_get_issue": {
        const issue_key = args?.issue_key;
        if (!issue_key) {
          return res.status(400).json({ error: "issue_key is required" });
        }
        const response = await fetch(`${BASE_URL}/${PROJECT_KEY}/issues/${issue_key}`, {
          method: "GET",
          headers,
        });
        const data = await response.json();
        res.json({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
        break;
      }

      default:
        res.status(400).json({ error: `Unknown tool: ${name}` });
    }
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// SSE endpoint
app.get('/sse', async (req, res) => {
  console.log('=== New MCP SSE connection ===');
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  
  req.socket.setTimeout(0);
  req.socket.setNoDelay(true);
  req.socket.setKeepAlive(true);
  
  try {
    const transport = new SSEServerTransport('/messages', res);
    console.log('Transport created');
    
    const createServerModule = await import('./index.js');
    const mcpServer = createServerModule.default({ config: { apiToken: API_TOKEN } });
    
    // Log all server events
    mcpServer.onclose = () => {
      console.log('Server onclose event');
    };
    
    await mcpServer.connect(transport);
    console.log('✓ Server connected');
    
    // Keep connection alive with heartbeat
    const heartbeat = setInterval(() => {
      if (!res.writableEnded) {
        console.log('Heartbeat');
      } else {
        clearInterval(heartbeat);
      }
    }, 30000);
    
    req.on('close', () => {
      console.log('Client close event');
      clearInterval(heartbeat);
      mcpServer.close?.();
    });
    
    req.on('error', (error) => {
      console.error('Connection error:', error.message);
      clearInterval(heartbeat);
      mcpServer.close?.();
    });
    
  } catch (error) {
    console.error('✗ Setup failed:', error);
    if (!res.headersSent) {
      res.status(500).end();
    }
  }
});

// Log POST to /messages
app.post('/messages', (req, res) => {
  console.log('POST /messages received:', JSON.stringify(req.body, null, 2));
  res.status(200).json({ received: true });
});

app.listen(PORT, () => {
  console.log(`Freshrelease MCP Server running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/`);
  console.log(`MCP SSE: http://localhost:${PORT}/sse`);
  console.log(`REST API: http://localhost:${PORT}/tools`);
});
