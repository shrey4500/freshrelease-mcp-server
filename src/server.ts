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

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

app.get('/sse', async (req, res) => {
  console.log('New SSE connection from:', req.ip);
  
  req.socket.setTimeout(0);
  req.socket.setNoDelay(true);
  req.socket.setKeepAlive(true);
  
  const transport = new SSEServerTransport('/messages', res);
  
  const createServerModule = await import('./index.js');
  const mcpServer = createServerModule.default({ config: { apiToken: API_TOKEN } });
  
  try {
    await mcpServer.connect(transport);
    console.log('MCP server connected successfully');
    
    req.on('close', () => {
      console.log('SSE connection closed by client');
    });
    
    req.on('error', (error) => {
      console.error('SSE connection error:', error);
    });
  } catch (error) {
    console.error('Error connecting MCP server:', error);
    res.end();
  }
});

app.post('/messages', async (req, res) => {
  console.log('Received message:', JSON.stringify(req.body));
  // SSEServerTransport handles the /messages endpoint internally
  // Just acknowledge receipt
  res.status(202).json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Freshrelease MCP Server running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/`);
  console.log(`MCP SSE: http://localhost:${PORT}/sse`);
  console.log(`REST API: http://localhost:${PORT}/tools`);
});
