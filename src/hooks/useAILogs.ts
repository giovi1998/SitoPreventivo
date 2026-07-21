import { useCallback, useEffect, useRef, useState } from 'react';
import type { AILogEntry } from '../ai/types';
import {
  StreamBuffer,
  createStreamEntry,
  createSuccessEntry,
  createErrorEntry,
  createToolEntry,
  createInfoEntry,
} from '../ai/eventLog';
import { logger } from '../utils/logger';

const MAX_LOG_ENTRIES = 40;
const STREAM_UPDATE_THRESHOLD = 80;
const MAX_DETAIL_CHARS = 8192;
const STORAGE_KEY = 'pq_ai_logs:v1';

interface PersistedLogs {
  version: 1;
  entries: AILogEntry[];
}

const STORAGE_MAX_CHARS = 8192;

function truncateForStorage(detail?: string): string | undefined {
  if (!detail) return undefined;
  if (detail.length <= STORAGE_MAX_CHARS) return detail;
  return `${detail.slice(0, STORAGE_MAX_CHARS)}…`;
}

function safeRestore(): AILogEntry[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PersistedLogs;
    if (parsed.version !== 1 || !Array.isArray(parsed.entries)) return [];
    // Defensive strip: never restore detail longer than cap.
    return parsed.entries.map((e) => ({
      ...e,
      detail: truncateForStorage(e.detail),
      tokens: e.tokens && typeof e.tokens.total === 'number' ? e.tokens : undefined,
    }));
  } catch {
    return [];
  }
}


// Per le anteprime base64 non passiamo mai attraverso sessionStorage.
function stripPreview(entry: AILogEntry): AILogEntry {
  if (entry.imagePreviewBase64) {
    return { ...entry, imagePreviewBase64: undefined };
  }
  return entry;
}

function safePersist(entries: AILogEntry[]): void {
    try {
      const payload: PersistedLogs = {
        version: 1,
        entries: entries.slice(-100).map((e) => stripPreview({
          ...e,
          detail: truncateForStorage(e.detail),
        })),
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // sessionStorage disabled/full → silently drop persistence.
    }
  }

export interface UseAILogsReturn {
  logs: AILogEntry[];
  isProcessing: boolean;
  /** TB-023: costo totale cumulato della sessione corrente. */
  totalCostUsd: number;
  /** TB-023: costo dell'ultima operazione conclusa. */
  lastCostUsd: number;
  startStream(msg: string, meta?: Partial<AILogEntry>): string;
  appendStream(entryId: string, chunk: string): void;
        finalizeStream(
      entryId: string,
      ok: boolean,
      meta?: {
        tokens?: AILogEntry['tokens'];
        durationMs?: number;
        detail?: string;
        errorMsg?: string;
        /** TB-023: costo dell'operazione loggata. */
        costUsd?: number;
        modelId?: string;
        requestId?: string;
        /** TB-023: anteprima base64 immagine allegata. */
        imagePreviewBase64?: string;
        /** TB-023: flag operazione con immagine. */
        hasImage?: boolean;
      }
    ): void;
  /** Add or update a log entry with image preview metadata. */
  updateLogImagePreview(id: string, imagePreviewBase64?: string): void;
  info(msg: string, detail?: string, meta?: Partial<AILogEntry>): string;
  success(msg: string, detail?: string, meta?: Partial<AILogEntry>): string;
  error(msg: string, detail?: string, meta?: Partial<AILogEntry>): string;
  tool(msg: string, durationMs?: number, detail?: string): string;
  clear(): void;
}

export function useAILogs(route?: string): UseAILogsReturn {
  const [logs, setLogs] = useState<AILogEntry[]>(safeRestore);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastCostUsd, setLastCostUsd] = useState(0);

  const streamBufferRef = useRef(new StreamBuffer());
  const streamEntryIdRef = useRef<string | null>(null);
  const streamStartRef = useRef<number>(0);
  const streamMetaRef = useRef<Partial<AILogEntry>>({});
  const lastCharCountRef = useRef<number>(0);

  useEffect(() => {
    safePersist(logs);
  }, [logs]);

  const addLog = useCallback((entry: AILogEntry): string => {
    const safe: AILogEntry = { ...entry };
    setLogs((prev) => {
      const next = [...prev, safe];
      if (next.length > MAX_LOG_ENTRIES) next.shift();
      return next;
    });
    if (safe.costUsd != null && safe.costUsd >= 0) {
      setLastCostUsd(safe.costUsd);
    }
    return safe.id;
  }, []);

  const updateLog = useCallback((id: string, patch: Partial<AILogEntry>): void => {
    let costPatch: number | null = null;
    setLogs((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l, ...patch, detail: patch.detail ?? l.detail };
        if (patch.costUsd !== undefined) costPatch = patch.costUsd;
        return next;
      })
    );
    if (costPatch != null && costPatch >= 0) {
      setLastCostUsd(costPatch);
    } else if (costPatch === 0) {
      // zero-cost image entries still reset lastCostUsd so the UI reflects the latest op
      setLastCostUsd(0);
    }
    // We need the new cost to be visible to callers that read lastCostUsd right after
    // finalizing (e.g., hook handlers). Batching can defer the state update, so we also
    // update the ref exposed via totalCostUsd below.
  }, []);

  const startStream = useCallback(
    (msg: string, meta?: Partial<AILogEntry>): string => {
      streamBufferRef.current.clear();
      streamStartRef.current = Date.now();
      streamMetaRef.current = meta || {};
      lastCharCountRef.current = 0;

      const entry = createStreamEntry();
      entry.msg = msg;
      if (meta?.requestId) entry.requestId = meta.requestId;
      if (meta?.sessionId) entry.sessionId = meta.sessionId;
      if (meta?.modelId) entry.modelId = meta.modelId;

      streamEntryIdRef.current = entry.id;
      setIsProcessing(true);
      addLog(entry);
      return entry.id;
    },
    [addLog]
  );

  const appendStream = useCallback(
    (entryId: string, chunk: string): void => {
      if (!chunk) return;
      streamBufferRef.current.append(chunk);
      const total = streamBufferRef.current.getRaw().length;
      if (entryId && total - lastCharCountRef.current >= STREAM_UPDATE_THRESHOLD) {
        lastCharCountRef.current = total;
        const elapsed = ((Date.now() - streamStartRef.current) / 1000).toFixed(1);
        updateLog(entryId, { msg: `Generazione in corso… ${total} caratteri · ${elapsed}s` });
      }
    },
    [updateLog]
  );

  const finalizeStream = useCallback(
    (
      entryId: string,
      ok: boolean,
      meta?: {
        tokens?: AILogEntry['tokens'];
        durationMs?: number;
        detail?: string;
        errorMsg?: string;
        costUsd?: number;
        modelId?: string;
        requestId?: string;
        imagePreviewBase64?: string;
        /** TB-023: flag operazione con immagine. */
        hasImage?: boolean;
      }
    ): void => {
      const durationMs = meta?.durationMs ?? Date.now() - streamStartRef.current;
      const raw = streamBufferRef.current.getRaw();
      const tokenInfo = meta?.tokens ? ` · ${meta.tokens.total} token` : '';

      if (ok) {
        updateLog(entryId, {
          type: 'stream',
          status: 'done',
          msg: `Risposta ricevuta${tokenInfo} · ${(durationMs / 1000).toFixed(1)}s`,
          durationMs,
          detail: meta?.detail ?? raw,
          tokens: meta?.tokens,
          costUsd: meta?.costUsd,
          modelId: meta?.modelId,
          requestId: meta?.requestId,
          hasImage: meta?.imagePreviewBase64 ? true : undefined,
          imagePreviewBase64: meta?.imagePreviewBase64,
        });
      } else {
        updateLog(entryId, {
          type: 'stream',
          status: 'error',
          msg: meta?.errorMsg || "Errore durante l'elaborazione AI",
          durationMs,
          detail: meta?.detail ?? raw,
          costUsd: meta?.costUsd,
          modelId: meta?.modelId,
          requestId: meta?.requestId,
          hasImage: meta?.imagePreviewBase64 ? true : undefined,
          imagePreviewBase64: meta?.imagePreviewBase64,
        });
        logger.error('AI stream failed', {
          route,
          requestId: streamMetaRef.current.requestId,
          sessionId: streamMetaRef.current.sessionId,
          modelId: streamMetaRef.current.modelId,
          errorMsg: meta?.errorMsg,
        });
      }

      streamBufferRef.current.clear();
      streamEntryIdRef.current = null;
      lastCharCountRef.current = 0;
      setIsProcessing(false);
    },
    [updateLog, route]
  );

  const updateLogImagePreview = useCallback((id: string, imagePreviewBase64?: string): void => {
    updateLog(id, { hasImage: !!imagePreviewBase64, imagePreviewBase64 });
  }, [updateLog]);
  const info = useCallback(
    (msg: string, detail?: string, meta?: Partial<AILogEntry>): string => {
      if (meta?.requestId) streamMetaRef.current = { ...streamMetaRef.current, requestId: meta.requestId };
      const id = addLog({ ...createInfoEntry(msg, detail), ...meta });
      if (meta?.costUsd != null && meta.costUsd >= 0) setLastCostUsd(meta.costUsd);
      return id;
    },
    [addLog]
  );

  const success = useCallback(
    (msg: string, detail?: string, meta?: Partial<AILogEntry>): string => {
      if (meta?.requestId) streamMetaRef.current = { ...streamMetaRef.current, requestId: meta.requestId };
      const id = addLog({ ...createSuccessEntry(msg, detail), ...meta });
      if (meta?.costUsd != null && meta.costUsd >= 0) setLastCostUsd(meta.costUsd);
      return id;
    },
    [addLog]
  );

  const error = useCallback(
    (msg: string, detail?: string, meta?: Partial<AILogEntry>): string => {
      if (meta?.requestId) streamMetaRef.current = { ...streamMetaRef.current, requestId: meta.requestId };
      const id = addLog({ ...createErrorEntry(msg, detail), ...meta });
      if (meta?.costUsd != null && meta.costUsd >= 0) setLastCostUsd(meta.costUsd);
      logger.error('AI hook error', {
        route,
        requestId: streamMetaRef.current.requestId,
        sessionId: streamMetaRef.current.sessionId,
        modelId: streamMetaRef.current.modelId,
        msg,
        ...meta,
      });
      return id;
    },
    [addLog, route]
  );

  const tool = useCallback(
    (msg: string, durationMs?: number, detail?: string, meta?: Partial<AILogEntry>): string =>
      addLog({ ...createToolEntry(msg, durationMs, detail), ...meta }),
    [addLog]
  );

  const clear = useCallback((): void => {
    setLogs([]);
    setLastCostUsd(0);
  }, []);

  const totalCostUsd = logs.reduce((sum, e) => sum + (e.costUsd ?? 0), 0);
  const lastCostUsdLive = Math.max(lastCostUsd, Math.max(0, ...logs.map((e) => (e.costUsd ?? 0))));

  return {
    logs,
    isProcessing,
    totalCostUsd,
    lastCostUsd: lastCostUsdLive,
    startStream,
    appendStream,
    finalizeStream,
    info,
    success,
    error,
    updateLogImagePreview,
    tool,
    clear,
  };
}
