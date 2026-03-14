import React, { useContext, useState } from "react";
import { useApp, Text } from "ink";
import { Spinner } from "@inkjs/ui";
import { useAsyncEffect } from "ahooks";
import { match } from "ts-pattern";
import { AppContext, useService } from "../../lib/context.tsx";
import { DrawSchema } from "./draw.schema.ts";
import type { ServiceEvent } from "../../lib/types.ts";

export const aliases = ["d"];
export const description = "Generate keymap SVG";
export const args = [{ name: "keyboard", required: true }];
export { DrawSchema as schema };

export default function Draw({ keyboard }: { keyboard: string }) {
  const { exit } = useApp();
  const app = useContext(AppContext);
  const root = app.get("root");
  const { call } = useService("draw");
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
  if (!event) return <Spinner label={`drawing ${keyboard}...`} />;

  const [stage, message, value] = event;

  return match(stage)
    .with("done", () => {
      const rel = value.svg.replace(`${root}/`, "");
      return <Text color="green">draw {rel}</Text>;
    })
    .otherwise(() => <Spinner label={message} />);
}
