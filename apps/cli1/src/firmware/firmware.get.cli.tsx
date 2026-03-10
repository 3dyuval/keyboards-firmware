import React, { useState, useEffect } from "react";
import { useApp, Text } from "ink";
import { Spinner } from "@inkjs/ui";
import { useService } from "../lib/context.tsx";
import { FirmwareCreateSchema } from "./firmware.schema.ts";
import type { ProgressEvent } from "./firmware.service.ts";

export const aliases = ["g"];
export const description = "Download firmware only";
export const args = [{ name: "keyboard", required: true }];
export const schema = FirmwareCreateSchema;

export default function FirmwareGet({ keyboard }: { keyboard: string }) {
  const { exit } = useApp();
  const { call } = useService("firmware");
  const [stage, setStage] = useState<ProgressEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const iter = await call("create", { keyboard }, { keyboard });
        for await (const event of iter) {
          setStage(event);
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setTimeout(exit, 0);
      }
    })();
  }, []);

  if (error) return <Text color="red">Error: {error}</Text>;
  if (!stage) return <Spinner label={`downloading ${keyboard}...`} />;

  if (stage.stage === "cached")
    return <Text color="green">{stage.message}</Text>;
  if (stage.stage === "downloaded")
    return <Text color="green">{stage.message}</Text>;
  return <Spinner label={stage.message ?? stage.stage} />;
}
