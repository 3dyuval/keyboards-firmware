import React, { useState } from "react";
import { useApp, Box, Text } from "ink";
import { Spinner } from "@inkjs/ui";
import { useAsyncEffect } from "ahooks";
import { useService } from "../../lib/context.tsx";
import { Table } from "../components/table.tsx";
import type { KeyboardRow } from "./keyboards.service.ts";

export const aliases = ["l"];
export const description = "List all configured keyboards";

export default function KeyboardList() {
  const { exit } = useApp();
  const { call } = useService("keyboards");
  const [rows, setRows] = useState<KeyboardRow[]>();
  const [error, setError] = useState<Error>();

  useAsyncEffect(async function* () {
    try {
      const iter = await call("find");
      for await (const batch of iter) {
        setRows(batch);
        yield;
      }
    } catch (e: any) {
      setError(e);
    } finally {
      setTimeout(exit, 0);
    }
  }, []);

  if (error) return <Text color="red">Error: {error.message}</Text>;
  if (!rows) return <Spinner label="loading keyboards..." />;

  const enriching = rows.some((r) => r.enriching);
  const tableData = rows.map((r) => ({
    name: r.name,
    type: r.config.type,
    workflow: r.config.workflow,
    details: r.details || "—",
  }));

  return (
    <Box flexDirection="column">
      {enriching ? (
        <Spinner label={`${rows.length} keyboards (loading details...)`} />
      ) : (
        <Text color="green">{rows.length} keyboards</Text>
      )}
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
