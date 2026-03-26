'use client';

import { useState, useCallback } from 'react';
import ApiConfigCard from '@/components/ApiConfigCard';
import FileUploadCard from '@/components/FileUploadCard';
import ProgressArea from '@/components/ProgressArea';
import StatsCards from '@/components/StatsCards';
import ResultsTable from '@/components/ResultsTable';
import { IptuRecord, ApiProvider } from '@/lib/types';

interface LogEntry { msg: string; type: 'ok' | 'err' | 'hi' | ''; }

export default function HomePage() {
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<ApiProvider>('anthropic');
  const [apiStatus, setApiStatus] = useState<{ msg: string; type: 'ok' | 'err' | 'loading' | '' }>({ msg: '', type: '' });
  const [files, setFiles] = useState<File[]>([]);
  const [fileStates, setFileStates] = useState<Record<number, 'processing' | 'done' | 'error' | ''>>({});
  const [results, setResults] = useState<IptuRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ text: '', pct: 0, active: false });
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((msg: string, type: LogEntry['type'] = '') => {
    setLogs(prev => [...prev, { msg, type }]);
  }, []);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    setFiles(prev => {
      const next = [...prev];
      for (const f of Array.from(incoming)) {
        if (f.type === 'application/pdf' && !next.find(x => x.name === f.name)) next.push(f);
      }
      return next;
    });
  }, []);

  const removeFile = useCallback((i: number) => {
    setFiles(prev => prev.filter((_, idx) => idx !== i));
  }, []);

  const testKey = useCallback(async () => {
    const clean = apiKey.replace(/[^\x20-\x7E]/g, '').trim();
    if (!clean) { setApiStatus({ msg: 'Insira uma API key', type: 'err' }); return; }
    setApiStatus({ msg: 'Testando…', type: 'loading' });
    try {
      const r = await fetch('/api/test-key', {
        method: 'POST',
        headers: { 'x-api-key': clean, 'x-api-provider': provider },
      });
      const d = await r.json();
      if (d.success) setApiStatus({ msg: '✓ Conectado com sucesso', type: 'ok' });
      else setApiStatus({ msg: '✗ ' + d.error, type: 'err' });
    } catch (e: unknown) {
      setApiStatus({ msg: '✗ Erro: ' + (e instanceof Error ? e.message : String(e)), type: 'err' });
    }
  }, [apiKey, provider]);

  const updateRow = useCallback((i: number, value: string) => {
    setResults(prev => {
      const next = [...prev];
      next[i] = { ...next[i], comentario: value };
      return next;
    });
  }, []);

  const runExtraction = useCallback(async () => {
    const clean = apiKey.replace(/[^\x20-\x7E]/g, '').trim();
    if (!clean) { alert('Insira sua API key.'); return; }
    if (!files.length) return;

    setBusy(true);
    setResults([]);
    setFileStates({});
    setLogs([]);
    setProgress({ text: 'Iniciando…', pct: 0, active: true });
    addLog(`Iniciando extração de ${files.length} arquivo(s)…`, 'hi');

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setProgress({ text: `[${i + 1}/${files.length}] ${f.name}`, pct: Math.round((i / files.length) * 100), active: true });
      setFileStates(prev => ({ ...prev, [i]: 'processing' }));
      addLog(`Enviando: ${f.name}`, '');

      try {
        const fd = new FormData();
        fd.append('pdf', f);
        const r = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'x-api-key': clean, 'x-api-provider': provider },
          body: fd,
        });

        const reader = r.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop()!;

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = JSON.parse(line.substring(6));

            if (payload.type === 'chunk') {
              const arr: IptuRecord[] = Array.isArray(payload.data) ? payload.data : [payload.data];
              setResults(prev => [...prev, ...arr.map(item => ({ ...item, _status: 'ok' as const }))]);
              const pct = Math.round(payload.progress * 100);
              setProgress({ text: `Analisando páginas... ${pct}%`, pct, active: true });
              addLog(`  ↳ Lote processado (+${arr.length} guias)`, 'ok');
            } else if (payload.type === 'error') {
              setResults(prev => [...prev, { nome_documento: f.name, _status: 'error', _error: payload.error } as IptuRecord]);
              setFileStates(prev => ({ ...prev, [i]: 'error' }));
              addLog(`  ✗ ${payload.error}`, 'err');
            } else if (payload.type === 'done') {
              setFileStates(prev => ({ ...prev, [i]: 'done' }));
              addLog(`  ✓ Arquivo totalmente extraído`, 'ok');
            }
          }
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setResults(prev => [...prev, { nome_documento: f.name, _status: 'error', _error: msg } as IptuRecord]);
        setFileStates(prev => ({ ...prev, [i]: 'error' }));
        addLog(`  ✗ Erro de rede: ${msg}`, 'err');
      }
    }

    setProgress({ text: 'Concluído', pct: 100, active: true });
    addLog('─── Extração finalizada ───', 'hi');
    setBusy(false);
  }, [apiKey, provider, files, addLog]);

  const exportExcel = useCallback(async () => {
    if (!results.length) return;
    const XLSX = await import('xlsx');
    const COLS_KEYS = [
      { key: 'nome_documento', label: 'Nome do Documento' },
      { key: 'spe', label: 'SPE' },
      { key: 'inscricao_cadastral', label: 'Inscrição Cadastral' },
      { key: 'endereco', label: 'Endereço' },
      { key: 'validade', label: 'Validade' },
      { key: 'valor_principal', label: 'Valor Principal' },
      { key: 'total_a_pagar', label: 'Total a Pagar' },
      { key: 'duam', label: 'DUAM' },
      { key: 'codigo_barras', label: 'Código de Barras' },
      { key: 'comentario', label: 'Comentário' },
    ];
    const headers = COLS_KEYS.map(c => c.label);
    const rows = results.map(r => {
      if (r._status === 'error') return [r.nome_documento, 'ERRO', '', '', '', '', '', '', '', r._error || ''];
      return COLS_KEYS.map(c => (r as unknown as Record<string, string>)[c.key] || '');
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [30, 25, 22, 40, 14, 16, 16, 20, 50, 30].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, 'IPTU');
    XLSX.writeFile(wb, `IPTU_Extraido_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }, [results]);

  const clearAll = useCallback(() => {
    setFiles([]);
    setResults([]);
    setFileStates({});
    setLogs([]);
    setProgress({ text: '', pct: 0, active: false });
  }, []);

  return (
    <>
      {/* Hero Banner */}
      <div className="hero">
        <div className="hero-tag">Ferramenta de Extração</div>
        <h1>Extração de IPTU</h1>
        <p className="hero-sub">
          Processamento automatizado de guias de IPTU via Inteligência Artificial.
          Suporte a Claude (Anthropic) e Gemini (Google).
        </p>
        <span className="hero-badge">v1.1</span>
      </div>

      {/* Content */}
      <div className="content-area">
        <div className="layout">
          {/* Left column */}
          <div>
            <ApiConfigCard
              apiKey={apiKey}
              provider={provider}
              apiStatus={apiStatus}
              onApiKeyChange={setApiKey}
              onProviderChange={setProvider}
              onTestKey={testKey}
            />
            <FileUploadCard
              files={files}
              fileStates={fileStates}
              busy={busy}
              hasResults={results.length > 0}
              onAddFiles={addFiles}
              onRemoveFile={removeFile}
              onExtract={runExtraction}
              onExport={exportExcel}
              onClear={clearAll}
            />
            {progress.active && (
              <div className="card" style={{ marginBottom: 0 }}>
                <div className="card-title">Progresso</div>
                <ProgressArea
                  progressText={progress.text}
                  progressPct={progress.pct}
                  logs={logs}
                />
              </div>
            )}
          </div>

          {/* Right column */}
          <div>
            <StatsCards results={results} />
            <ResultsTable results={results} onUpdateRow={updateRow} />
          </div>
        </div>
      </div>
    </>
  );
}
