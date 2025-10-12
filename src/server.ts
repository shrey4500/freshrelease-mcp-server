import express from 'express';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

const app = express();
const PORT = process.env.PORT || 3000;

const API_TOKEN = process.env.FRESHRELEASE_API_TOKEN || '';

if (!API_TOKEN) {
  console.error('FRESHRELEASE_API_TOKEN environment variable is required');
  process.exit(1);
}

// Middleware with logging
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

app.use(express.json());
app.use(express.text({ type: 'text/plain' }));

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
    mcp_sse: '/sse'
  });
});

app.get('/tools', (req, res) => {
  console.log('🔧 Tools list requested');
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
  console.log('🔨 Tool call received:', JSON.stringify(req.body, null, 2));
  
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
        console.log(`  ← API response status: ${response.status}`);
        const data = await response.json();
        console.log(`  ✅ Users data retrieved`);
        res.json({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
        break;
      }

      case "freshrelease_get_issue": {
        const issue_key = args?.issue_key;
        if (!issue_key) {
          console.log('  ❌ Missing issue_key');
          return res.status(400).json({ error: "issue_key is required" });
        }
        console.log(`  → Fetching issue: ${issue_key}`);
        const response = await fetch(`${BASE_URL}/${PROJECT_KEY}/issues/${issue_key}`, {
          method: "GET",
          headers,
        });
        console.log(`  ← API response status: ${response.status}`);
        const data = await response.json();
        console.log(`  ✅ Issue data retrieved`);
        res.json({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
        break;
      }

      default:
        console.log(`  ❌ Unknown tool: ${name}`);
        res.status(400).json({ error: `Unknown tool: ${name}` });
    }
  } catch (error) {
    console.error('  ❌ Tool execution error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Store active sessions
const sessions = new Map<string, { server: Server; transport: Transport }>();

app.get('/sse', async (req, res) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔌 NEW SSE CONNECTION INITIATED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  
  req.socket.setKeepAlive(true);
  req.socket.setNoDelay(true);
  req.socket.setTimeout(0);
  console.log('✅ Socket configured (keepAlive, noDelay, no timeout)');
  
  const sessionId = Math.random().toString(36).substring(7);
  console.log(`🆔 Generated session ID: ${sessionId}`);
  
  try {
    console.log(`⚙️  Creating SSEServerTransport for session ${sessionId}...`);
    const transport = new SSEServerTransport(`/message/${sessionId}`, res);
    console.log('✅ SSEServerTransport created');
    
    console.log('⚙️  Importing MCP server module...');
    const createServerModule = await import('./index.js');
    console.log('✅ MCP server module imported');
    
    console.log('⚙️  Creating MCP server instance...');
    const mcpServer = createServerModule.default({ config: { apiToken: API_TOKEN } });
    console.log('✅ MCP server instance created');
    
    console.log(`💾 Storing session ${sessionId} in sessions map`);
    sessions.set(sessionId, { server: mcpServer, transport });
    console.log(`📊 Active sessions: ${sessions.size}`);
    
    console.log(`⚙️  Connecting MCP server to transport...`);
    await mcpServer.connect(transport);
    console.log(`✅✅✅ MCP SERVER CONNECTED FOR SESSION ${sessionId} ✅✅✅`);
    
    console.log('⚙️  Setting up connection event handlers...');
    
    req.on('close', () => {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🔌 SESSION ${sessionId} - CLIENT CLOSED CONNECTION`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🗑️  Cleaning up session ${sessionId}...`);
      sessions.delete(sessionId);
      console.log(`📊 Active sessions remaining: ${sessions.size}`);
      try {
        mcpServer.close?.();
        console.log('✅ MCP server closed');
      } catch (e) {
        console.error('❌ Error closing MCP server:', e);
      }
    });
    
    req.on('error', (error) => {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`❌ SESSION ${sessionId} - CONNECTION ERROR`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.error('Error details:', error);
      console.log(`🗑️  Cleaning up session ${sessionId}...`);
      sessions.delete(sessionId);
      console.log(`📊 Active sessions remaining: ${sessions.size}`);
      try {
        mcpServer.close?.();
        console.log('✅ MCP server closed');
      } catch (e) {
        console.error('❌ Error closing MCP server:', e);
      }
    });
    
    console.log('✅ Event handlers registered');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🎉 SSE CONNECTION FULLY ESTABLISHED FOR SESSION ${sessionId}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
  } catch (error) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌❌❌ SSE SETUP FAILED ❌❌❌');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('Error:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack');
    sessions.delete(sessionId);
  }
});

// Handle messages for each session
app.post('/message/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📨 MESSAGE RECEIVED FOR SESSION: ${sessionId}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Message body:', JSON.stringify(req.body, null, 2));
  console.log('Content-Type:', req.headers['content-type']);
  
  const session = sessions.get(sessionId);
  if (!session) {
    console.error(`❌ SESSION NOT FOUND: ${sessionId}`);
    console.log(`📊 Available sessions: ${Array.from(sessions.keys()).join(', ')}`);
    return res.status(404).json({ error: 'Session not found' });
  }
  
  console.log(`✅ Session found, transport exists: ${!!session.transport}`);
  
  // The transport should handle this internally
  console.log('✅ Acknowledging message receipt (202)');
  res.status(202).send();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

app.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('🚀 FRESHRELEASE MCP SERVER STARTED');
  console.log('═══════════════════════════════════════════');
  console.log(`   Port: ${PORT}`);
  console.log(`   SSE Endpoint: http://localhost:${PORT}/sse`);
  console.log(`   Health: http://localhost:${PORT}/`);
  console.log(`   Tools: http://localhost:${PORT}/tools`);
  console.log('═══════════════════════════════════════════');
  console.log('');
});
