import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const BASE_URL = "https://freshworks.freshrelease.com";

export const configSchema = z.object({
  apiToken: z.string().optional().describe("Default Freshrelease API Token (can be overridden per call)"),
});

// Helper function to get issue ID from issue key
async function getIssueIdFromKey(issue_key: string, apiToken: string, project_key: string) {
  const headers = {
    "Authorization": `Token ${apiToken}`,
    "Content-Type": "application/json",
  };
  
  console.log(`Fetching issue ID for: ${issue_key}`);
  
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
  
  console.log(`Found issue ID: ${issue_id}`);
  return issue_id;
}

// Helper function to search user by name across all pages
async function searchUserByName(searchName: string, apiToken: string, project_key: string) {
  const headers = {
    "Authorization": `Token ${apiToken}`,
    "Content-Type": "application/json",
  };
  
  console.log(`Searching for user: ${searchName} in project: ${project_key}`);
  
  let allUsers: any[] = [];
  let page = 1;
  const maxPages = 10;
  
  while (page <= maxPages) {
    console.log(`Fetching users page ${page}`);
    const response = await fetch(`${BASE_URL}/${project_key}/users?page=${page}`, {
      method: "GET",
      headers,
    });
    
    if (!response.ok) break;
    
    const data: any = await response.json();
    const users = data.users || [];
    
    if (users.length === 0) break;
    
    allUsers = allUsers.concat(users);
    page++;
  }
  
  console.log(`Total users fetched: ${allUsers.length}`);
  
  // Search for user by name or email (case-insensitive)
  const searchLower = searchName.toLowerCase();
  const matchedUser = allUsers.find((u: any) => 
    u.name?.toLowerCase().includes(searchLower) ||
    u.email?.toLowerCase().includes(searchLower)
  );
  
  if (matchedUser) {
    console.log(`✔ Found user: ${matchedUser.name} (ID: ${matchedUser.id})`);
    return {
      found: true,
      user: {
        id: matchedUser.id,
        name: matchedUser.name,
        email: matchedUser.email
      }
    };
  } else {
    console.log(`✗ User not found: ${searchName}`);
    return {
      found: false,
      searched_name: searchName
    };
  }
}

// Helper to extract project key from issue key (e.g., FBOTS-12345 -> FBOTS)
function extractProjectKey(issue_key: string): string {
  const parts = issue_key.split('-');
  if (parts.length < 2) {
    throw new Error(`Invalid issue key format: ${issue_key}. Expected format: PROJECT-NUMBER`);
  }
  return parts[0];
}

export default function createServer({ config }: { config: z.infer<typeof configSchema> }) {
  const server = new Server(
    {
      name: "freshrelease-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    console.log('📋 Client requested tools list');
    return {
      tools: [
        {
          name: "freshrelease_search_user_by_name",
          description: "Search for a Freshrelease user by name or email and return their user ID. Automatically searches across all pages. Returns the user's ID, name, and email if found.",
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
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    console.log(`🔧 Tool called: ${name}`);

    // Get API token from args or fall back to config
    const apiToken = (args as any)?.api_token || config.apiToken;
    if (!apiToken) {
      throw new Error("API token is required. Provide it in the tool call or set FRESHRELEASE_API_TOKEN environment variable.");
    }

    const headers: Record<string, string> = {
      "Authorization": `Token ${apiToken}`,
      "Content-Type": "application/json",
    };

    try {
      switch (name) {
        case "freshrelease_search_user_by_name": {
          const { name: searchName, project_key = "FBOTS" } = (args as any) || {};
          if (!searchName) {
            throw new Error("name is required");
          }
          const result = await searchUserByName(searchName, apiToken, project_key);
          console.log('✔ User search completed');
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }

        case "freshrelease_get_issue": {
          const issue_key = (args as any)?.issue_key;
          if (!issue_key) {
            throw new Error("issue_key is required");
          }
          const project_key = extractProjectKey(issue_key);
          console.log(`Fetching issue: ${issue_key} from project: ${project_key}`);
          const response = await fetch(`${BASE_URL}/${project_key}/issues/${issue_key}`, {
            method: "GET",
            headers,
          });
          const data = await response.json();
          console.log('✔ Issue fetched successfully');
          return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
        }

        case "freshrelease_get_statuses": {
          const project_key = (args as any)?.project_key || "FBOTS";
          console.log(`Fetching statuses for project ${project_key}`);
          const response = await fetch(`${BASE_URL}/${project_key}/statuses`, {
            method: "GET",
            headers,
          });
          const data = await response.json();
          console.log('✔ Statuses fetched successfully');
          return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
        }

        case "freshrelease_get_issue_types": {
          const project_key = (args as any)?.project_key || "FBOTS";
          console.log(`Fetching issue types for project ${project_key}`);
          const response = await fetch(`${BASE_URL}/${project_key}/issue_types`, {
            method: "GET",
            headers,
          });
          const data = await response.json();
          console.log('✔ Issue types fetched successfully');
          return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
        }

        case "freshrelease_create_issue": {
          const { title, description, issue_type_id, owner_id, priority_id, status_id, project_key = "FBOTS" } = (args as any) || {};
          if (!title) {
            throw new Error("title is required");
          }
          
          // Default to Task (ID: 14) if not specified
          const typeId = issue_type_id || "14";
          console.log(`Creating issue in project ${project_key}: ${title} (Type ID: ${typeId})`);
          
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
          const response = await fetch(`${BASE_URL}/${project_key}/issues`, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
          });
          const data: any = await response.json();
          
          const createdKey = data?.issue?.key || 'N/A';
          console.log(`✔ Issue created successfully with key: ${createdKey}`);
          
          return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
        }

        case "freshrelease_update_issue": {
          const { issue_key, title, description, issue_type_id, status_id, owner_id, priority_id } = (args as any) || {};
          if (!issue_key) {
            throw new Error("issue_key is required");
          }
          const project_key = extractProjectKey(issue_key);
          console.log(`Updating issue: ${issue_key} in project: ${project_key}`);
          const updatePayload: any = { issue: { key: issue_key } };
          if (title) updatePayload.issue.title = title;
          if (description) updatePayload.issue.description = description;
          if (issue_type_id) updatePayload.issue.issue_type_id = parseInt(issue_type_id);
          if (status_id) updatePayload.issue.status_id = parseInt(status_id);
          if (owner_id) updatePayload.issue.owner_id = parseInt(owner_id);
          if (priority_id) updatePayload.issue.priority_id = parseInt(priority_id);
          
          const response = await fetch(`${BASE_URL}/${project_key}/issues/${issue_key}`, {
            method: "PUT",
            headers,
            body: JSON.stringify(updatePayload),
          });
          const data = await response.json();
          console.log('✔ Issue updated successfully');
          return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
        }

        case "freshrelease_add_comment": {
          const { issue_key, content } = (args as any) || {};
          if (!issue_key || !content) {
            throw new Error("issue_key and content are required");
          }
          
          const project_key = extractProjectKey(issue_key);
          console.log('Step 1: Fetching issue ID');
          const issue_id = await getIssueIdFromKey(issue_key, apiToken, project_key);
          
          console.log(`Step 2: Adding comment to issue ID: ${issue_id}`);
          const response = await fetch(`${BASE_URL}/${project_key}/issues/${issue_id}/comments`, {
            method: "POST",
            headers,
            body: JSON.stringify({ content }),
          });
          const commentData = await response.json();
          console.log('✔ Comment added successfully');
          
          return { 
            content: [{ 
              type: "text", 
              text: JSON.stringify({
                success: true,
                issue_key,
                issue_id,
                comment: commentData
              }, null, 2) 
            }] 
          };
        }

        case "freshrelease_get_comments": {
          const { issue_key } = (args as any) || {};
          if (!issue_key) {
            throw new Error("issue_key is required");
          }
          
          const project_key = extractProjectKey(issue_key);
          console.log('Step 1: Fetching issue ID');
          const issue_id = await getIssueIdFromKey(issue_key, apiToken, project_key);
          
          console.log(`Step 2: Fetching comments for issue ID: ${issue_id}`);
          const response = await fetch(`${BASE_URL}/${project_key}/issues/${issue_id}/comments`, {
            method: "GET",
            headers,
          });
          const commentsData = await response.json();
          console.log('✔ Comments fetched successfully');
          
          return { 
            content: [{ 
              type: "text", 
              text: JSON.stringify({
                issue_key,
                issue_id,
                comments: commentsData
              }, null, 2) 
            }] 
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      console.error('✗ Tool execution error:', error);
      return {
        content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  });

  return server;
}