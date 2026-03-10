import React, { useState } from "react";
import { useApp, Text } from "ink";
import { Spinner } from "@inkjs/ui";
import { useAsyncEffect } from "ahooks";
import { useService } from "../../lib/context.tsx";
import { DrawSchema } from "./draw.schema.ts";
import type { ServiceEvent } from "../../lib/types.ts";

export const aliases = ["d"];
export const description = "Generate keymap SVG";
export const args = [{ name: "keyboard", required: true }];
export { DrawSchema as schema };

export default function Draw({ keyboard }: { keyboard: string }) {
  const { exit } = useApp();
  const { call } = useService("draw");
  const [stage, setStage] = useState<ServiceEvent>();
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
  if (!stage) return <Spinner label={`preparing ${keyboard}...`} />;

  if (stage.stage === "done") {
    const { svg } = stage.data;
    return <Text color="green">wrote {svg}</Text>;
  }
  return <Spinner label={stage.message ?? stage.stage} />;
}
