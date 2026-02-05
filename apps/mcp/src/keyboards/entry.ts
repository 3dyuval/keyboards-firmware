import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { createApp, ref, h } from "vue";
import { KeyboardView } from "components";
import "components/style.css";
import "../global.css";

interface Keyboard {
  name: string
  physKeys: { x: number; y: number; w: number; h: number; r: number }[]
  layers: Record<string, (string | { t?: string; h?: string })[]>
}

const keyboards = ref<Keyboard[]>([]);

const vueApp = createApp({
  setup() {
    return () =>
      keyboards.value.map((kb) =>
        h(KeyboardView, {
          key: kb.name,
          name: kb.name,
          physKeys: kb.physKeys,
          layers: kb.layers,
        })
      );
  },
});

vueApp.mount("#app");

function handleHostContextChanged(ctx: McpUiHostContext) {
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
}

const mcp = new App({ name: "Keyboards App", version: "1.0.0" });

mcp.ontoolresult = (result: CallToolResult) => {
  const data = result.structuredContent as { keyboards?: Keyboard[] } | undefined;
  if (data?.keyboards) keyboards.value = data.keyboards;
};

mcp.onhostcontextchanged = handleHostContextChanged;

mcp.connect().then(() => {
  const ctx = mcp.getHostContext();
  if (ctx) handleHostContextChanged(ctx);
});
