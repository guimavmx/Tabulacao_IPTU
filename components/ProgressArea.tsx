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
        <div style={{
          marginTop: 10,
          padding: '8px 12px',
          borderRadius: 6,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          fontSize: 11,
          lineHeight: '1.7',
          fontFamily: 'var(--font-ibm-mono), monospace',
          color: 'var(--muted)',
        }}>
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Tokens consumidos</span>
          <br />
          Entrada: <strong style={{ color: '#e2e8f0' }}>{fmt(tokenUsage.input)}</strong>
          {'  ·  '}
          Saída: <strong style={{ color: '#e2e8f0' }}>{fmt(tokenUsage.output)}</strong>
          {'  ·  '}
          Total: <strong style={{ color: '#e2e8f0' }}>{fmt(tokenUsage.input + tokenUsage.output)}</strong>
          {(tokenUsage.cacheRead > 0 || tokenUsage.cacheCreated > 0) && (
            <>
              <br />
              Cache lido: <strong style={{ color: '#22c55e' }}>{fmt(tokenUsage.cacheRead)}</strong>
              {'  ·  '}
              Cache criado: <strong style={{ color: '#60a5fa' }}>{fmt(tokenUsage.cacheCreated)}</strong>
            </>
          )}
        </div>
      )}
    </div>
  );
}
