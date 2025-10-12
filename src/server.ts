import express from 'express';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamTransport } from "@modelcontextprotocol/sdk/server/streamable.js";

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
      mcp_http: '/mcp',
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

// HTTP Streamable endpoint for MCP
app.post('/mcp', async (req, res) => {
  console.log('MCP HTTP request received:', JSON.stringify(req.body));
  
  try {
    // Create a readable stream from the request body
    const { Readable, Writable } = await import('stream');
    
    const requestStream = new Readable({
      read() {
        this.push(JSON.stringify(req.body));
        this.push(null);
      }
    });
    
    // Create a writable stream for the response
    let responseData = '';
    const responseStream = new Writable({
      write(chunk, encoding, callback) {
        responseData += chunk.toString();
        callback();
      }
    });
    
    // Create transport
    const transport = new StreamTransport(requestStream, responseStream);
    
    // Create and connect MCP server
    const createServerModule = await import('./index.js');
    const mcpServer = createServerModule.default({ config: { apiToken: API_TOKEN } });
    
    await mcpServer.connect(transport);
    console.log('MCP server connected for HTTP request');
    
    // Wait for response to be written
    await new Promise((resolve) => {
      responseStream.on('finish', resolve);
      setTimeout(resolve, 5000); // 5 second timeout
    });
    
    // Send response
    res.setHeader('Content-Type', 'application/json');
    res.send(responseData);
    
    // Cleanup
    mcpServer.close?.();
    
  } catch (error) {
    console.error('MCP HTTP error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.listen(PORT, () => {
  console.log(`Freshrelease MCP Server running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/`);
  console.log(`MCP HTTP: http://localhost:${PORT}/mcp`);
  console.log(`REST API: http://localhost:${PORT}/tools`);
});
