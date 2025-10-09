import { createStatelessServer } from "@smithery/sdk/server/stateless.js";

const API_TOKEN = process.env.FRESHRELEASE_API_TOKEN || "";
const BASE_URL = "https://freshworks.freshrelease.com";
const PROJECT_KEY = "FBOTS";

interface FreshReleaseRequestOptions {
  method: string;
  endpoint: string;
  body?: any;
}

async function makeFreshReleaseRequest({ method, endpoint, body }: FreshReleaseRequestOptions) {
  const url = `${BASE_URL}${endpoint}`;
  
  const headers: Record<string, string> = {
    "Authorization": `Token ${API_TOKEN}`,
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

export default createStatelessServer({
  capabilities: {
    tools: {},
  },
  
  async listTools() {
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
  },
  
  async callTool({ name, arguments: args }) {
    switch (name) {
      case "freshrelease_get_users": {
        const page = args.page || 1;
        const data = await makeFreshReleaseRequest({
          method: "GET",
          endpoint: `/${PROJECT_KEY}/users?page=${page}`,
        });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      
      case "freshrelease_get_issue": {
        const { issue_key } = args;
        const data = await makeFreshReleaseRequest({
          method: "GET",
          endpoint: `/${PROJECT_KEY}/issues/${issue_key}`,
        });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  },
});
