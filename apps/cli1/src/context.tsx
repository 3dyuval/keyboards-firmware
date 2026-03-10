import { createContext, useContext, useCallback } from "react";
import { useApp } from "ink";
import type { Application } from "@feathersjs/feathers";

export const AppContext = createContext<Application>(null!);
export const RootContext = createContext<boolean>(false);

export const useService = (path: string) => {
  const app = useContext(AppContext);
  const isRoot = useContext(RootContext);
  const { exit } = useApp();

  const call = useCallback(
    async (method: string, data?: any, params: Record<string, any> = {}) => {
      try {
        return await (app.service(path) as any)[method](data, {
          ...params,
          provider: "cli",
        });
      } catch (err) {
        if (isRoot) exit(err as Error);
        else throw err;
      }
    },
    [app, path, isRoot, exit],
  );

  return { call };
};
