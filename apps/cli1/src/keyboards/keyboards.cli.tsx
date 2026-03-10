import React, { useState, useEffect } from "react";
import { useApp, Box, Text } from "ink";
import { Spinner } from "@inkjs/ui";
import { useService } from "../context.tsx";
import { Table } from "../utils/table.tsx";
import type { KeyboardRow } from "./keyboards.service.ts";

export const command = "list";
export const description = "List all configured keyboards";

export function KeyboardList() {
  const { exit } = useApp();
  const { call } = useService("keyboards");
  const [rows, setRows] = useState<KeyboardRow[] | null>(null);
  const [enriching, setEnriching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const iter = await call("find");
        for await (const batch of iter) {
          setRows(batch);
          setEnriching(batch.some((r: KeyboardRow) => r.enriching));
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setTimeout(exit, 0);
      }
    })();
  }, []);

  if (error) return <Text color="red">Error: {error}</Text>;
  if (!rows) return <Spinner label="loading keyboards..." />;

  const tableData = rows.map((r) => ({
    name: r.name,
    type: r.config.type,
    workflow: r.config.workflow,
    details: r.details || "—",
  }));

  return (
    <Box flexDirection="column">
      <Text color="green">
        {rows.length} keyboards{enriching ? " (loading details...)" : ""}
      </Text>
      <Box marginTop={1}>
        <Table
          data={tableData}
          columns={[
            { key: "name", width: 12, color: "cyan" },
            { key: "type", width: 8 },
            { key: "workflow", width: 16, dimColor: true },
            { key: "details", dimColor: true },
          ]}
        />
      </Box>
    </Box>
  );
}
