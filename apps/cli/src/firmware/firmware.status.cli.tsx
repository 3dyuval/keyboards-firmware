import React, { useState } from "react";
import { useApp, Box, Text } from "ink";
import { Spinner } from "@inkjs/ui";
import { useAsyncEffect } from "ahooks";
import { match, P } from "ts-pattern";
import { useService } from "../../lib/context.tsx";
import { Table } from "../components/table.tsx";
import type { ServiceEvent } from "../../lib/types.ts";
import type { StatusMap, KeyboardStatus, BuildJob } from "./firmware.service.ts";

export const aliases = ["s"];
export const description = "Show CI build status for all keyboards";

function statusRow(name: string, s: KeyboardStatus) {
  const rawStatus = s.inProgress
    ? "in_progress"
    : (s.completed?.conclusion ?? "—");
  const status = match(rawStatus)
    .with("success", () => "✓")
    .with("failure", () => "✗")
    .with("in_progress", () => "…")
    .otherwise(() => "—");

  const detail = match(s)
    .with({ completed: { created_at: P.instanceOf(Date) } }, ({ completed }) =>
      `build ${completed!.created_at.toLocaleString()}`,
    )
    .otherwise(() => "—");

  const children = match(s.completed?.jobs)
    .with(P.array({ name: P.string }), (jobs) => ({
      columns: [
        { key: "job" as const, width: 60 },
        {
          key: "result" as const,
          width: 12,
          color: (row: { result: string }) =>
            match(row.result)
              .with("✓", () => "green" as const)
              .with("✗", () => "red" as const)
              .otherwise(() => "yellow" as const),
        },
      ],
      data: jobs.map((j: BuildJob) => ({
        job: j.name,
        result: match(j.conclusion)
          .with("success", () => "✓")
          .with("failure", () => "✗")
          .otherwise(() => "—"),
      })),
    }))
    .otherwise(() => undefined);

  return { keyboard: name, workflow: s.workflow, status, details: detail, children };
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
          { key: "workflow", width: 16, dimColor: true },
          {
            key: "status",
            width: 14,
            color: (row) =>
              match(row.status)
                .with("✓", () => "green" as const)
                .with("…", () => "yellow" as const)
                .otherwise(() => "red" as const),
          },
          { key: "details", dimColor: true },
        ]}
      />
    </Box>
  );
}
