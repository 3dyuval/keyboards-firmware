/**
 * MCP surface for Feathers services.
 *
 * Architecture: services declare MCP tools via `expose.mcp` (single def or array).
 * Each tool maps to a Feathers method (find/get/create/patch). The presenter hook
 * bridges async-generator services (ServiceEvent tuples) to MCP's request/response
 * model by draining the generator and extracting the final value.
 *
 * Error handling is delegated to McpServer — thrown errors from registerTool
 * callbacks are returned as `isError: true` by the SDK. No Feathers error hook needed.
 *
 * Two transports: stdio (compiled binary / sidecar) and HTTP (Streamable HTTP with
 * per-session server instances and CORS for browser clients).
 */
import type { App, Hook } from "../src/app.ts";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { McpToolDef } from "./types.ts";

// ── Feathers after-hook: drain async generators for MCP consumers ───

export const mcpPresenter = async (context: Hook) => {
  if (context.params.provider !== "mcp") return;

  const { result } = context;

  if (result && typeof result[Symbol.asyncIterator] === "function") {
    let last: any;
    for await (const batch of result) {
      last = batch;
    }
    const isServiceEvent = Array.isArray(last) && last.length === 3 && typeof last[0] === "string";
    context.result = isServiceEvent ? last[2] : last;
    return;
  }
};

// ── McpServer factory from expose.mcp declarations ──────────────────

function createMcpServer(app: App) {
  const mcp = new McpServer({ name: "keyb", version: "1.0.0" });

  for (const [path, instance] of Object.entries(app.services)) {
    const raw = (instance as any).expose?.mcp;
    if (!raw) continue;

    const defs: McpToolDef[] = Array.isArray(raw) ? raw : [raw];
    const service = app.service(path);

    for (const def of defs) {
      const method = def.resolves ?? "create";
      const isQuery = method === "find" || method === "get";

      mcp.registerTool(def.tool, {
        description: def.description,
        inputSchema: def.schema
          ? Object.fromEntries(Object.entries((def.schema as any).shape))
          : undefined,
      }, async (args) => {
        let result: any;
        if (method === "find") {
          result = await service.find({ ...args, provider: "mcp" });
        } else if (method === "get" && def.idParam) {
          const id = (args as any)[def.idParam];
          result = await service.get(id, { provider: "mcp" });
        } else if (method === "patch" && def.idParam) {
          const id = (args as any)[def.idParam];
          result = await service.patch(id, args, { provider: "mcp" });
        } else {
          result = await service[method](args, { provider: "mcp" });
        }

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
  }

  return mcp;
}

// ── Transports ──────────────────────────────────────────────────────

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
    const sessionId = req.headers.get("mcp-session-id");
    if (sessionId && sessions.has(sessionId)) {
      return withCors(await sessions.get(sessionId)!.handleRequest(req));
    }

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
