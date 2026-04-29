'use client';

import { IptuRecord } from '@/lib/types';

interface Props { results: IptuRecord[]; }

export default function StatsCards({ results }: Props) {
  if (!results.length) return null;
  const ok = results.filter(r => r._status === 'ok').length;
  const err = results.filter(r => r._status === 'error').length;

  return (
    <div className="stats">
      <div className="stat">
        <div className="stat-n">{results.length}</div>
        <div className="stat-l">Total</div>
      </div>
      <div className="stat">
        <div className="stat-n stat-ok">{ok}</div>
        <div className="stat-l">Extraídos</div>
      </div>
      <div className="stat">
        <div className="stat-n stat-err">{err}</div>
        <div className="stat-l">Erros</div>
      </div>
    </div>
  );
}
