#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// API token can come from env variable or be passed during initialization
let API_TOKEN = process.env.FRESHRELEASE_API_TOKEN || "";
const BASE_URL = "https://freshworks.freshrelease.com";
const PROJECT_KEY = "FBOTS";

interface FreshReleaseRequestOptions {
  method: string;
  endpoint: string;
  body?: any;
  apiToken?: string;
}

async function makeFreshReleaseRequest({ method, endpoint, body, apiToken }: FreshReleaseRequestOptions) {
  const token = apiToken || API_TOKEN;
  if (!token) {
    throw new Error("FRESHRELEASE_API_TOKEN is required. Please provide it via environment variable or connection parameter.");
  }
  
  const url = `${BASE_URL}${endpoint}`;
  
  const headers: Record<string, string> = {
    "Authorization": `Token ${token}`,
    "Content-Type": "application/json",
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

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

// Store API token from initialization if provided
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "freshrelease_set_api_token",
        description: "Set the Freshrelease API token for this session. Call this first if you didn't provide the token via environment variable.",
        inputSchema: {
          type: "object",
          properties: {
            api_token: {
              type: "string",
              description: "Your Freshrelease API token",
            },
          },
          required: ["api_token"],
        },
      },
      {
        name: "freshrelease_get_users",
        description: "Get all users in the Freshrelease project with pagination support",
        inputSchema: {
          type: "object",
          properties: {
            page: {
              type: "number",
              description: "Page number for pagination (default: 1)",
              default: 1,
            },
          },
        },
      },
      {
        name: "freshrelease_get_statuses",
        description: "Get all statuses in the Freshrelease project",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "freshrelease_get_issue_types",
        description: "Get all issue types in the Freshrelease project",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "freshrelease_get_issue",
        description: "Get a specific issue by its key (e.g., FBOTS-47941)",
        inputSchema: {
          type: "object",
          properties: {
            issue_key: {
              type: "string",
              description: "Issue key (e.g., FBOTS-47941)",
            },
          },
          required: ["issue_key"],
        },
      },
      {
        name: "freshrelease_create_issue",
        description: "Create a new issue in Freshrelease",
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Issue title",
            },
            description: {
              type: "string",
              description: "Issue description",
            },
            issue_type_id: {
              type: "string",
              description: "Issue type ID (e.g., '14' for task)",
            },
            owner_id: {
              type: "string",
              description: "Owner user ID",
            },
            project_id: {
              type: "string",
              description: "Project ID (e.g., '280')",
            },
            custom_fields: {
              type: "object",
              description: "Custom fields object (e.g., {cf_dev_owner: 'Name', cf_freshdesk_tickets: 'ABC'})",
            },
          },
          required: ["title", "description", "issue_type_id", "owner_id", "project_id"],
        },
      },
      {
        name: "freshrelease_update_issue",
        description: "Update an existing Freshrelease issue",
        inputSchema: {
          type: "object",
          properties: {
            issue_key: {
              type: "string",
              description: "Issue key (e.g., FBOTS-48937)",
            },
            title: {
              type: "string",
              description: "Updated issue title",
            },
            description: {
              type: "string",
              description: "Updated issue description",
            },
            issue_type_id: {
              type: "string",
              description: "Issue type ID",
            },
            status_id: {
              type: "string",
              description: "Status ID",
            },
            priority_id: {
              type: "string",
              description: "Priority ID",
            },
            owner_id: {
              type: "string",
              description: "Owner ID",
            },
            custom_fields: {
              type: "object",
              description: "Custom fields to update (e.g., {cf_dev_owner: 'Name'})",
            },
          },
          required: ["issue_key"],
        },
      },
      {
        name: "freshrelease_add_comment",
        description: "Add a comment to a Freshrelease issue",
        inputSchema: {
          type: "object",
          properties: {
            issue_id: {
              type: "string",
              description: "Issue ID (numeric, e.g., '2563487')",
            },
            content: {
              type: "string",
              description: "Comment content",
            },
          },
          required: ["issue_id", "content"],
        },
      },
      {
        name: "freshrelease_get_comments",
        description: "Get all comments for a Freshrelease issue",
        inputSchema: {
          type: "object",
          properties: {
            issue_id: {
              type: "string",
              description: "Issue ID (numeric, e.g., '2563487')",
            },
          },
          required: ["issue_id"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "freshrelease_set_api_token": {
        const { api_token } = args;
        API_TOKEN = api_token;
        return {
          content: [{ type: "text", text: "API token set successfully for this session." }],
        };
      }

      case "freshrelease_get_users": {
        const page = args.page || 1;
        const data = await makeFreshReleaseRequest({
          method: "GET",
          endpoint: `/${PROJECT_KEY}/users?page=${page}`,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }

      case "freshrelease_get_statuses": {
        const data = await makeFreshReleaseRequest({
          method: "GET",
          endpoint: `/${PROJECT_KEY}/statuses`,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }

      case "freshrelease_get_issue_types": {
        const data = await makeFreshReleaseRequest({
          method: "GET",
          endpoint: `/${PROJECT_KEY}/issue_types`,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }

      case "freshrelease_get_issue": {
        const { issue_key } = args;
        const data = await makeFreshReleaseRequest({
          method: "GET",
          endpoint: `/${PROJECT_KEY}/issues/${issue_key}`,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }

      case "freshrelease_create_issue": {
        const { title, description, issue_type_id, owner_id, project_id, custom_fields } = args;
        
        const issueData = {
          issue: {
            title,
            description,
            key: PROJECT_KEY,
            issue_type_id,
            owner_id,
            project_id,
            story_points: null,
            effort: null,
            duration: null,
            blocked_days: null,
            resolved: false,
            blocked: false,
            following: false,
            auto_close_descendants: false,
            blocked_reason: null,
            tags: [],
            parent_title: null,
            parent_issue_type_id: null,
            epic_title: null,
            epic_id: null,
            eta_flag: null,
            position: null,
            sprint_issue_status: null,
            previous_issue_id: null,
            next_issue_id: null,
            creater_id: null,
            parent_id: null,
            priority_id: null,
            sub_project_id: null,
            reporter_id: null,
            sprint_id: null,
            status_id: null,
            release_id: null,
            form_id: null,
            workflow_id: null,
            custom_field: custom_fields || {},
          },
        };

        const data = await makeFreshReleaseRequest({
          method: "POST",
          endpoint: `/${PROJECT_KEY}/issues`,
          body: issueData,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }

      case "freshrelease_update_issue": {
        const { issue_key, title, description, issue_type_id, status_id, priority_id, owner_id, custom_fields } = args;
        
        const updateData: any = {
          issue: {
            key: issue_key,
          },
        };

        if (title) updateData.issue.title = title;
        if (description) updateData.issue.description = description;
        if (issue_type_id) updateData.issue.issue_type_id = issue_type_id;
        if (status_id) updateData.issue.status_id = status_id;
        if (priority_id) updateData.issue.priority_id = priority_id;
        if (owner_id) updateData.issue.owner_id = owner_id;
        if (custom_fields) updateData.issue.custom_field = custom_fields;

        const data = await makeFreshReleaseRequest({
          method: "PUT",
          endpoint: `/${PROJECT_KEY}/issues/${issue_key}`,
          body: updateData,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }

      case "freshrelease_add_comment": {
        const { issue_id, content } = args;
        const data = await makeFreshReleaseRequest({
          method: "POST",
          endpoint: `/${PROJECT_KEY}/issues/${issue_id}/comments`,
          body: { content },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }

      case "freshrelease_get_comments": {
        const { issue_id } = args;
        const data = await makeFreshReleaseRequest({
          method: "GET",
          endpoint: `/${PROJECT_KEY}/issues/${issue_id}/comments`,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Freshrelease MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
