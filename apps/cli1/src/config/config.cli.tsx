import React, { useState } from "react";
import { useApp, Text, Box } from "ink";
import { useAsyncEffect } from "ahooks";
import { useService } from "../../lib/context.tsx";

export const aliases = ["c"];
export const description = "Print resolved app config";

export default function Config() {
  const { exit } = useApp();
  const { call } = useService("config");
  const [config, setConfig] = useState<any>();
  const [error, setError] = useState<Error>();

  useAsyncEffect(async function* () {
    try {
      const result = await call("find");
      setConfig(result);
    } catch (e: any) {
      setError(e);
    } finally {
      setTimeout(exit, 0);
    }
  }, []);

  if (error) return <Text color="red">Error: {error.message}</Text>;
  if (!config) return null;

  return (
    <Box flexDirection="column">
      <Text>{JSON.stringify(config, null, 2)}</Text>
    </Box>
  );
}
