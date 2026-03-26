'use client';

import { useEffect, useRef } from 'react';

interface LogEntry { msg: string; type: 'ok' | 'err' | 'hi' | ''; }

interface Props {
  progressText: string;
  progressPct: number;
  logs: LogEntry[];
}

export default function ProgressArea({ progressText, progressPct, logs }: Props) {
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
    </div>
  );
}
