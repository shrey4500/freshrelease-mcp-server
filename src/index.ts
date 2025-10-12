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

  // Log when tools are listed
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    console.log('📋 Client requested tools list');
    const tools = {
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
    };
    console.log('✓ Returning tools:', JSON.stringify(tools, null, 2));
    return tools;
  });

  // Log when tools are called
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    console.log(`🔧 Tool called: ${name}`, JSON.stringify(args, null, 2));

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
