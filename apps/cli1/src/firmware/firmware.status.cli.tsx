import React, { useState, useEffect } from "react";
import { useApp, Box, Text } from "ink";
import { Spinner } from "@inkjs/ui";
import { useService } from "../../lib/context.tsx";
import { Table } from "../components/table.tsx";

export const aliases = ["s"];
export const description = "Show CI build status for all keyboards";

export default function FirmwareStatus() {
  const { exit } = useApp();
  const { call } = useService("firmware");
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const iter = await call("find");
        for await (const event of iter) {
          setData(event.data);
          setStale(event.stale ?? false);
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setTimeout(exit, 0);
      }
    })();
  }, []);

  if (error) return <Text color="red">Error: {error}</Text>;
  if (!data) return <Spinner label="loading status..." />;

  const tableData = Object.keys(data)
    .sort()
    .map((wf) => {
      const s = data[wf];
      const status = s.inProgress
        ? "in_progress"
        : (s.completed?.conclusion ?? "—");
      const detail = s.completed?.created_at
        ? `build ${new Date(s.completed.created_at).toLocaleDateString()}`
        : "—";
      return { workflow: wf, status, details: detail };
    });

  return (
    <Box flexDirection="column">
      {stale && <Text dimColor>(stale — refreshing...)</Text>}
      <Table
        data={tableData}
        columns={[
          { key: "workflow", width: 12, color: "cyan" },
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
