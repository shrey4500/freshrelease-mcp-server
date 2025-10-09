import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const BASE_URL = "https://freshworks.freshrelease.com";
const PROJECT_KEY = "FBOTS";

// Configuration schema for Smithery
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

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
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
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const headers: Record<string, string> = {
      "Authorization": `Token ${config.apiToken}`,
      "Content-Type": "application/json",
    };

    try {
      switch (name) {
        case "freshrelease_get_users": {
          const page = (args as any)?.page || 1;
          const response = await fetch(`${BASE_URL}/${PROJECT_KEY}/users?page=${page}`, {
            method: "GET",
            headers,
          });
          const data = await response.json();
          return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
        }

        case "freshrelease_get_issue": {
          const issue_key = (args as any)?.issue_key;
          if (!issue_key) {
            throw new Error("issue_key is required");
          }
          const response = await fetch(`${BASE_URL}/${PROJECT_KEY}/issues/${issue_key}`, {
            method: "GET",
            headers,
          });
          const data = await response.json();
          return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  });

  return server;
}
