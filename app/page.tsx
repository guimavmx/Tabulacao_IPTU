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

    const { PDFDocument } = await import('pdf-lib');
    const PAGES_PER_CHUNK = 10;

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setFileStates(prev => ({ ...prev, [i]: 'processing' }));
      addLog(`Enviando: ${f.name}`, '');

      try {
        // Divide o PDF no browser antes de enviar (evita erro 413 no Vercel)
        const fileBuffer = await f.arrayBuffer();
        const pdfDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
        const totalPages = pdfDoc.getPageCount();

        const pageChunks: Uint8Array[] = [];
        for (let p = 0; p < totalPages; p += PAGES_PER_CHUNK) {
          const end = Math.min(p + PAGES_PER_CHUNK, totalPages);
          const newPdf = await PDFDocument.create();
          const pages = await newPdf.copyPages(pdfDoc, Array.from({ length: end - p }, (_, j) => p + j));
          pages.forEach(page => newPdf.addPage(page));
          pageChunks.push(await newPdf.save());
        }

        if (pageChunks.length > 1) {
          addLog(`  PDF dividido em ${pageChunks.length} lotes (${totalPages} págs.)`, '');
        }

        setProgress({
          text: `[${i + 1}/${files.length}] ${f.name}${pageChunks.length > 1 ? ` — ${pageChunks.length} lotes em paralelo` : ''}`,
          pct: Math.round((i / files.length) * 100),
          active: true,
        });

        let completedChunks = 0;

        const chunkResults = await Promise.all(
          pageChunks.map(async (chunkBuf, c) => {
            const fd = new FormData();
            fd.append('pdf', new File([chunkBuf], f.name, { type: 'application/pdf' }));

            const r = await fetch('/api/extract', {
              method: 'POST',
              headers: { 'x-api-key': clean, 'x-api-provider': provider },
              body: fd,
            });

            if (!r.ok) {
              const errText = await r.text().catch(() => `HTTP ${r.status}`);
              return { error: true, msg: `Servidor retornou ${r.status}: ${errText}` };
            }

            const reader = r.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let chunksReceived = 0;
            let doneReceived = false;

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
                  chunksReceived++;
                  const arr: IptuRecord[] = Array.isArray(payload.data) ? payload.data : [payload.data];
                  setResults(prev => [...prev, ...arr.map(item => ({ ...item, _status: 'ok' as const }))]);
                  addLog(`  ↳ Lote ${c + 1} processado (+${arr.length} guias)`, 'ok');
                } else if (payload.type === 'error') {
                  return { error: true, msg: payload.error };
                } else if (payload.type === 'done') {
                  doneReceived = true;
                }
              }
            }

            if (!doneReceived && chunksReceived === 0) {
              return { error: true, msg: 'Stream encerrado sem resposta — provável timeout do servidor (limite do plano Vercel Hobby: 10s)' };
            }

            completedChunks++;
            setProgress({
              text: `[${i + 1}/${files.length}] ${f.name} — ${completedChunks}/${pageChunks.length} lotes concluídos`,
              pct: Math.round(((i + completedChunks / pageChunks.length) / files.length) * 100),
              active: true,
            });

            return { error: false, msg: '' };
          })
        );

        const firstError = chunkResults.find(r => r.error);
        const fileError = !!firstError;
        if (fileError) {
          setResults(prev => [...prev, { nome_documento: f.name, _status: 'error', _error: firstError!.msg } as IptuRecord]);
          addLog(`  ✗ ${firstError!.msg}`, 'err');
        }

        setFileStates(prev => ({ ...prev, [i]: fileError ? 'error' : 'done' }));
        if (!fileError) addLog(`  ✓ Arquivo totalmente extraído`, 'ok');

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
