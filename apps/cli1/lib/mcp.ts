import type { App, Hook } from "../src/app.ts";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// ── MCP after hook — shapes context.dispatch for stdio transport ────

export const mcpPresenter = async (context: Hook) => {
  if (context.params.provider !== "mcp") return;

  const { result } = context;

  // Async generator — consume fully, extract value from last tuple
  if (result && typeof result[Symbol.asyncIterator] === "function") {
    let last: any;
    for await (const batch of result) {
      last = batch;
    }
    // ServiceEvent is [stage, message, value] — extract value for MCP
    context.result = Array.isArray(last) ? last[2] : last;
    return;
  }
};

// ── MCP error hook — return isError shape, never rethrow ────────────

export const mcpErrorHandler = async (context: Hook) => {
  if (context.params.provider !== "mcp") return;

  context.result = {
    isError: true,
    content: [
      {
        type: "text",
        text: context.error?.message ?? "Unknown error",
      },
    ],
  };

  context.error = undefined;
};

// ── MCP server — tools from expose.mcp declarations ─────────────────

import type { McpToolDef } from "./types.ts";

interface ResolvedTool extends McpToolDef {
  name: string;
  service: any;
}

function collectMcpTools(app: App): Map<string, ResolvedTool> {
  const tools = new Map<string, ResolvedTool>();
  for (const [path, service] of Object.entries(app.services)) {
    const mcp = (service as any).expose?.mcp as McpToolDef | undefined;
    if (!mcp) continue;
    tools.set(mcp.tool, {
      ...mcp,
      name: mcp.tool,
      resolves: mcp.resolves ?? "create",
      service: app.service(path),
    });
  }
  return tools;
}

function createMcpServer(app: App) {
  const tools = collectMcpTools(app);

  const server = new Server(
    { name: "keyb", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [...tools.values()].map((def) => ({
      name: def.name,
      description: def.description,
      inputSchema: def.schema
        ? z.toJSONSchema(def.schema)
        : { type: "object" as const },
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const def = tools.get(request.params.name);
    if (!def) {
      return {
        isError: true,
        content: [
          { type: "text" as const, text: `Unknown tool: ${request.params.name}` },
        ],
      };
    }

    try {
      const args = request.params.arguments ?? {};
      const method = def.resolves;
      const isQuery = method === "find" || method === "get";
      const result = isQuery
        ? await def.service[method]({ ...args, provider: "mcp" })
        : await def.service[method](args, { provider: "mcp" });

      if (result?.filePath && result?.mimeType) {
        const blob = Buffer.from(
          await Bun.file(result.filePath).arrayBuffer(),
        ).toString("base64");
        return {
          content: [
            {
              type: "resource" as const,
              resource: {
                uri: `file://${result.filePath}`,
                mimeType: result.mimeType,
                blob,
              },
            },
          ],
        };
      }

      const text = JSON.stringify(result, null, 2);
      if (result && typeof result === "object" && !Array.isArray(result)) {
        return {
          structuredContent: result,
          content: [{ type: "text" as const, text }],
        };
      }
      return {
        content: [{ type: "text" as const, text }],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [
          { type: "text" as const, text: err.message ?? String(err) },
        ],
      };
    }
  });

  return server;
}

export async function startMcpServer(app: App) {
  const server = createMcpServer(app);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export async function startMcpHttpServer(app: App, port = 3001) {
  const sessions = new Map<string, WebStandardStreamableHTTPServerTransport>();

  Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname !== "/mcp") {
        return new Response("Not found", { status: 404 });
      }

      // Route to existing session
      const sessionId = req.headers.get("mcp-session-id");
      if (sessionId && sessions.has(sessionId)) {
        return sessions.get(sessionId)!.handleRequest(req);
      }

      // New session — create transport + server
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        onsessioninitialized: (id) => {
          sessions.set(id, transport);
        },
      });

      transport.onclose = () => {
        if (transport.sessionId) sessions.delete(transport.sessionId);
      };

      const server = createMcpServer(app);
      await server.connect(transport);

      return transport.handleRequest(req);
    },
  });

  console.log(`MCP HTTP server listening on http://localhost:${port}/mcp`);
}
