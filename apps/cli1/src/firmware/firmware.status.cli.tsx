import React, { useState } from "react";
import { useApp, Box, Text } from "ink";
import { Spinner } from "@inkjs/ui";
import { useAsyncEffect } from "ahooks";
import { useService } from "../../lib/context.tsx";
import { Table } from "../components/table.tsx";

export const aliases = ["s"];
export const description = "Show CI build status for all keyboards";

export default function FirmwareStatus() {
  const { exit } = useApp();
  const { call } = useService("firmware");
  const [data, setData] = useState<{ data: Record<string, any>; stale?: boolean }>();
  const [error, setError] = useState<Error>();

  useAsyncEffect(async function* () {
    try {
      const iter = await call("find");
      for await (const event of iter) {
        setData(event);
        yield;
      }
    } catch (e: any) {
      setError(e);
    } finally {
      setTimeout(exit, 0);
    }
  }, []);

  if (error) return <Text color="red">Error: {error.message}</Text>;
  if (!data) return <Spinner label="loading status..." />;

  const tableData = Object.keys(data.data)
    .sort()
    .map((kb) => {
      const s = data.data[kb];
      const status = s.inProgress
        ? "in_progress"
        : (s.completed?.conclusion ?? "—");
      const detail = s.completed?.created_at
        ? `build ${new Date(s.completed.created_at).toLocaleString()}`
        : "—";
      return { keyboard: kb, status, details: detail };
    });

  return (
    <Box flexDirection="column">
      {data.stale && <Text dimColor>(stale — refreshing...)</Text>}
      <Table
        data={tableData}
        columns={[
          { key: "keyboard", width: 12, color: "cyan" },
          {
            key: "status",
            width: 14,
            color: (row) =>
              row.status === "success"
                ? "green"
                : row.status === "in_progress"
                  ? "yellow"
                  : "red",
          },
          { key: "details", dimColor: true },
        ]}
      />
    </Box>
  );
}
