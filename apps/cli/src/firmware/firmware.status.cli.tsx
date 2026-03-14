import React, { useState } from "react";
import { useApp, Box, Text } from "ink";
import { Spinner } from "@inkjs/ui";
import { useAsyncEffect } from "ahooks";
import { match, P } from "ts-pattern";
import { useService } from "../../lib/context.tsx";
import { Table } from "../components/table.tsx";
import type { ServiceEvent } from "../../lib/types.ts";
import type { StatusMap, KeyboardStatus } from "./firmware.service.ts";

export const aliases = ["s"];
export const description = "Show CI build status for all keyboards";

function statusRow(name: string, s: KeyboardStatus) {
  const status = s.inProgress
    ? "in_progress"
    : (s.completed?.conclusion ?? "—");

  const detail = match(s)
    .with({ completed: { created_at: P.instanceOf(Date) } }, ({ completed }) =>
      `build ${completed!.created_at.toLocaleString()}`,
    )
    .otherwise(() => "—");

  return { keyboard: name, status, details: detail };
}

export default function FirmwareStatus() {
  const { exit } = useApp();
  const { call } = useService("firmware");
  const [event, setEvent] = useState<ServiceEvent<StatusMap>>();
  const [error, setError] = useState<Error>();

  useAsyncEffect(async function* () {
    try {
      const iter = await call("find");
      for await (const ev of iter) {
        setEvent(ev);
        yield;
      }
    } catch (e: any) {
      setError(e);
    } finally {
      setTimeout(exit, 0);
    }
  }, []);

  if (error) return <Text color="red">Error: {error.message}</Text>;
  if (!event) return <Spinner label="loading status..." />;

  const [, message, data] = event;
  const stale = message === "cached";

  const tableData = Object.entries(data)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, s]) => statusRow(name, s));

  return (
    <Box flexDirection="column">
      {stale && <Text dimColor>(stale — refreshing...)</Text>}
      <Table
        data={tableData}
        columns={[
          { key: "keyboard", width: 12, color: "cyan" },
          {
            key: "status",
            width: 14,
            color: (row) =>
              match(row.status)
                .with("success", () => "green" as const)
                .with("in_progress", () => "yellow" as const)
                .otherwise(() => "red" as const),
          },
          { key: "details", dimColor: true },
        ]}
      />
    </Box>
  );
}
