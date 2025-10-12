import express from 'express';
import createServer from './index.js';

const app = express();
const PORT = process.env.PORT || 3000;

const API_TOKEN = process.env.FRESHRELEASE_API_TOKEN || '';

if (!API_TOKEN) {
  console.error('FRESHRELEASE_API_TOKEN environment variable is required');
  process.exit(1);
}

app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
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
      mcp: '/mcp',
      tools: '/tools',
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
  console.log('🔨 Direct tool call:', req.body?.name);
  
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

// MCP endpoint - handles JSON-RPC over HTTP
app.post('/mcp', async (req, res) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📨 MCP REQUEST');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Method:', req.body?.method);
  console.log('Body:', JSON.stringify(req.body, null, 2));
  
  try {
    const mcpServer = createServer({ config: { apiToken: API_TOKEN } });
    
    // Create a simple request/response handler
    const request = req.body;
    
    console.log(`⚙️  Processing ${request.method} request...`);
    
    let result;
    
    switch (request.method) {
      case 'initialize':
        console.log('🔧 Handling initialize...');
        result = {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            protocolVersion: '2025-03-26',
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: 'freshrelease-mcp-server',
              version: '1.0.0'
            }
          }
        };
        console.log('✅ Initialize response prepared');
        break;
        
      case 'tools/list':
        console.log('📋 Handling tools/list...');
        result = {
          jsonrpc: '2.0',
          id: request.id,
          result: {
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
            ]
          }
        };
        console.log('✅ Tools list response prepared');
        break;
        
      case 'tools/call':
        console.log('🔨 Handling tools/call...');
        const { name, arguments: args } = request.params;
        console.log(`  Tool: ${name}`);
        console.log(`  Args:`, args);
        
        const BASE_URL = "https://freshworks.freshrelease.com";
        const PROJECT_KEY = "FBOTS";
        
        const headers: Record<string, string> = {
          "Authorization": `Token ${API_TOKEN}`,
          "Content-Type": "application/json",
        };

        let content;
        
        if (name === "freshrelease_get_users") {
          const page = args?.page || 1;
          const response = await fetch(`${BASE_URL}/${PROJECT_KEY}/users?page=${page}`, {
            method: "GET",
            headers,
          });
          const data = await response.json();
          content = [{ type: "text", text: JSON.stringify(data, null, 2) }];
        } else if (name === "freshrelease_get_issue") {
          const issue_key = args?.issue_key;
          const response = await fetch(`${BASE_URL}/${PROJECT_KEY}/issues/${issue_key}`, {
            method: "GET",
            headers,
          });
          const data = await response.json();
          content = [{ type: "text", text: JSON.stringify(data, null, 2) }];
        }
        
        result = {
          jsonrpc: '2.0',
          id: request.id,
          result: { content }
        };
        console.log('✅ Tool call response prepared');
        break;
        
      default:
        console.log(`❌ Unknown method: ${request.method}`);
        result = {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32601,
            message: `Method not found: ${request.method}`
          }
        };
    }
    
    console.log('📤 Sending response:', JSON.stringify(result, null, 2));
    res.json(result);
    console.log('✅✅✅ MCP REQUEST COMPLETED ✅✅✅');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
  } catch (error) {
    console.error('❌❌❌ MCP REQUEST FAILED ❌❌❌');
    console.error('Error:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      id: req.body?.id,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : 'Internal error'
      }
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }
});

app.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('🚀 FRESHRELEASE MCP SERVER STARTED');
  console.log('═══════════════════════════════════════════');
  console.log(`   Port: ${PORT}`);
  console.log(`   MCP Endpoint: http://localhost:${PORT}/mcp`);
  console.log(`   Health: http://localhost:${PORT}/`);
  console.log('═══════════════════════════════════════════');
  console.log('');
});
