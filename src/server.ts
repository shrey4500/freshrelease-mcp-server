import express from 'express';
import createServer from './index.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Default API token from environment (optional now)
const DEFAULT_API_TOKEN = process.env.FRESHRELEASE_API_TOKEN || '';

// Request logging middleware
app.use((req, res, next) => {
  if (req.path !== '/mcp') {
    console.log(`🔥 ${req.method} ${req.path} - ${new Date().toISOString()}`);
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
    },
    supported_projects: ['FBOTS', 'AB1', 'FD', 'FC', 'NEOROAD'],
    api_token_support: 'Can be passed per request or set as FRESHRELEASE_API_TOKEN env var'
  });
});

// Helper to extract project key from issue key
function extractProjectKey(issue_key: string): string {
  const parts = issue_key.split('-');
  if (parts.length < 2) {
    throw new Error(`Invalid issue key format: ${issue_key}. Expected format: PROJECT-NUMBER`);
  }
  return parts[0];
}

const TOOLS_DEFINITION = [
  {
    name: "freshrelease_get_users",
    description: "Get all users in a Freshrelease project. Returns basic user information for a specific page.",
    inputSchema: {
      type: "object",
      properties: {
        project_key: { 
          type: "string", 
          description: "Project key (e.g., 'FBOTS', 'AB1', 'FD', 'FC', 'NEOROAD'). Optional - defaults to 'FBOTS'",
          default: "FBOTS"
        },
        page: { 
          type: "number", 
          description: "Page number for pagination. Defaults to 1 if not specified.", 
          default: 1 
        },
        api_token: {
          type: "string",
          description: "Freshrelease API token. Optional - uses environment variable if not provided"
        }
      },
    },
  },
  {
    name: "freshrelease_search_user_by_name",
    description: "Search for a Freshrelease user by name or email and return their user ID. Automatically searches across all pages.",
    inputSchema: {
      type: "object",
      properties: {
        name: { 
          type: "string", 
          description: "The name or email of the user to search for. Case-insensitive partial match." 
        },
        project_key: { 
          type: "string", 
          description: "Project key. Optional - defaults to 'FBOTS'",
          default: "FBOTS"
        },
        api_token: {
          type: "string",
          description: "Freshrelease API token. Optional - uses environment variable if not provided"
        }
      },
      required: ["name"],
    },
  },
  {
    name: "freshrelease_get_issue",
    description: "Get detailed information about a specific Freshrelease ticket or issue. The project key is automatically extracted from the issue key.",
    inputSchema: {
      type: "object",
      properties: {
        issue_key: { 
          type: "string", 
          description: "The Freshrelease issue key (e.g., FBOTS-46821, AB1-123, FD-456). Project is auto-detected from the key." 
        },
        api_token: {
          type: "string",
          description: "Freshrelease API token. Optional - uses environment variable if not provided"
        }
      },
      required: ["issue_key"],
    },
  },
  {
    name: "freshrelease_get_statuses",
    description: "Get all statuses available in a Freshrelease project.",
    inputSchema: {
      type: "object",
      properties: {
        project_key: { 
          type: "string", 
          description: "Project key. Optional - defaults to 'FBOTS'",
          default: "FBOTS"
        },
        api_token: {
          type: "string",
          description: "Freshrelease API token. Optional - uses environment variable if not provided"
        }
      },
    },
  },
  {
    name: "freshrelease_get_issue_types",
    description: "Get all issue types available in a Freshrelease project (e.g., Epic, Story, Task, Bug). Essential for finding the correct issue_type_id when creating or updating issues.",
    inputSchema: {
      type: "object",
      properties: {
        project_key: { 
          type: "string", 
          description: "Project key. Optional - defaults to 'FBOTS'",
          default: "FBOTS"
        },
        api_token: {
          type: "string",
          description: "Freshrelease API token. Optional - uses environment variable if not provided"
        }
      },
    },
  },
  {
    name: "freshrelease_create_issue",
    description: "Create a new issue/ticket in Freshrelease. By default, creates a Task (ID: 14) unless specified. To change issue type, first use freshrelease_get_issue_types to find the correct issue_type_id.",
    inputSchema: {
      type: "object",
      properties: {
        title: { 
          type: "string", 
          description: "The title/summary of the issue. Required." 
        },
        description: { 
          type: "string", 
          description: "Detailed description of the issue. Can include HTML formatting. Optional." 
        },
        project_key: { 
          type: "string", 
          description: "Project key where the issue will be created. Optional - defaults to 'FBOTS'",
          default: "FBOTS"
        },
        issue_type_id: { 
          type: "string", 
          description: "The ID of the issue type. Defaults to '14' (Task). Use freshrelease_get_issue_types first to find valid IDs." 
        },
        owner_id: { 
          type: "string", 
          description: "User ID of the person assigned. Use freshrelease_search_user_by_name to find the user ID first." 
        },
        priority_id: { 
          type: "string", 
          description: "Priority ID for the issue. Optional." 
        },
        status_id: { 
          type: "string", 
          description: "Status ID for the issue. Optional." 
        },
        api_token: {
          type: "string",
          description: "Freshrelease API token. Optional - uses environment variable if not provided"
        }
      },
      required: ["title"],
    },
  },
  {
    name: "freshrelease_update_issue",
    description: "Update an existing issue in Freshrelease. To change issue type: 1) First use freshrelease_get_issue_types to find the correct issue_type_id, 2) Then call this with the issue_type_id. Project is auto-detected from issue key.",
    inputSchema: {
      type: "object",
      properties: {
        issue_key: { 
          type: "string", 
          description: "The issue key to update (e.g., FBOTS-46821). Project is auto-detected." 
        },
        title: { 
          type: "string", 
          description: "New title for the issue. Optional." 
        },
        description: { 
          type: "string", 
          description: "New description for the issue. Optional." 
        },
        issue_type_id: { 
          type: "string", 
          description: "New issue type ID. Use freshrelease_get_issue_types first to find valid IDs. Optional." 
        },
        status_id: { 
          type: "string", 
          description: "New status ID. Optional." 
        },
        owner_id: { 
          type: "string", 
          description: "New owner/assignee user ID. Use freshrelease_search_user_by_name to find the user ID first." 
        },
        priority_id: { 
          type: "string", 
          description: "New priority ID. Optional." 
        },
        api_token: {
          type: "string",
          description: "Freshrelease API token. Optional - uses environment variable if not provided"
        }
      },
      required: ["issue_key"],
    },
  },
  {
    name: "freshrelease_add_comment",
    description: "Add a comment to a Freshrelease issue. Project is auto-detected from the issue key.",
    inputSchema: {
      type: "object",
      properties: {
        issue_key: { 
          type: "string", 
          description: "The Freshrelease issue key (e.g., FBOTS-51117). Project is auto-detected." 
        },
        content: { 
          type: "string", 
          description: "The comment text to add. Can include HTML formatting. Required." 
        },
        api_token: {
          type: "string",
          description: "Freshrelease API token. Optional - uses environment variable if not provided"
        }
      },
      required: ["issue_key", "content"],
    },
  },
  {
    name: "freshrelease_get_comments",
    description: "Get all comments on a Freshrelease issue. Project is auto-detected from the issue key.",
    inputSchema: {
      type: "object",
      properties: {
        issue_key: { 
          type: "string", 
          description: "The Freshrelease issue key (e.g., FBOTS-51117). Project is auto-detected." 
        },
        api_token: {
          type: "string",
          description: "Freshrelease API token. Optional - uses environment variable if not provided"
        }
      },
      required: ["issue_key"],
    },
  },
];

app.get('/tools', (req, res) => {
  console.log('🔧 Tools list requested via REST');
  res.json({ tools: TOOLS_DEFINITION });
});

// Helper function to get issue ID from issue key
async function getIssueIdFromKey(issue_key: string, headers: Record<string, string>, project_key: string) {
  const BASE_URL = "https://freshworks.freshrelease.com";
  
  console.log(`  📄 Fetching issue ID for: ${issue_key}`);
  
  const issueResponse = await fetch(`${BASE_URL}/${project_key}/issues/${issue_key}`, {
    method: "GET",
    headers,
  });
  
  if (!issueResponse.ok) {
    throw new Error(`Issue ${issue_key} not found`);
  }
  
  const issueData: any = await issueResponse.json();
  const issue_id = issueData?.issue?.id;
  
  if (!issue_id) {
    throw new Error("Could not extract issue ID from response");
  }
  
  console.log(`  ✅ Found issue ID: ${issue_id}`);
  return issue_id;
}

// Helper function to search user by name across all pages
async function searchUserByName(searchName: string, headers: Record<string, string>, project_key: string) {
  const BASE_URL = "https://freshworks.freshrelease.com";
  
  console.log(`  → Searching for user: ${searchName} in project: ${project_key}`);
  
  let allUsers: any[] = [];
  let page = 1;
  const maxPages = 10;
  
  while (page <= maxPages) {
    console.log(`  → Fetching users page ${page}`);
    const response = await fetch(`${BASE_URL}/${project_key}/users?page=${page}`, {
      method: "GET",
      headers,
    });
    
    if (!response.ok) break;
    
    const data: any = await response.json();
    const users = data.users || [];
    
    if (users.length === 0) break;
    
    allUsers = allUsers.concat(users);
    console.log(`  → Page ${page}: ${users.length} users fetched`);
    page++;
  }
  
  console.log(`  ✅ Total users fetched: ${allUsers.length}`);
  
  const searchLower = searchName.toLowerCase();
  const matchedUser = allUsers.find((u: any) => 
    u.name?.toLowerCase().includes(searchLower) ||
    u.email?.toLowerCase().includes(searchLower)
  );
  
  if (matchedUser) {
    console.log(`  ✅ Found user: ${matchedUser.name} (ID: ${matchedUser.id})`);
    return {
      found: true,
      user: {
        id: matchedUser.id,
        name: matchedUser.name,
        email: matchedUser.email
      }
    };
  } else {
    console.log(`  ❌ User not found: ${searchName}`);
    return {
      found: false,
      searched_name: searchName
    };
  }
}

app.post('/tools/call', async (req, res) => {
  console.log('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
  console.log('🔨 DIRECT REST TOOL CALL (Non-MCP)');
  console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
  console.log('Body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { name, arguments: args } = req.body;
    
    const BASE_URL = "https://freshworks.freshrelease.com";
    
    // Get API token from args or fall back to environment variable
    const API_TOKEN = args?.api_token || DEFAULT_API_TOKEN;
    if (!API_TOKEN) {
      return res.status(400).json({ error: "API token is required. Pass api_token in request or set FRESHRELEASE_API_TOKEN env var." });
    }
    
    const headers: Record<string, string> = {
      "Authorization": `Token ${API_TOKEN}`,
      "Content-Type": "application/json",
    };

    let response;
    let data: any;

    switch (name) {
      case "freshrelease_get_users": {
        const project_key = args?.project_key || "FBOTS";
        const page = args?.page || 1;
        console.log(`  → Fetching users for project ${project_key}, page ${page}`);
        response = await fetch(`${BASE_URL}/${project_key}/users?page=${page}`, {
          method: "GET",
          headers,
        });
        console.log(`  ← API status: ${response.status}`);
        data = await response.json();
        console.log(`  ✅ Users data retrieved`);
        res.json({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
        break;
      }

      case "freshrelease_search_user_by_name": {
        const { name: searchName, project_key = "FBOTS" } = args || {};
        if (!searchName) {
          console.log('  ❌ Missing name parameter');
          return res.status(400).json({ error: "name is required" });
        }
        
        const result = await searchUserByName(searchName, headers, project_key);
        res.json({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
        break;
      }

      case "freshrelease_get_issue": {
        const issue_key = args?.issue_key;
        if (!issue_key) {
          console.log('  ❌ Missing issue_key parameter');
          return res.status(400).json({ error: "issue_key is required" });
        }
        const project_key = extractProjectKey(issue_key);
        console.log(`  → Fetching issue: ${issue_key} from project: ${project_key}`);
        response = await fetch(`${BASE_URL}/${project_key}/issues/${issue_key}`, {
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
        const project_key = args?.project_key || "FBOTS";
        console.log(`  → Fetching statuses for project ${project_key}`);
        response = await fetch(`${BASE_URL}/${project_key}/statuses`, {
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
        const project_key = args?.project_key || "FBOTS";
        console.log(`  → Fetching issue types for project ${project_key}`);
        response = await fetch(`${BASE_URL}/${project_key}/issue_types`, {
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
        const { title, description, issue_type_id, owner_id, priority_id, status_id, project_key = "FBOTS" } = args || {};
        if (!title) {
          console.log('  ❌ Missing required parameter: title');
          return res.status(400).json({ error: "title is required" });
        }
        
        const typeId = issue_type_id || "14";
        console.log(`  → Creating issue in project ${project_key}: ${title} (Type ID: ${typeId})`);
        
        const payload = {
          issue: {
            title,
            description: description || "",
            key: project_key,
            issue_type_id: parseInt(typeId),
            // Removed project_id - API uses key to determine project
            owner_id: owner_id ? parseInt(owner_id) : null,
            priority_id: priority_id ? parseInt(priority_id) : null,
            status_id: status_id ? parseInt(status_id) : null,
          }
        };
        response = await fetch(`${BASE_URL}/${project_key}/issues`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });
        console.log(`  ← API status: ${response.status}`);
        data = await response.json();
        
        const createdKey = data?.issue?.key || 'N/A';
        console.log(`  ✅ Issue created with key: ${createdKey}`);
        
        res.json({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
        break;
      }

      case "freshrelease_update_issue": {
        const { issue_key, title, description, issue_type_id, status_id, owner_id, priority_id } = args || {};
        if (!issue_key) {
          console.log('  ❌ Missing issue_key parameter');
          return res.status(400).json({ error: "issue_key is required" });
        }
        const project_key = extractProjectKey(issue_key);
        console.log(`  → Updating issue: ${issue_key} in project: ${project_key}`);
        const updatePayload: any = { issue: { key: issue_key } };
        if (title) updatePayload.issue.title = title;
        if (description) updatePayload.issue.description = description;
        if (issue_type_id) updatePayload.issue.issue_type_id = parseInt(issue_type_id);
        if (status_id) updatePayload.issue.status_id = parseInt(status_id);
        if (owner_id) updatePayload.issue.owner_id = parseInt(owner_id);
        if (priority_id) updatePayload.issue.priority_id = parseInt(priority_id);
        
        response = await fetch(`${BASE_URL}/${project_key}/issues/${issue_key}`, {
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
        const { issue_key, content } = args || {};
        if (!issue_key || !content) {
          console.log('  ❌ Missing required parameters');
          return res.status(400).json({ error: "issue_key and content are required" });
        }
        
        const project_key = extractProjectKey(issue_key);
        const issue_id = await getIssueIdFromKey(issue_key, headers, project_key);
        
        console.log(`  → Adding comment to issue ID: ${issue_id}`);
        response = await fetch(`${BASE_URL}/${project_key}/issues/${issue_id}/comments`, {
          method: "POST",
          headers,
          body: JSON.stringify({ content }),
        });
        console.log(`  ← API status: ${response.status}`);
        const commentData = await response.json();
        console.log(`  ✅ Comment added`);
        
        res.json({ 
          content: [{ 
            type: "text", 
            text: JSON.stringify({
              success: true,
              issue_key,
              issue_id,
              comment: commentData
            }, null, 2) 
          }] 
        });
        break;
      }

      case "freshrelease_get_comments": {
        const { issue_key } = args || {};
        if (!issue_key) {
          console.log('  ❌ Missing issue_key parameter');
          return res.status(400).json({ error: "issue_key is required" });
        }
        
        const project_key = extractProjectKey(issue_key);
        const issue_id = await getIssueIdFromKey(issue_key, headers, project_key);
        
        console.log(`  → Fetching comments for issue ID: ${issue_id}`);
        response = await fetch(`${BASE_URL}/${project_key}/issues/${issue_id}/comments`, {
          method: "GET",
          headers,
        });
        console.log(`  ← API status: ${response.status}`);
        const commentsData = await response.json();
        console.log(`  ✅ Comments retrieved`);
        
        res.json({ 
          content: [{ 
            type: "text", 
            text: JSON.stringify({
              issue_key,
              issue_id,
              comments: commentsData
            }, null, 2) 
          }] 
        });
        break;
      }

      default:
        console.log(`  ❌ Unknown tool: ${name}`);
        res.status(400).json({ error: `Unknown tool: ${name}` });
    }
    console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
  } catch (error) {
    console.error('  ❌ Tool execution error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
  }
});

// MCP endpoint - handles JSON-RPC over HTTP
app.post('/mcp', async (req, res) => {
  console.log('');
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║         🔨 MCP REQUEST RECEIVED           ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log('📅 Timestamp:', new Date().toISOString());
  console.log('🔍 Method:', req.body?.method);
  
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
        console.log('🔍 Arguments:', JSON.stringify(args, null, 2));
        
        const BASE_URL = "https://freshworks.freshrelease.com";
        
        // Get API token from args or fall back to environment variable
        const API_TOKEN = args?.api_token || DEFAULT_API_TOKEN;
        if (!API_TOKEN) {
          throw new Error("API token is required. Pass api_token in request or set FRESHRELEASE_API_TOKEN env var.");
        }
        
        const headers: Record<string, string> = {
          "Authorization": `Token ${API_TOKEN}`,
          "Content-Type": "application/json",
        };

        let content;
        let apiResponse;
        let apiData: any;
        
        switch (name) {
          case "freshrelease_search_user_by_name": {
            const { name: searchName, project_key = "FBOTS" } = args || {};
            const result = await searchUserByName(searchName, headers, project_key);
            content = [{ type: "text", text: JSON.stringify(result, null, 2) }];
            break;
          }

          case "freshrelease_add_comment": {
            const { issue_key, content: commentContent } = args || {};
            const project_key = extractProjectKey(issue_key);
            const issue_id = await getIssueIdFromKey(issue_key, headers, project_key);
            
            console.log(`📡 Adding comment to issue ID: ${issue_id}`);
            apiResponse = await fetch(`${BASE_URL}/${project_key}/issues/${issue_id}/comments`, {
              method: "POST",
              headers,
              body: JSON.stringify({ content: commentContent }),
            });
            console.log(`📥 API Response Status: ${apiResponse.status}`);
            const commentData = await apiResponse.json();
            
            content = [{ 
              type: "text", 
              text: JSON.stringify({
                success: true,
                issue_key,
                issue_id,
                comment: commentData
              }, null, 2) 
            }];
            break;
          }

          case "freshrelease_get_comments": {
            const { issue_key } = args || {};
            const project_key = extractProjectKey(issue_key);
            const issue_id = await getIssueIdFromKey(issue_key, headers, project_key);
            
            console.log(`📡 Fetching comments for issue ID: ${issue_id}`);
            apiResponse = await fetch(`${BASE_URL}/${project_key}/issues/${issue_id}/comments`, {
              method: "GET",
              headers,
            });
            console.log(`📥 API Response Status: ${apiResponse.status}`);
            const commentsData = await apiResponse.json();
            
            content = [{ 
              type: "text", 
              text: JSON.stringify({
                issue_key,
                issue_id,
                comments: commentsData
              }, null, 2) 
            }];
            break;
          }

          case "freshrelease_get_users": {
            const project_key = args?.project_key || "FBOTS";
            const page = args?.page || 1;
            console.log(`📡 Calling Freshrelease API: GET /${project_key}/users?page=${page}`);
            apiResponse = await fetch(`${BASE_URL}/${project_key}/users?page=${page}`, {
              method: "GET",
              headers,
            });
            console.log(`📥 API Response Status: ${apiResponse.status}`);
            apiData = await apiResponse.json();
            console.log(`✅ Users data retrieved successfully`);
            content = [{ type: "text", text: JSON.stringify(apiData, null, 2) }];
            break;
          }
          
          case "freshrelease_get_issue": {
            const issue_key = args?.issue_key;
            const project_key = extractProjectKey(issue_key);
            console.log(`📡 Calling Freshrelease API: GET /${project_key}/issues/${issue_key}`);
            apiResponse = await fetch(`${BASE_URL}/${project_key}/issues/${issue_key}`, {
              method: "GET",
              headers,
            });
            console.log(`📥 API Response Status: ${apiResponse.status}`);
            
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
            const project_key = args?.project_key || "FBOTS";
            console.log(`📡 Calling Freshrelease API: GET /${project_key}/statuses`);
            apiResponse = await fetch(`${BASE_URL}/${project_key}/statuses`, {
              method: "GET",
              headers,
            });
            console.log(`📥 API Response Status: ${apiResponse.status}`);
            apiData = await apiResponse.json();
            console.log(`✅ Statuses retrieved successfully`);
            content = [{ type: "text", text: JSON.stringify(apiData, null, 2) }];
            break;
          }

          case "freshrelease_get_issue_types": {
            const project_key = args?.project_key || "FBOTS";
            console.log(`📡 Calling Freshrelease API: GET /${project_key}/issue_types`);
            apiResponse = await fetch(`${BASE_URL}/${project_key}/issue_types`, {
              method: "GET",
              headers,
            });
            console.log(`📥 API Response Status: ${apiResponse.status}`);
            apiData = await apiResponse.json();
            console.log(`✅ Issue types retrieved successfully`);
            content = [{ type: "text", text: JSON.stringify(apiData, null, 2) }];
            break;
          }

          case "freshrelease_create_issue": {
            const { title, description, issue_type_id, owner_id, priority_id, status_id, project_key = "FBOTS" } = args || {};
            
            const typeId = issue_type_id || "14";
            console.log(`📡 Creating: ${title} in project ${project_key} (Type ID: ${typeId})`);
            
            const payload = {
              issue: {
                title,
                description: description || "",
                key: project_key,
                issue_type_id: parseInt(typeId),
                // Removed project_id - API uses key to determine project
                owner_id: owner_id ? parseInt(owner_id) : null,
                priority_id: priority_id ? parseInt(priority_id) : null,
                status_id: status_id ? parseInt(status_id) : null,
              }
            };
            apiResponse = await fetch(`${BASE_URL}/${project_key}/issues`, {
              method: "POST",
              headers,
              body: JSON.stringify(payload),
            });
            console.log(`📥 API Response Status: ${apiResponse.status}`);
            apiData = await apiResponse.json();
            
            const createdKey = apiData?.issue?.key || 'N/A';
            console.log(`✅ Issue created successfully with key: ${createdKey}`);
            
            content = [{ type: "text", text: JSON.stringify(apiData, null, 2) }];
            break;
          }

          case "freshrelease_update_issue": {
            const { issue_key, title, description, issue_type_id, status_id, owner_id, priority_id } = args || {};
            const project_key = extractProjectKey(issue_key);
            console.log(`📡 Updating: ${issue_key} in project: ${project_key}`);
            const updatePayload: any = { issue: { key: issue_key } };
            if (title) updatePayload.issue.title = title;
            if (description) updatePayload.issue.description = description;
            if (issue_type_id) updatePayload.issue.issue_type_id = parseInt(issue_type_id);
            if (status_id) updatePayload.issue.status_id = parseInt(status_id);
            if (owner_id) updatePayload.issue.owner_id = parseInt(owner_id);
            if (priority_id) updatePayload.issue.priority_id = parseInt(priority_id);
            
            apiResponse = await fetch(`${BASE_URL}/${project_key}/issues/${issue_key}`, {
              method: "PUT",
              headers,
              body: JSON.stringify(updatePayload),
            });
            console.log(`📥 API Response Status: ${apiResponse.status}`);
            apiData = await apiResponse.json();
            console.log(`✅ Issue updated successfully`);
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
  console.log('   ✨ New Features:');
  console.log('      - Multi-project support (FBOTS, AB1, FD, FC, NEOROAD)');
  console.log('      - Dynamic API token per request');
  console.log('      - Auto-detect project from issue keys');
  console.log('      - Issue type change workflow support');
  console.log('      - Flexible authentication (per-call or env var)');
  console.log('═══════════════════════════════════════════');
  console.log('');
});