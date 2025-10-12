import express from 'express';
import createServer from './index.js';

const app = express();
const PORT = process.env.PORT || 3000;

const API_TOKEN = process.env.FRESHRELEASE_API_TOKEN || '';

if (!API_TOKEN) {
  console.error('FRESHRELEASE_API_TOKEN environment variable is required');
  process.exit(1);
}

// Request logging middleware
app.use((req, res, next) => {
  if (req.path !== '/mcp') {
    console.log(`📥 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  }
  next();
});

app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') {
    console.log('✅ OPTIONS request handled');
    return res.sendStatus(200);
  }
  next();
});

app.get('/', (req, res) => {
  console.log('🏠 Health check requested');
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
  console.log('🔧 Tools list requested via REST');
  res.json({
    tools: [
      {
        name: "freshrelease_get_users",
        description: "Get all users in the Freshrelease project. Use this tool when asked about team members, users, or people in Freshrelease.",
        inputSchema: {
          type: "object",
          properties: {
            page: { 
              type: "number", 
              description: "Page number for pagination. Defaults to 1 if not specified.", 
              default: 1 
            },
          },
        },
      },
      {
        name: "freshrelease_get_issue",
        description: "Get detailed information about a specific Freshrelease ticket or issue. Use this tool whenever asked about a ticket, issue, bug, task, or story. Also use it when given an issue key like FBOTS-46821. Returns complete details including title, description, status, priority, assignee, reporter, dates, comments, and custom fields.",
        inputSchema: {
          type: "object",
          properties: {
            issue_key: { 
              type: "string", 
              description: "The Freshrelease issue key in the format PROJECT-NUMBER, for example: FBOTS-46821 or FBOTS-12345. This parameter is required and must be provided." 
            },
          },
          required: ["issue_key"],
        },
      },
    ],
  });
});

app.post('/tools/call', async (req, res) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔨 DIRECT REST TOOL CALL (Non-MCP)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Body:', JSON.stringify(req.body, null, 2));
  
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
        console.log(`  → Fetching users, page ${page}`);
        const response = await fetch(`${BASE_URL}/${PROJECT_KEY}/users?page=${page}`, {
          method: "GET",
          headers,
        });
        console.log(`  ← API status: ${response.status}`);
        const data = await response.json();
        console.log(`  ✅ Users data retrieved`);
        res.json({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
        break;
      }

      case "freshrelease_get_issue": {
        const issue_key = args?.issue_key;
        if (!issue_key) {
          console.log('  ❌ Missing issue_key parameter');
          return res.status(400).json({ error: "issue_key is required" });
        }
        console.log(`  → Fetching issue: ${issue_key}`);
        const response = await fetch(`${BASE_URL}/${PROJECT_KEY}/issues/${issue_key}`, {
          method: "GET",
          headers,
        });
        console.log(`  ← API status: ${response.status}`);
        const data = await response.json();
        console.log(`  ✅ Issue data retrieved`);
        res.json({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
        break;
      }

      default:
        console.log(`  ❌ Unknown tool: ${name}`);
        res.status(400).json({ error: `Unknown tool: ${name}` });
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (error) {
    console.error('  ❌ Tool execution error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }
});

// MCP endpoint - handles JSON-RPC over HTTP
app.post('/mcp', async (req, res) => {
  console.log('');
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║         📨 MCP REQUEST RECEIVED           ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log('📅 Timestamp:', new Date().toISOString());
  console.log('🔍 Method:', req.body?.method);
  console.log('📦 Full Body:', JSON.stringify(req.body, null, 2));
  
  try {
    const request = req.body;
    
    console.log(`⚙️  Processing ${request.method} request...`);
    
    // Handle notifications (no response needed)
    if (request.method?.startsWith('notifications/')) {
      console.log('📢 Notification received (no response needed)');
      console.log('✅✅✅ MCP NOTIFICATION HANDLED ✅✅✅');
      console.log('═══════════════════════════════════════════');
      console.log('');
      return res.status(204).send();
    }
    
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
                description: "Get all users in the Freshrelease project. Use this tool when asked about team members, users, or people in Freshrelease.",
                inputSchema: {
                  type: "object",
                  properties: {
                    page: { 
                      type: "number", 
                      description: "Page number for pagination. Defaults to 1 if not specified.", 
                      default: 1 
                    },
                  },
                },
              },
              {
                name: "freshrelease_get_issue",
                description: "Get detailed information about a specific Freshrelease ticket or issue. Use this tool whenever asked about a ticket, issue, bug, task, or story. Also use it when given an issue key like FBOTS-46821. Returns complete details including title, description, status, priority, assignee, reporter, dates, comments, and custom fields.",
                inputSchema: {
                  type: "object",
                  properties: {
                    issue_key: { 
                      type: "string", 
                      description: "The Freshrelease issue key in the format PROJECT-NUMBER, for example: FBOTS-46821 or FBOTS-12345. This parameter is required and must be provided." 
                    },
                  },
                  required: ["issue_key"],
                },
              },
            ]
          }
        };
        console.log('✅ Tools list response prepared');
        console.log('📊 Returning 2 tools: freshrelease_get_users, freshrelease_get_issue');
        break;
        
      case 'tools/call':
        console.log('');
        console.log('╔═══════════════════════════════════════════╗');
        console.log('║      🔨 TOOL CALL VIA MCP (AI AGENT)     ║');
        console.log('╚═══════════════════════════════════════════╝');
        
        const { name, arguments: args } = request.params;
        console.log('🎯 Tool Name:', name);
        console.log('📝 Arguments:', JSON.stringify(args, null, 2));
        
        const BASE_URL = "https://freshworks.freshrelease.com";
        const PROJECT_KEY = "FBOTS";
        
        const headers: Record<string, string> = {
          "Authorization": `Token ${API_TOKEN}`,
          "Content-Type": "application/json",
        };

        let content;
        
        if (name === "freshrelease_get_users") {
          const page = args?.page || 1;
          console.log(`📡 Calling Freshrelease API: GET /${PROJECT_KEY}/users?page=${page}`);
          const response = await fetch(`${BASE_URL}/${PROJECT_KEY}/users?page=${page}`, {
            method: "GET",
            headers,
          });
          console.log(`📥 API Response Status: ${response.status} ${response.statusText}`);
          const data = await response.json();
          console.log(`✅ Users data retrieved successfully`);
          console.log(`📊 Data size: ${JSON.stringify(data).length} characters`);
          content = [{ type: "text", text: JSON.stringify(data, null, 2) }];
          
        } else if (name === "freshrelease_get_issue") {
          const issue_key = args?.issue_key;
          console.log(`📡 Calling Freshrelease API: GET /${PROJECT_KEY}/issues/${issue_key}`);
          const response = await fetch(`${BASE_URL}/${PROJECT_KEY}/issues/${issue_key}`, {
            method: "GET",
            headers,
          });
          console.log(`📥 API Response Status: ${response.status} ${response.statusText}`);
          
          if (response.status === 404) {
            console.log('⚠️  Issue not found (404)');
            content = [{ type: "text", text: JSON.stringify({ error: "Issue not found" }, null, 2) }];
          } else if (response.status >= 400) {
            console.log(`⚠️  API Error: ${response.status}`);
            const errorData = await response.text();
            console.log('❌ Error details:', errorData);
            content = [{ type: "text", text: JSON.stringify({ error: errorData }, null, 2) }];
          } else {
            const data = await response.json();
            console.log(`✅ Issue data retrieved successfully`);
            console.log(`📊 Issue: ${data.issue?.key || 'N/A'} - ${data.issue?.title || 'N/A'}`);
            console.log(`📊 Data size: ${JSON.stringify(data).length} characters`);
            content = [{ type: "text", text: JSON.stringify(data, null, 2) }];
          }
          
        } else {
          console.log(`❌ Unknown tool requested: ${name}`);
          throw new Error(`Unknown tool: ${name}`);
        }
        
        result = {
          jsonrpc: '2.0',
          id: request.id,
          result: { content }
        };
        console.log('✅ Tool call response prepared');
        console.log('═══════════════════════════════════════════');
        break;
        
      default:
        console.log(`❌ Unknown MCP method: ${request.method}`);
        result = {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32601,
            message: `Method not found: ${request.method}`
          }
        };
    }
    
    console.log('📤 Sending response to n8n');
    res.json(result);
    console.log('✅✅✅ MCP REQUEST COMPLETED ✅✅✅');
    console.log('═══════════════════════════════════════════');
    console.log('');
    
  } catch (error) {
    console.log('');
    console.log('╔═══════════════════════════════════════════╗');
    console.log('║         ❌❌❌ MCP ERROR ❌❌❌            ║');
    console.log('╚═══════════════════════════════════════════╝');
    console.error('Error Type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('Error Message:', error instanceof Error ? error.message : String(error));
    console.error('Stack Trace:', error instanceof Error ? error.stack : 'No stack trace');
    
    res.status(500).json({
      jsonrpc: '2.0',
      id: req.body?.id,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : 'Internal error'
      }
    });
    console.log('═══════════════════════════════════════════');
    console.log('');
  }
});

app.listen(PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║   🚀 FRESHRELEASE MCP SERVER STARTED     ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log(`   📡 Port: ${PORT}`);
  console.log(`   🔗 MCP Endpoint: http://localhost:${PORT}/mcp`);
  console.log(`   💚 Health: http://localhost:${PORT}/`);
  console.log(`   🔧 Tools: http://localhost:${PORT}/tools`);
  console.log('═══════════════════════════════════════════');
  console.log('');
});
