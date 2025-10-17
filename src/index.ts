import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const BASE_URL = "https://freshworks.freshrelease.com";
const PROJECT_KEY = "FBOTS";

export const configSchema = z.object({
  apiToken: z.string().describe("Freshrelease API Token"),
});

// Helper function to get issue ID from issue key
async function getIssueIdFromKey(issue_key: string, apiToken: string) {
  const headers = {
    "Authorization": `Token ${apiToken}`,
    "Content-Type": "application/json",
  };
  
  console.log(`Fetching issue ID for: ${issue_key}`);
  
  const issueResponse = await fetch(`${BASE_URL}/${PROJECT_KEY}/issues/${issue_key}`, {
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
          description: "Get all issue types available in the Freshrelease project (e.g., Epic, Story, Task, Bug). Use this when asked about available issue types or what types of tickets can be created. Useful for finding the correct issue_type_id when creating issues.",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "freshrelease_create_issue",
          description: "Create a new issue/ticket in Freshrelease. Use this when asked to create, add, or make a new ticket, task, bug, or story. By default, creates a Task unless a different issue_type_id is specified. Returns the created issue including its key (e.g., FBOTS-51119).",
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
              issue_type_id: { 
                type: "string", 
                description: "The ID of the issue type. Defaults to '14' (Task) if not specified. Use freshrelease_get_issue_types to find other valid IDs like '11' for Epic, etc. Optional." 
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
            required: ["title"],
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
          description: "Add a comment to a Freshrelease issue using the issue key (e.g., FBOTS-51117). This automatically fetches the issue ID and adds the comment. Use this when asked to comment on, reply to, or add notes to a ticket.",
          inputSchema: {
            type: "object",
            properties: {
              issue_key: { 
                type: "string", 
                description: "The Freshrelease issue key (e.g., FBOTS-51117, FBOTS-46821). Required." 
              },
              content: { 
                type: "string", 
                description: "The comment text to add. Can include HTML formatting. Required." 
              },
            },
            required: ["issue_key", "content"],
          },
        },
        {
          name: "freshrelease_get_comments",
          description: "Get all comments on a Freshrelease issue using the issue key (e.g., FBOTS-51117). This automatically fetches the issue ID and retrieves all comments. Use this when asked to show comments, read discussion, or see what was said on a ticket.",
          inputSchema: {
            type: "object",
            properties: {
              issue_key: { 
                type: "string", 
                description: "The Freshrelease issue key (e.g., FBOTS-51117, FBOTS-46821). Required." 
              },
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

    const headers: Record<string, string> = {
      "Authorization": `Token ${config.apiToken}`,
      "Content-Type": "application/json",
    };

    try {
      switch (name) {
        case "freshrelease_get_users": {
          const page = (args as any)?.page || 1;
          console.log(`Fetching users, page ${page}`);
          const response = await fetch(`${BASE_URL}/${PROJECT_KEY}/users?page=${page}`, {
            method: "GET",
            headers,
          });
          const data = await response.json();
          console.log('✓ Users fetched successfully');
          return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
        }

        case "freshrelease_get_issue": {
          const issue_key = (args as any)?.issue_key;
          if (!issue_key) {
            throw new Error("issue_key is required");
          }
          console.log(`Fetching issue: ${issue_key}`);
          const response = await fetch(`${BASE_URL}/${PROJECT_KEY}/issues/${issue_key}`, {
            method: "GET",
            headers,
          });
          const data = await response.json();
          console.log('✓ Issue fetched successfully');
          return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
        }

        case "freshrelease_get_statuses": {
          console.log('Fetching statuses');
          const response = await fetch(`${BASE_URL}/${PROJECT_KEY}/statuses`, {
            method: "GET",
            headers,
          });
          const data = await response.json();
          console.log('✓ Statuses fetched successfully');
          return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
        }

        case "freshrelease_get_issue_types": {
          console.log('Fetching issue types');
          const response = await fetch(`${BASE_URL}/${PROJECT_KEY}/issue_types`, {
            method: "GET",
            headers,
          });
          const data = await response.json();
          console.log('✓ Issue types fetched successfully');
          return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
        }

        case "freshrelease_create_issue": {
          const { title, description, issue_type_id, owner_id, priority_id, status_id } = (args as any) || {};
          if (!title) {
            throw new Error("title is required");
          }
          
          // Default to Task (ID: 14) if not specified
          const typeId = issue_type_id || "14";
          console.log(`Creating issue: ${title} (Type ID: ${typeId})`);
          
          const payload = {
            issue: {
              title,
              description: description || "",
              key: PROJECT_KEY,
              issue_type_id: typeId,
              project_id: "280",
              owner_id: owner_id || null,
              priority_id: priority_id || null,
              status_id: status_id || null,
            }
          };
          const response = await fetch(`${BASE_URL}/${PROJECT_KEY}/issues`, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
          });
          const data = await response.json();
          
          // Extract and log the issue key
          const createdKey = (data as any)?.issue?.key || 'N/A';
          console.log(`✓ Issue created successfully with key: ${createdKey}`);
          
          return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
        }

        case "freshrelease_update_issue": {
          const { issue_key, title, description, status_id, owner_id, priority_id } = (args as any) || {};
          if (!issue_key) {
            throw new Error("issue_key is required");
          }
          console.log(`Updating issue: ${issue_key}`);
          const updatePayload: any = { issue: { key: issue_key } };
          if (title) updatePayload.issue.title = title;
          if (description) updatePayload.issue.description = description;
          if (status_id) updatePayload.issue.status_id = status_id;
          if (owner_id) updatePayload.issue.owner_id = owner_id;
          if (priority_id) updatePayload.issue.priority_id = priority_id;
          
          const response = await fetch(`${BASE_URL}/${PROJECT_KEY}/issues/${issue_key}`, {
            method: "PUT",
            headers,
            body: JSON.stringify(updatePayload),
          });
          const data = await response.json();
          console.log('✓ Issue updated successfully');
          return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
        }

        case "freshrelease_add_comment": {
          const { issue_key, content } = (args as any) || {};
          if (!issue_key || !content) {
            throw new Error("issue_key and content are required");
          }
          
          console.log('Step 1: Fetching issue ID');
          const issue_id = await getIssueIdFromKey(issue_key, config.apiToken);
          
          console.log(`Step 2: Adding comment to issue ID: ${issue_id}`);
          const response = await fetch(`${BASE_URL}/${PROJECT_KEY}/issues/${issue_id}/comments`, {
            method: "POST",
            headers,
            body: JSON.stringify({ content }),
          });
          const commentData = await response.json();
          console.log('✓ Comment added successfully');
          
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
          
          console.log('Step 1: Fetching issue ID');
          const issue_id = await getIssueIdFromKey(issue_key, config.apiToken);
          
          console.log(`Step 2: Fetching comments for issue ID: ${issue_id}`);
          const response = await fetch(`${BASE_URL}/${PROJECT_KEY}/issues/${issue_id}/comments`, {
            method: "GET",
            headers,
          });
          const commentsData = await response.json();
          console.log('✓ Comments fetched successfully');
          
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
