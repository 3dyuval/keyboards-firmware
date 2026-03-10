import { app } from "../app.ts";

export function pad(s: string, cols: number) {
  const tabSize = (app.get("display")?.tabSize as number) ?? 4;
  return s.padEnd(cols * tabSize);
}
