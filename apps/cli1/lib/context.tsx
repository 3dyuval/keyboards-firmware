import { createContext, useContext, useCallback } from "react";
import { useApp } from "ink";
import type { App } from "../src/app.ts";

export const AppContext = createContext<App>(null!);
export const RootContext = createContext<boolean>(false);

export const useService = (path: string) => {
  const app = useContext(AppContext);
  const isRoot = useContext(RootContext);
  const { exit } = useApp();

  const call = useCallback(
    async (method: string, ...args: any[]) => {
      const svc = app.service(path) as any;
      if (args.length === 0) {
        return await svc[method]({ provider: "cli" });
      }
      const last = args[args.length - 1];
      if (last && typeof last === "object" && !Array.isArray(last)) {
        args[args.length - 1] = { ...last, provider: "cli" };
      } else {
        args.push({ provider: "cli" });
      }
      return await svc[method](...args);
    },
    [app, path],
  );

  return { call };
};
