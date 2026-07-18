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
const MAX_DETAIL_CHARS = 2048;
const STORAGE_KEY = 'pq_ai_logs:v1';

interface PersistedLogs {
  version: 1;
  entries: AILogEntry[];
}

function truncateDetail(detail?: string): string | undefined {
  if (!detail) return undefined;
  if (detail.length <= MAX_DETAIL_CHARS) return detail;
  return `${detail.slice(0, MAX_DETAIL_CHARS)}…`;
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
      detail: truncateDetail(e.detail),
      tokens: e.tokens && typeof e.tokens.total === 'number' ? e.tokens : undefined,
    }));
  } catch {
    return [];
  }
}

function safePersist(entries: AILogEntry[]): void {
  try {
    const payload: PersistedLogs = {
      version: 1,
      entries: entries.slice(-100).map((e) => ({
        ...e,
        detail: truncateDetail(e.detail),
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
    }
  ): void;
  info(msg: string, detail?: string, meta?: Partial<AILogEntry>): string;
  success(msg: string, detail?: string, meta?: Partial<AILogEntry>): string;
  error(msg: string, detail?: string, meta?: Partial<AILogEntry>): string;
  tool(msg: string, durationMs?: number, detail?: string): string;
  clear(): void;
}

export function useAILogs(route?: string): UseAILogsReturn {
  const [logs, setLogs] = useState<AILogEntry[]>(safeRestore);
  const [isProcessing, setIsProcessing] = useState(false);

  const streamBufferRef = useRef(new StreamBuffer());
  const streamEntryIdRef = useRef<string | null>(null);
  const streamStartRef = useRef<number>(0);
  const streamMetaRef = useRef<Partial<AILogEntry>>({});
  const lastCharCountRef = useRef<number>(0);

  useEffect(() => {
    safePersist(logs);
  }, [logs]);

  const addLog = useCallback((entry: AILogEntry): string => {
    const safe: AILogEntry = { ...entry, detail: truncateDetail(entry.detail) };
    setLogs((prev) => {
      const next = [...prev, safe];
      if (next.length > MAX_LOG_ENTRIES) next.shift();
      return next;
    });
    return safe.id;
  }, []);

  const updateLog = useCallback((id: string, patch: Partial<AILogEntry>): void => {
    setLogs((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, ...patch, detail: truncateDetail(patch.detail ?? l.detail) } : l
      )
    );
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
          detail: truncateDetail(meta?.detail ?? raw.slice(0, MAX_DETAIL_CHARS)),
          tokens: meta?.tokens,
        });
      } else {
        updateLog(entryId, {
          type: 'stream',
          status: 'error',
          msg: meta?.errorMsg || "Errore durante l'elaborazione AI",
          durationMs,
          detail: truncateDetail(meta?.detail ?? raw.slice(0, MAX_DETAIL_CHARS)),
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

  const info = useCallback(
    (msg: string, detail?: string, meta?: Partial<AILogEntry>): string => {
      if (meta?.requestId) streamMetaRef.current = { ...streamMetaRef.current, requestId: meta.requestId };
      return addLog({ ...createInfoEntry(msg, detail), ...meta });
    },
    [addLog]
  );

  const success = useCallback(
    (msg: string, detail?: string, meta?: Partial<AILogEntry>): string => {
      if (meta?.requestId) streamMetaRef.current = { ...streamMetaRef.current, requestId: meta.requestId };
      return addLog({ ...createSuccessEntry(msg, detail), ...meta });
    },
    [addLog]
  );

  const error = useCallback(
    (msg: string, detail?: string, meta?: Partial<AILogEntry>): string => {
      if (meta?.requestId) streamMetaRef.current = { ...streamMetaRef.current, requestId: meta.requestId };
      const id = addLog({ ...createErrorEntry(msg, detail), ...meta });
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
    (msg: string, durationMs?: number, detail?: string): string =>
      addLog(createToolEntry(msg, durationMs, detail)),
    [addLog]
  );

  const clear = useCallback((): void => {
    setLogs([]);
  }, []);

  return {
    logs,
    isProcessing,
    startStream,
    appendStream,
    finalizeStream,
    info,
    success,
    error,
    tool,
    clear,
  };
}
