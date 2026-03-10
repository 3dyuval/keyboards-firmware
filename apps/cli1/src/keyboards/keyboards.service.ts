import type { Params } from "@feathersjs/feathers";
import { BaseService } from "../app.ts";
import { KeyboardSchema, type Keyboard } from "./keyboards.schema.ts";

export interface KeyboardRow {
  name: string;
  config: Keyboard;
  details?: string;
  enriching?: boolean;
}

export default class KeyboardsService extends BaseService {
  schema = KeyboardSchema;

  // Progressive enrichment: yield names immediately, then enrich
  async *find(params: Params): AsyncGenerator<KeyboardRow[]> {
    const keyboards = this.app.get("keyboards") as Record<string, Keyboard>;
    const names = Object.keys(keyboards).sort();

    // Phase 1 — yield keyboard configs immediately
    const rows: KeyboardRow[] = names.map((name) => ({
      name,
      config: keyboards[name],
      enriching: true,
    }));
    yield rows;

    // Phase 2 — enrich with last event details from log service
    try {
      const log = this.app.service("log") as any;
      if (log?.find) {
        const events = await log.find({ query: { $limit: 50 } });
        const lastByKeyboard = new Map<string, any>();
        for (const event of events ?? []) {
          const kb = event.data?.keyboard;
          if (kb && !lastByKeyboard.has(kb)) {
            lastByKeyboard.set(kb, event);
          }
        }

        yield names.map((name) => {
          const event = lastByKeyboard.get(name);
          return {
            name,
            config: keyboards[name],
            details: event
              ? `${event.phase} ${new Date(event.timestamp).toLocaleDateString()}`
              : undefined,
            enriching: false,
          };
        });
      } else {
        // No log service — yield without enrichment
        yield names.map((name) => ({
          name,
          config: keyboards[name],
          enriching: false,
        }));
      }
    } catch {
      // Log service unavailable — yield unenriched
      yield names.map((name) => ({
        name,
        config: keyboards[name],
        enriching: false,
      }));
    }
  }
}
