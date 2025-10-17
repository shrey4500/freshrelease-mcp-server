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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
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

const TOOLS_DEFINITION = [
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
  {
    name: "freshrelease_get_statuses",
    description: "Get all statuses available in the Freshrelease project. Use this when asked about available statuses, workflow states, or what status values are possible.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "freshrelease_get_issue_types",
    description: "Get all issue types available in the Freshrelease project (e.g., Epic, Story, Task, Bug). Use this when asked about available issue types or what types of tickets can be created.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "freshrelease_create_issue",
    description: "Create a new issue/ticket in Freshrelease. Use this when asked to create, add, or make a new ticket, task, bug, or story. Requires title, description, and issue type.",
    inputSchema: {
      type: "object",
      properties: {
        title: { 
          type: "string", 
          description: "The title/summary of the issue. Required." 
        },
        description: { 
          type: "string", 
          description: "Detailed description of the issue. Can include HTML formatting." 
        },
        issue_type_id: { 
          type: "string", 
          description: "The ID of the issue type (e.g., '14' for Task, '11' for Epic). Use freshrelease_get_issue_types to find valid IDs." 
        },
        owner_id: { 
          type: "string", 
          description: "User ID of the person assigned to this issue. Optional." 
        },
        priority_id: { 
          type: "string", 
          description: "Priority ID for the issue. Optional." 
        },
        status_id: { 
          type: "string", 
          description: "Status ID for the issue. Optional." 
        },
      },
      required: ["title", "issue_type_id"],
    },
  },
  {
    name: "freshrelease_update_issue",
    description: "Update an existing issue in Freshrelease. Use this when asked to update, modify, change, or edit a ticket. You can update title, description, status, assignee, priority, custom fields, etc.",
    inputSchema: {
      type: "object",
      properties: {
        issue_key: { 
          type: "string", 
          description: "The issue key to update (e.g., FBOTS-46821). Required." 
        },
        title: { 
          type: "string", 
          description: "New title for the issue. Optional." 
        },
        description: { 
          type: "string", 
          description: "New description for the issue. Optional." 
        },
        status_id: { 
          type: "string", 
          description: "New status ID. Optional." 
        },
        owner_id: { 
          type: "string", 
          description: "New owner/assignee user ID. Optional." 
        },
        priority_id: { 
          type: "string", 
          description: "New priority ID. Optional." 
        },
      },
      required: ["issue_key"],
    },
  },
  {
    name: "freshrelease_add_comment",
    description: "Add a comment to an existing Freshrelease issue. Use this when asked to comment on, reply to, or add notes to a ticket.",
    inputSchema: {
      type: "object",
      properties: {
        issue_id: { 
          type: "string", 
          description: "The numeric issue ID (e.g., 2563487) or issue key (e.g., FBOTS-46821). Required." 
        },
        content: { 
          type: "string", 
          description: "The comment text to add. Can include HTML formatting. Required." 
        },
      },
      required: ["issue_id", "content"],
    },
  },
  {
    name: "freshrelease_get_comments",
    description: "Get all comments on a Freshrelease issue. Use this when asked to show comments, read discussion, or see what was said on a ticket.",
    inputSchema: {
      type: "object",
      properties: {
        issue_id: { 
          type: "string", 
          description: "The numeric issue ID (e.g., 2563487) or issue key (e.g., FBOTS-46821). Required." 
        },
      },
      required: ["issue_id"],
    },
  },
];

app.get('/tools', (req, res) => {
  console.log('🔧 Tools list requested via REST');
  res.json({ tools: TOOLS_DEFINITION });
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

    let response;
    let data;

    switch (name) {
      case "freshrelease_get_users": {
        const page = args?.page || 1;
        console.log(`  → Fetching users, page ${page}`);
        response = await fetch(`${BASE_URL}/${PROJECT_KEY}/users?page=${page}`, {
          method: "GET",
          headers,
        });
        console.log(`  ← API status: ${response.status}`);
        data = await response.json();
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
        response = await fetch(`${BASE_URL}/${PROJECT_KEY}/issues/${issue_key}`, {
          method: "GET",
          headers,
        });
        console.log(`  ← API status: ${response.status}`);
        data = await response.json();
        console.log(`  ✅ Issue data retrieved`);
        res.json({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
        break;
      }

      case "freshrelease_get_statuses": {
        console.log(`  → Fetching statuses`);
        response = await fetch(`${BASE_URL}/${PROJECT_KEY}/statuses`, {
          method: "GET",
          headers,
        });
        console.log(`  ← API status: ${response.status}`);
        data = await response.json();
        console.log(`  ✅ Statuses retrieved`);
        res.json({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
        break;
      }

      case "freshrelease_get_issue_types": {
        console.log(`  → Fetching issue types`);
        response = await fetch(`${BASE_URL}/${PROJECT_KEY}/issue_types`, {
          method: "GET",
          headers,
        });
        console.log(`  ← API status: ${response.status}`);
        data = await response.json();
        console.log(`  ✅ Issue types retrieved`);
        res.json({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
        break;
      }

      case "freshrelease_create_issue": {
        const { title, description, issue_type_id, owner_id, priority_id, status_id } = args || {};
        if (!title || !issue_type_id) {
          console.log('  ❌ Missing required parameters');
          return res.status(400).json({ error: "title and issue_type_id are required" });
        }
        console.log(`  → Creating issue: ${title}`);
        const payload = {
          issue: {
            title,
            description: description || "",
            key: PROJECT_KEY,
            issue_type_id,
            project_id: "280",
            owner_id: owner_id || null,
            priority_id: priority_id || null,
            status_id: status_id || null,
          }
        };
        response = await fetch(`${BASE_URL}/${PROJECT_KEY}/issues`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });
        console.log(`  ← API status: ${response.status}`);
        data = await response.json();
        console.log(`  ✅ Issue created`);
        res.json({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
        break;
      }

      case "freshrelease_update_issue": {
        const { issue_key, title, description, status_id, owner_id, priority_id } = args || {};
        if (!issue_key) {
          console.log('  ❌ Missing issue_key parameter');
          return res.status(400).json({ error: "issue_key is required" });
        }
        console.log(`  → Updating issue: ${issue_key}`);
        const updatePayload: any = { issue: { key: issue_key } };
        if (title) updatePayload.issue.title = title;
        if (description) updatePayload.issue.description = description;
        if (status_id) updatePayload.issue.status_id = status_id;
        if (owner_id) updatePayload.issue.owner_id = owner_id;
        if (priority_id) updatePayload.issue.priority_id = priority_id;
        
        response = await fetch(`${BASE_URL}/${PROJECT_KEY}/issues/${issue_key}`, {
          method: "PUT",
          headers,
          body: JSON.stringify(updatePayload),
        });
        console.log(`  ← API status: ${response.status}`);
        data = await response.json();
        console.log(`  ✅ Issue updated`);
        res.json({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
        break;
      }

      case "freshrelease_add_comment": {
        const { issue_id, content } = args || {};
        if (!issue_id || !content) {
          console.log('  ❌ Missing required parameters');
          return res.status(400).json({ error: "issue_id and content are required" });
        }
        console.log(`  → Adding comment to issue: ${issue_id}`);
        response = await fetch(`${BASE_URL}/${PROJECT_KEY}/issues/${issue_id}/comments`, {
          method: "POST",
          headers,
          body: JSON.stringify({ content }),
        });
        console.log(`  ← API status: ${response.status}`);
        data = await response.json();
        console.log(`  ✅ Comment added`);
        res.json({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
        break;
      }

      case "freshrelease_get_comments": {
        const { issue_id } = args || {};
        if (!issue_id) {
          console.log('  ❌ Missing issue_id parameter');
          return res.status(400).json({ error: "issue_id is required" });
        }
        console.log(`  → Fetching comments for issue: ${issue_id}`);
        response = await fetch(`${BASE_URL}/${PROJECT_KEY}/issues/${issue_id}/comments`, {
          method: "GET",
          headers,
        });
        console.log(`  ← API status: ${response.status}`);
        data = await response.json();
        console.log(`  ✅ Comments retrieved`);
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
            tools: TOOLS_DEFINITION
          }
        };
        console.log('✅ Tools list response prepared');
        console.log(`📊 Returning ${TOOLS_DEFINITION.length} tools`);
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
        let apiResponse;
        let apiData;
        
        switch (name) {
          case "freshrelease_get_users": {
            const page = args?.page || 1;
            console.log(`📡 Calling Freshrelease API: GET /${PROJECT_KEY}/users?page=${page}`);
            apiResponse = await fetch(`${BASE_URL}/${PROJECT_KEY}/users?page=${page}`, {
              method: "GET",
              headers,
            });
            console.log(`📥 API Response Status: ${apiResponse.status} ${apiResponse.statusText}`);
            apiData = await apiResponse.json();
            console.log(`✅ Users data retrieved successfully`);
            content = [{ type: "text", text: JSON.stringify(apiData, null, 2) }];
            break;
          }
          
          case "freshrelease_get_issue": {
            const issue_key = args?.issue_key;
            console.log(`📡 Calling Freshrelease API: GET /${PROJECT_KEY}/issues/${issue_key}`);
            apiResponse = await fetch(`${BASE_URL}/${PROJECT_KEY}/issues/${issue_key}`, {
              method: "GET",
              headers,
            });
            console.log(`📥 API Response Status: ${apiResponse.status} ${apiResponse.statusText}`);
            
            if (apiResponse.status === 404) {
              console.log('⚠️  Issue not found (404)');
              content = [{ type: "text", text: JSON.stringify({ error: "Issue not found" }, null, 2) }];
            } else if (apiResponse.status >= 400) {
              console.log(`⚠️  API Error: ${apiResponse.status}`);
              const errorData = await apiResponse.text();
              console.log('❌ Error details:', errorData);
              content = [{ type: "text", text: JSON.stringify({ error: errorData }, null, 2) }];
            } else {
              const data: any = await apiResponse.json();
              console.log(`✅ Issue data retrieved successfully`);
              const issueKey = data?.issue?.key || data?.key || 'N/A';
              const issueTitle = data?.issue?.title || data?.title || 'N/A';
              console.log(`📊 Issue: ${issueKey} - ${issueTitle}`);
              content = [{ type: "text", text: JSON.stringify(data, null, 2) }];
            }
            break;
          }

          case "freshrelease_get_statuses": {
            console.log(`📡 Calling Freshrelease API: GET /${PROJECT_KEY}/statuses`);
            apiResponse = await fetch(`${BASE_URL}/${PROJECT_KEY}/statuses`, {
              method: "GET",
              headers,
            });
            console.log(`📥 API Response Status: ${apiResponse.status} ${apiResponse.statusText}`);
            apiData = await apiResponse.json();
            console.log(`✅ Statuses retrieved successfully`);
            content = [{ type: "text", text: JSON.stringify(apiData, null, 2) }];
            break;
          }

          case "freshrelease_get_issue_types": {
            console.log(`📡 Calling Freshrelease API: GET /${PROJECT_KEY}/issue_types`);
            apiResponse = await fetch(`${BASE_URL}/${PROJECT_KEY}/issue_types`, {
              method: "GET",
              headers,
            });
            console.log(`📥 API Response Status: ${apiResponse.status} ${apiResponse.statusText}`);
            apiData = await apiResponse.json();
            console.log(`✅ Issue types retrieved successfully`);
            content = [{ type: "text", text: JSON.stringify(apiData, null, 2) }];
            break;
          }

          case "freshrelease_create_issue": {
            const { title, description, issue_type_id, owner_id, priority_id, status_id } = args || {};
            console.log(`📡 Calling Freshrelease API: POST /${PROJECT_KEY}/issues`);
            console.log(`   Creating: ${title}`);
            const payload = {
              issue: {
                title,
                description: description || "",
                key: PROJECT_KEY,
                issue_type_id,
                project_id: "280",
                owner_id: owner_id || null,
                priority_id: priority_id || null,
                status_id: status_id || null,
              }
            };
            apiResponse = await fetch(`${BASE_URL}/${PROJECT_KEY}/issues`, {
              method: "POST",
              headers,
              body: JSON.stringify(payload),
            });
            console.log(`📥 API Response Status: ${apiResponse.status} ${apiResponse.statusText}`);
            apiData = await apiResponse.json();
            console.log(`✅ Issue created successfully`);
            content = [{ type: "text", text: JSON.stringify(apiData, null, 2) }];
            break;
          }

          case "freshrelease_update_issue": {
            const { issue_key, title, description, status_id, owner_id, priority_id } = args || {};
            console.log(`📡 Calling Freshrelease API: PUT /${PROJECT_KEY}/issues/${issue_key}`);
            const updatePayload: any = { issue: { key: issue_key } };
            if (title) updatePayload.issue.title = title;
            if (description) updatePayload.issue.description = description;
            if (status_id) updatePayload.issue.status_id = status_id;
            if (owner_id) updatePayload.issue.owner_id = owner_id;
            if (priority_id) updatePayload.issue.priority_id = priority_id;
            
            apiResponse = await fetch(`${BASE_URL}/${PROJECT_KEY}/issues/${issue_key}`, {
              method: "PUT",
              headers,
              body: JSON.stringify(updatePayload),
            });
            console.log(`📥 API Response Status: ${apiResponse.status} ${apiResponse.statusText}`);
            apiData = await apiResponse.json();
            console.log(`✅ Issue updated successfully`);
            content = [{ type: "text", text: JSON.stringify(apiData, null, 2) }];
            break;
          }

          case "freshrelease_add_comment": {
            const { issue_id, content: commentContent } = args || {};
            console.log(`📡 Calling Freshrelease API: POST /${PROJECT_KEY}/issues/${issue_id}/comments`);
            apiResponse = await fetch(`${BASE_URL}/${PROJECT_KEY}/issues/${issue_id}/comments`, {
              method: "POST",
              headers,
              body: JSON.stringify({ content: commentContent }),
            });
            console.log(`📥 API Response Status: ${apiResponse.status} ${apiResponse.statusText}`);
            apiData = await apiResponse.json();
            console.log(`✅ Comment added successfully`);
            content = [{ type: "text", text: JSON.stringify(apiData, null, 2) }];
            break;
          }

          case "freshrelease_get_comments": {
            const { issue_id } = args || {};
            console.log(`📡 Calling Freshrelease API: GET /${PROJECT_KEY}/issues/${issue_id}/comments`);
            apiResponse = await fetch(`${BASE_URL}/${PROJECT_KEY}/issues/${issue_id}/comments`, {
              method: "GET",
              headers,
            });
            console.log(`📥 API Response Status: ${apiResponse.status} ${apiResponse.statusText}`);
            apiData = await apiResponse.json();
            console.log(`✅ Comments retrieved successfully`);
            content = [{ type: "text", text: JSON.stringify(apiData, null, 2) }];
            break;
          }
          
          default: {
            console.log(`❌ Unknown tool requested: ${name}`);
            throw new Error(`Unknown tool: ${name}`);
          }
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
  console.log(`   📊 Total Tools: ${TOOLS_DEFINITION.length}`);
  console.log('═══════════════════════════════════════════');
  console.log('');
});
