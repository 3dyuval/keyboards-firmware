import React, { useState } from "react";
import { useApp, Text } from "ink";
import { Spinner } from "@inkjs/ui";
import { useAsyncEffect } from "ahooks";
import { useService } from "../../lib/context.tsx";
import { FirmwareCreateSchema } from "./firmware.schema.ts";
import type { ProgressEvent } from "./firmware.service.ts";

export const aliases = ["g"];
export const description = "Download firmware only";
export const args = [{ name: "keyboard", required: true }];
export const schema = FirmwareCreateSchema;

export default function FirmwareGet({ keyboard }: { keyboard: string }) {
  const { exit } = useApp();
  const { call } = useService("firmware");
  const [stage, setStage] = useState<ProgressEvent>();
  const [error, setError] = useState<Error>();

  useAsyncEffect(async function* () {
    try {
      const iter = await call("create", { keyboard }, { keyboard });
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
  if (!stage) return <Spinner label={`downloading ${keyboard}...`} />;

  if (stage.stage === "cached")
    return <Text color="green">{stage.message}</Text>;
  if (stage.stage === "downloaded")
    return <Text color="green">{stage.message}</Text>;
  return <Spinner label={stage.message ?? stage.stage} />;
}
