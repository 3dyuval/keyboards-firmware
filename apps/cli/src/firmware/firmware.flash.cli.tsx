import React, { useState } from "react";
import { useApp, Text } from "ink";
import { Spinner } from "@inkjs/ui";
import { useAsyncEffect } from "ahooks";
import { match } from "ts-pattern";
import { useService } from "../../lib/context.tsx";
import { FirmwareFlashSchema } from "./firmware.schema.ts";
import type { ServiceEvent } from "../../lib/types.ts";

export const aliases = ["f"];
export const description = "Flash firmware to keyboard";
export const args = [
  { name: "artifact", required: true, description: "Artifact name (e.g. totem-left) or path to .uf2/.bin" },
];
export { FirmwareFlashSchema as schema };

export default function FirmwareFlash({
  artifact,
  source,
  run,
  yes,
  reset,
}: {
  artifact: string;
  source?: string;
  run?: string;
  yes?: boolean;
  reset?: boolean;
}) {
  const { exit } = useApp();
  const { call } = useService("firmware");
  const [event, setEvent] = useState<ServiceEvent>();
  const [error, setError] = useState<Error>();

  useAsyncEffect(async function* () {
    try {
      const iter = await call("patch", artifact, { artifact, source, run, reset, yes }, {});
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
  if (!event) return <Spinner label={`resolving ${artifact}...`} />;

  const [stage, message] = event;

  return match(stage)
    .with("done", () => <Text color="green">{message}</Text>)
    .otherwise(() => <Spinner label={message} />);
}
