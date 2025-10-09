import express from 'express';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Get API token from environment
const API_TOKEN = process.env.FRESHRELEASE_API_TOKEN || '';

if (!API_TOKEN) {
  console.error('FRESHRELEASE_API_TOKEN environment variable is required');
  process.exit(1);
}

app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'freshrelease-mcp-server',
    version: '1.0.0',
    endpoints: {
      health: '/',
      mcp: '/sse'
    }
  });
});

// MCP SSE endpoint
app.get('/sse', async (req, res) => {
  console.log('New SSE connection');
  
  const transport = new SSEServerTransport('/messages', res);
  
  // Dynamically import to avoid circular dependency
  const createServerModule = await import('./index.js');
  const mcpServer = createServerModule.default({ config: { apiToken: API_TOKEN } });
  
  await mcpServer.connect(transport);
  
  req.on('close', () => {
    console.log('SSE connection closed');
  });
});

// MCP messages endpoint
app.post('/messages', async (req, res) => {
  // This will be handled by the SSE transport
  res.status(200).end();
});

app.listen(PORT, () => {
  console.log(`Freshrelease MCP Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/`);
  console.log(`MCP endpoint: http://localhost:${PORT}/sse`);
});
