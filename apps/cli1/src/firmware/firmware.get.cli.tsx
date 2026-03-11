import React, { useState } from "react";
import { useApp, Text } from "ink";
import { Spinner } from "@inkjs/ui";
import { useAsyncEffect } from "ahooks";
import { match } from "ts-pattern";
import { useService } from "../../lib/context.tsx";
import { FirmwareCreateSchema } from "./firmware.schema.ts";
import type { ServiceEvent } from "../../lib/types.ts";

export const aliases = ["g"];
export const description = "Download firmware only";
export const args = [{ name: "keyboard", required: true }];
export const schema = FirmwareCreateSchema;

export default function FirmwareGet({ keyboard }: { keyboard: string }) {
  const { exit } = useApp();
  const { call } = useService("firmware");
  const [event, setEvent] = useState<ServiceEvent>();
  const [error, setError] = useState<Error>();

  useAsyncEffect(async function* () {
    try {
      const iter = await call("create", { keyboard }, { keyboard });
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
  if (!event) return <Spinner label={`downloading ${keyboard}...`} />;

  const [stage, message] = event;

  return match(stage)
    .with("cached", () => <Text color="green">{message}</Text>)
    .with("downloaded", () => <Text color="green">{message}</Text>)
    .otherwise(() => <Spinner label={message} />);
}
