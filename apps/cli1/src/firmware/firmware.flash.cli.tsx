import React, { useState } from "react";
import { useApp, Text } from "ink";
import { Spinner } from "@inkjs/ui";
import { useAsyncEffect } from "ahooks";
import { useService } from "../../lib/context.tsx";
import { FirmwareFlashSchema } from "./firmware.schema.ts";
import type { ServiceEvent } from "../../lib/types.ts";

export const aliases = ["f"];
export const description = "Download and flash firmware";
export const args = [
  { name: "keyboard", required: true },
  { name: "side" },
];
export { FirmwareFlashSchema as schema };

export default function FirmwareFlash({
  keyboard,
  side,
  yes,
  reset,
}: {
  keyboard: string;
  side?: string;
  yes?: boolean;
  reset?: boolean;
}) {
  const { exit } = useApp();
  const { call } = useService("firmware");
  const [stage, setStage] = useState<ServiceEvent>();
  const [error, setError] = useState<Error>();

  useAsyncEffect(async function* () {
    try {
      const iter = await call(
        "patch",
        keyboard,
        { side, reset, yes },
        { keyboard },
      );
      for await (const event of iter) {
        setStage(event);
        yield;
      }
    } catch (e: any) {
      setError(e);
    } finally {
      setTimeout(exit, 0);
    }
  }, []);

  if (error) return <Text color="red">Error: {error.message}</Text>;
  if (!stage) return <Spinner label={`preparing ${keyboard}...`} />;

  if (stage.stage === "done")
    return <Text color="green">{stage.message ?? "done"}</Text>;
  return <Spinner label={stage.message ?? stage.stage} />;
}
