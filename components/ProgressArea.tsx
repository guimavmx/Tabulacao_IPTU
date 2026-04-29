'use client';

import { useEffect, useRef } from 'react';

interface LogEntry { msg: string; type: 'ok' | 'err' | 'hi' | ''; }
interface TokenUsage { input: number; output: number; cacheRead: number; cacheCreated: number; }

interface Props {
  progressText: string;
  progressPct: number;
  logs: LogEntry[];
  tokenUsage?: TokenUsage | null;
}

function fmt(n: number) { return n.toLocaleString('pt-BR'); }

export default function ProgressArea({ progressText, progressPct, logs, tokenUsage }: Props) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  return (
    <div className="progress-area">
      <div className="progress-header">
        <span>{progressText}</span>
        <span>{progressPct}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progressPct}%` }} />
      </div>
      <div className="log" ref={logRef}>
        {logs.map((entry, i) => (
          <div key={i} className={`log-line ${entry.type}`}>{entry.msg}</div>
        ))}
      </div>
      {tokenUsage && (
        <div className="token-usage">
          <span className="token-usage-title">Tokens consumidos</span>
          <br />
          Entrada: <strong>{fmt(tokenUsage.input)}</strong>
          {'  ·  '}
          Saída: <strong>{fmt(tokenUsage.output)}</strong>
          {'  ·  '}
          Total: <strong>{fmt(tokenUsage.input + tokenUsage.output)}</strong>
          {(tokenUsage.cacheRead > 0 || tokenUsage.cacheCreated > 0) && (
            <>
              <br />
              Cache lido: <strong className="token-cache-read">{fmt(tokenUsage.cacheRead)}</strong>
              {'  ·  '}
              Cache criado: <strong className="token-cache-created">{fmt(tokenUsage.cacheCreated)}</strong>
            </>
          )}
        </div>
      )}
    </div>
  );
}
