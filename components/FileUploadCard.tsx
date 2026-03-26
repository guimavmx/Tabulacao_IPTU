'use client';

import { useRef, DragEvent, ChangeEvent } from 'react';

interface FileState { status: 'processing' | 'done' | 'error' | ''; }

interface Props {
  files: File[];
  fileStates: Record<number, FileState['status']>;
  busy: boolean;
  hasResults: boolean;
  onAddFiles: (files: FileList | File[]) => void;
  onRemoveFile: (i: number) => void;
  onExtract: () => void;
  onExport: () => void;
  onClear: () => void;
}

export default function FileUploadCard({
  files, fileStates, busy, hasResults,
  onAddFiles, onRemoveFile, onExtract, onExport, onClear
}: Props) {
  const dropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    dropRef.current?.classList.add('drag-over');
  }

  function onDragLeave() {
    dropRef.current?.classList.remove('drag-over');
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dropRef.current?.classList.remove('drag-over');
    onAddFiles(e.dataTransfer.files);
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) onAddFiles(e.target.files);
  }

  const stateIcons: Record<string, string> = {
    processing: '⏳', done: '✅', error: '❌', '': '📄'
  };

  return (
    <div className="card">
      <div className="card-title">Upload de PDFs</div>

      <div
        ref={dropRef}
        className="drop-zone"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          multiple
          style={{ display: 'none' }}
          onChange={onChange}
        />
        <span className="drop-icon">📄</span>
        <div className="drop-label">Arraste PDFs aqui</div>
        <div className="drop-sub">ou clique · múltiplos arquivos</div>
      </div>

      {files.length > 0 && (
        <div className="file-list">
          {files.map((f, i) => (
            <div key={i} className={`file-item ${fileStates[i] || ''}`}>
              <span>{stateIcons[fileStates[i] || '']}</span>
              <span className="file-item-name">{f.name}</span>
              <span className="file-item-size">{(f.size / 1024).toFixed(0)} KB</span>
              {!busy && (
                <button className="file-item-del" onClick={() => onRemoveFile(i)}>×</button>
              )}
            </div>
          ))}
        </div>
      )}

      <button
        className="btn btn-primary"
        disabled={files.length === 0 || busy}
        onClick={onExtract}
      >
        {busy ? <><span className="spinner" />Extraindo…</> : 'Extrair dados'}
      </button>

      <button
        className="btn btn-export"
        disabled={!hasResults}
        onClick={onExport}
      >
        ⬇ Exportar Excel
      </button>

      <button
        className="btn btn-ghost"
        disabled={files.length === 0 && !hasResults}
        onClick={onClear}
      >
        Limpar tudo
      </button>
    </div>
  );
}
