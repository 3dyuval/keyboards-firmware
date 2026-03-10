import type { Application, HookContext } from "@feathersjs/feathers";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// ── MCP after hook — shapes context.dispatch for stdio transport ────

export const mcpPresenter = async (context: HookContext) => {
  if (context.params.provider !== "mcp") return;

  const { result } = context;

  // Async generator — consume fully, keep last yield
  if (result && typeof result[Symbol.asyncIterator] === "function") {
    let last: any;
    for await (const batch of result) {
      last = batch;
    }
    context.result = last;
    return;
  }
};

// ── MCP error hook — return isError shape, never rethrow ────────────

export const mcpErrorHandler = async (context: HookContext) => {
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

interface McpToolDef {
  name: string;
  description: string;
  resolves: string;
  service: any;
  schema?: any;
}

function collectMcpTools(app: Application): Map<string, McpToolDef> {
  const tools = new Map<string, McpToolDef>();
  for (const [path, service] of Object.entries(app.services)) {
    const mcp = (service as any).expose?.mcp;
    if (!mcp) continue;
    tools.set(mcp.tool, {
      name: mcp.tool,
      description: mcp.description,
      resolves: mcp.resolves ?? "create",
      service: app.service(path),
      schema: mcp.schema, // tool input schema, not entity schema
    });
  }
  return tools;
}

export async function startMcpServer(app: Application) {
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
      // mcpPresenter after hook consumes generators → result is plain data
      // find/get take (params), create/patch/update take (data, params)
      const args = request.params.arguments ?? {};
      const method = def.resolves;
      const isQuery = method === "find" || method === "get";
      const result = isQuery
        ? await def.service[method]({ ...args, provider: "mcp" })
        : await def.service[method](args, { provider: "mcp" });

      // File result
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

      // Structured data — structuredContent must be a record, not array
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

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
