/**
 * P7d summary counts. Distinct devices only.
 * Cutoff is the first howto_card_shown (P7 live), same idea as P4's
 * first day1_soft paywall view. No new columns: everything is in event_data.
 */

export interface P7SummaryEvent {
  deviceId: string;
  platform: string | null;
  eventType: string;
  eventData: unknown;
  createdAt: Date | string | number;
}

export interface P7Day1Summary {
  p7Cutoff: string | null;
  cardByDevice: {
    shown: number;
    continue: number;
    skip: number;
    back: number;
  };
  abandonsByPhaseAndRep: {
    phase: string;
    repIndex: number | null;
    devices: number;
  }[];
  day1CompletionByPlatform: {
    platform: string;
    completed: number;
    completedSinceP7: number;
  }[];
}

const EMPTY: P7Day1Summary = {
  p7Cutoff: null,
  cardByDevice: { shown: 0, continue: 0, skip: 0, back: 0 },
  abandonsByPhaseAndRep: [],
  day1CompletionByPlatform: [],
};

function eventTime(value: Date | string | number): number | null {
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function summarizeP7Day1(events: P7SummaryEvent[]): P7Day1Summary {
  if (!events.length) return EMPTY;

  const shown = new Set<string>();
  const continued = new Set<string>();
  const skipped = new Set<string>();
  const backed = new Set<string>();
  let cutoffMs: number | null = null;

  const abandonBuckets = new Map<string, Set<string>>();
  const completions = new Map<string, { platform: string; at: number }>();

  for (const event of events) {
    if (!event.deviceId) continue;
    const data = asRecord(event.eventData);
    const at = eventTime(event.createdAt);

    if (event.eventType === "howto_card_shown") {
      shown.add(event.deviceId);
      if (at != null && (cutoffMs == null || at < cutoffMs)) cutoffMs = at;
    } else if (event.eventType === "howto_card_dismissed") {
      const action = data?.action;
      if (action === "continue") continued.add(event.deviceId);
      else if (action === "skip") skipped.add(event.deviceId);
      else if (action === "back") backed.add(event.deviceId);
    } else if (event.eventType === "first_session_abandoned") {
      const phase =
        typeof data?.phase === "string" && data.phase.trim()
          ? data.phase
          : "unspecified";
      const rep =
        typeof data?.rep_index === "number" && Number.isFinite(data.rep_index)
          ? data.rep_index
          : null;
      const key = `${phase}\n${rep == null ? "" : String(rep)}`;
      let devices = abandonBuckets.get(key);
      if (!devices) {
        devices = new Set();
        abandonBuckets.set(key, devices);
      }
      devices.add(event.deviceId);
    } else if (event.eventType === "first_session_completed" && at != null) {
      const platform =
        typeof event.platform === "string" && event.platform.trim()
          ? event.platform
          : "unknown";
      const existing = completions.get(event.deviceId);
      if (!existing || at < existing.at) {
        completions.set(event.deviceId, { platform, at });
      }
    }
  }

  const byPlatform = new Map<
    string,
    { completed: number; completedSinceP7: number }
  >();
  for (const completion of completions.values()) {
    const row = byPlatform.get(completion.platform) ?? {
      completed: 0,
      completedSinceP7: 0,
    };
    row.completed += 1;
    if (cutoffMs != null && completion.at >= cutoffMs) {
      row.completedSinceP7 += 1;
    }
    byPlatform.set(completion.platform, row);
  }

  const abandonsByPhaseAndRep = Array.from(abandonBuckets.entries())
    .map(([key, devices]) => {
      const [phase, repRaw] = key.split("\n");
      return {
        phase,
        repIndex: repRaw === "" ? null : Number(repRaw),
        devices: devices.size,
      };
    })
    .sort((a, b) => {
      if (b.devices !== a.devices) return b.devices - a.devices;
      if (a.phase !== b.phase) return a.phase.localeCompare(b.phase);
      return (a.repIndex ?? -1) - (b.repIndex ?? -1);
    });

  const day1CompletionByPlatform = Array.from(byPlatform.entries())
    .map(([platform, counts]) => ({ platform, ...counts }))
    .sort((a, b) => {
      if (b.completed !== a.completed) return b.completed - a.completed;
      return a.platform.localeCompare(b.platform);
    });

  return {
    p7Cutoff: cutoffMs == null ? null : new Date(cutoffMs).toISOString(),
    cardByDevice: {
      shown: shown.size,
      continue: continued.size,
      skip: skipped.size,
      back: backed.size,
    },
    abandonsByPhaseAndRep,
    day1CompletionByPlatform,
  };
}
