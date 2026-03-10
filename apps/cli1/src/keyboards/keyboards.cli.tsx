import React, { useState, useEffect } from "react";
import { useApp, Box, Text } from "ink";
import { Spinner } from "@inkjs/ui";
import { useService } from "../context.tsx";
import { pad } from "../utils/pad.ts";

export const command = "list";
export const description = "List all configured keyboards";

export function KeyboardList() {
  const { exit } = useApp();
  const { call } = useService("keyboards");
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    call("find")
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setTimeout(exit, 0));
  }, []);

  if (error) return <Text color="red">Error: {error}</Text>;
  if (!data) return <Spinner label="loading keyboards..." />;

  const names = Object.keys(data).sort();

  return (
    <Box flexDirection="column">
      <Text color="green">{names.length} keyboards</Text>
      <Box flexDirection="column" marginTop={1}>
        <Box>
          <Text bold>{pad("name", 3)}</Text>
          <Text bold>{pad("type", 2)}</Text>
          <Text bold>{pad("workflow", 4)}</Text>
          <Text bold>details</Text>
        </Box>
        {names.map((name) => {
          const kb = data[name];
          return (
            <Box key={name}>
              <Text color="cyan">{pad(name, 3)}</Text>
              <Text>{pad(kb.type, 2)}</Text>
              <Text dimColor>{pad(kb.workflow, 4)}</Text>
              <Text dimColor>{kb.details || "—"}</Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
