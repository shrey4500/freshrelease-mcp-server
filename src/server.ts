import express from 'express';
import createServer from './index.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Get API token from environment
const API_TOKEN = process.env.FRESHRELEASE_API_TOKEN || '';

if (!API_TOKEN) {
  console.error('FRESHRELEASE_API_TOKEN environment variable is required');
  process.exit(1);
}

// Create MCP server instance
const mcpServer = createServer({ config: { apiToken: API_TOKEN } });

app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'freshrelease-mcp-server',
    version: '1.0.0'
  });
});

// MCP endpoint
app.post('/mcp', async (req, res) => {
  try {
    const { method, params } = req.body;
    
    if (method === 'tools/list') {
      const result = await mcpServer.listTools();
      res.json(result);
    } else if (method === 'tools/call') {
      const result = await mcpServer.callTool({ name: params.name, arguments: params.arguments });
      res.json(result);
    } else {
      res.status(400).json({ error: 'Unknown method' });
    }
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

app.listen(PORT, () => {
  console.log(`Freshrelease MCP Server running on port ${PORT}`);
});
