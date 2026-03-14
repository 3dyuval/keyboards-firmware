import type { App, Hook } from "../src/app.ts";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

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

function createMcpServer(app: App) {
  const mcp = new McpServer({ name: "keyb", version: "1.0.0" });

  for (const [path, instance] of Object.entries(app.services)) {
    const def = (instance as any).expose?.mcp as McpToolDef | undefined;
    if (!def) continue;

    const service = app.service(path);
    const method = def.resolves ?? "create";
    const isQuery = method === "find" || method === "get";

    mcp.registerTool(def.tool, {
      description: def.description,
      inputSchema: def.schema
        ? Object.fromEntries(Object.entries((def.schema as any).shape))
        : undefined,
    }, async (args) => {
      const result = isQuery
        ? await service[method]({ ...args, provider: "mcp" })
        : await service[method](args, { provider: "mcp" });

      if (result?.filePath && result?.mimeType) {
        const blob = Buffer.from(
          await Bun.file(result.filePath).arrayBuffer(),
        ).toString("base64");
        return {
          content: [{
            type: "resource" as const,
            resource: {
              uri: `file://${result.filePath}`,
              mimeType: result.mimeType,
              blob,
            },
          }],
        };
      }

      const text = JSON.stringify(result, null, 2);
      return { content: [{ type: "text" as const, text }] };
    });
  }

  return mcp;
}

export async function startMcpServer(app: App) {
  const server = createMcpServer(app);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, mcp-session-id, mcp-protocol-version",
  "Access-Control-Expose-Headers": "mcp-session-id",
};

export async function startMcpHttpServer(app: App) {
  const { port, idleTimeout } = app.get("mcp" as any);
  const sessions = new Map<string, WebStandardStreamableHTTPServerTransport>();

  const withCors = (res: Response) => {
    for (const [k, v] of Object.entries(corsHeaders)) res.headers.set(k, v);
    return res;
  };

  const handleMcp = async (req: Request) => {
    // Route to existing session
    const sessionId = req.headers.get("mcp-session-id");
    if (sessionId && sessions.has(sessionId)) {
      return withCors(await sessions.get(sessionId)!.handleRequest(req));
    }

    // New session
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (id) => {
        sessions.set(id, transport);
      },
    });

    transport.onclose = () => {
      if (transport.sessionId) sessions.delete(transport.sessionId);
    };

    const server = createMcpServer(app);
    await server.connect(transport);

    return withCors(await transport.handleRequest(req));
  };

  Bun.serve({
    port,
    idleTimeout,
    routes: {
      "/mcp": {
        OPTIONS: () => new Response(null, { status: 204, headers: corsHeaders }),
        GET: handleMcp,
        POST: handleMcp,
        DELETE: handleMcp,
      },
    },
  });

  console.log(`MCP HTTP server listening on http://localhost:${port}/mcp`);
}
