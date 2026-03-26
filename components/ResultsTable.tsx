'use client';

import { IptuRecord, COLS } from '@/lib/types';

interface Props {
  results: IptuRecord[];
  onUpdateRow: (i: number, value: string) => void;
}

function esc(s: string | undefined): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function ResultsTable({ results, onUpdateRow }: Props) {
  if (!results.length) {
    return (
      <div className="table-card">
        <div className="table-header">
          <div className="card-title" style={{ margin: 0 }}>Resultados</div>
        </div>
        <div className="empty">
          <span className="empty-icon">🗂</span>
          <p>Faça upload dos PDFs e clique em <strong>Extrair dados</strong> para iniciar a tabulação.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="table-card">
      <div className="table-header">
        <div className="card-title" style={{ margin: 0 }}>Resultados</div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>#</th>
              {COLS.map(c => <th key={c.key}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {results.map((row, i) => (
              <tr key={i}>
                <td className="rn">{i + 1}</td>
                {row._status === 'error' ? (
                  <>
                    <td>
                      <span className="tag-err">ERRO</span>{' '}
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{row.nome_documento}</span>
                    </td>
                    <td
                      colSpan={COLS.length - 1}
                      style={{ color: 'var(--error)', fontSize: 11, fontFamily: 'var(--font-ibm-mono), monospace' }}
                    >
                      {row._error}
                    </td>
                  </>
                ) : (
                  COLS.map(c => {
                    const v = row[c.key as keyof IptuRecord] as string || '';
                    if (c.key === 'comentario') {
                      return (
                        <td key={c.key} className={c.cls}>
                          <input
                            className="edit-c"
                            type="text"
                            defaultValue={v}
                            placeholder="—"
                            onChange={e => onUpdateRow(i, e.target.value)}
                          />
                        </td>
                      );
                    }
                    return (
                      <td key={c.key} className={c.cls} title={esc(v)}>
                        {v ? v : <span style={{ color: 'var(--muted)' }}>—</span>}
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
