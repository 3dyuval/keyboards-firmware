import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveAll } from "config";

// Works both from source (server.ts) and compiled (dist/server.js)
const DIST_DIR = import.meta.filename.endsWith(".ts")
  ? path.join(import.meta.dirname, "dist")
  : import.meta.dirname;

const resourceUri = "ui://keyboards";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "Keyboards MCP Server",
    version: "1.0.0",
  });

  registerAppTool(server,
    "get-keyboards",
    {
      title: "Get Keyboards",
      description: "Returns all keyboard configurations (physical layouts and keymaps).",
      inputSchema: {},
      _meta: { ui: { resourceUri } },
    },
    async (): Promise<CallToolResult> => {
      const all = resolveAll();
      const keyboards = all.map((kb) => ({
        name: kb.name,
        physKeys: kb.physKeys,
        layers: kb.keymap.layers,
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(keyboards) }],
        structuredContent: { keyboards },
      };
    },
  );

  registerAppResource(server,
    resourceUri,
    resourceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await fs.readFile(path.join(DIST_DIR, "keyboards.html"), "utf-8");
      return {
        contents: [
          { uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html },
        ],
      };
    },
  );

  return server;
}
