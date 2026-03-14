import type { Route } from "./route.ts";
import { flagsFromSchema } from "./route.ts";

interface DiscoveredCommand {
  command: string;
  aliases: string[];
  description: string;
  args: { name: string; required?: boolean }[];
  params: Record<string, any>;
}

function routeToDiscovery(route: Route): DiscoveredCommand {
  const positionalNames = (route.args ?? []).map((a) => a.name);
  const flags = flagsFromSchema(route.schema, positionalNames);

  // Positional args with type info from schema
  const argsWithTypes = (route.args ?? []).map((a) => {
    const schemaFlag = route.schema
      ? flagsFromSchema(route.schema)[a.name]
      : undefined;
    return {
      ...a,
      ...(schemaFlag?.enum ? { enum: schemaFlag.enum } : {}),
      ...(schemaFlag?.description
        ? { description: schemaFlag.description }
        : {}),
    };
  });

  return {
    command: route.command,
    aliases: route.aliases ?? [],
    description: route.description,
    args: argsWithTypes,
    params: flags,
  };
}

export function discover(routes: Route[], json = false) {
  const data = routes.map(routeToDiscovery);

  if (json) {
    console.log(JSON.stringify({ commands: data }, null, 2));
    return;
  }

  console.log("\nCommands:\n");
  for (const cmd of data) {
    const aliases = cmd.aliases.length ? `, ${cmd.aliases.join(", ")}` : "";
    const args = cmd.args
      .map((a: any) => {
        const label = a.required ? `<${a.name}>` : `[${a.name}]`;
        return label;
      })
      .join(" ");
    console.log(`  ${cmd.command}${aliases}  ${args}`);
    console.log(`    ${cmd.description}`);

    // Show positional arg details
    for (const a of cmd.args as any[]) {
      if (a.description || a.enum) {
        const type = a.enum ? a.enum.join("|") : "string";
        console.log(
          `      ${a.name}: ${type}${a.description ? "  - " + a.description : ""}`,
        );
      }
    }

    // Show flags
    for (const [key, p] of Object.entries(cmd.params) as [string, any][]) {
      const type = p.enum ? p.enum.join("|") : p.type;
      const alias = p.alias ? `, -${p.alias}` : "";
      console.log(
        `      --${key}${alias}: ${type}${p.description ? "  - " + p.description : ""}`,
      );
    }
  }
}
