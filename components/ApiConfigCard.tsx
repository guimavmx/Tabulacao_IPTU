'use client';

import { ApiProvider } from '@/lib/types';

interface Props {
  apiKey: string;
  provider: ApiProvider;
  apiStatus: { msg: string; type: 'ok' | 'err' | 'loading' | '' };
  onApiKeyChange: (v: string) => void;
  onProviderChange: (v: ApiProvider) => void;
  onTestKey: () => void;
}

const PLACEHOLDERS: Record<ApiProvider, string> = {
  anthropic:    'sk-ant-api03-...',
  'openai':     'sk-proj-...',
  'openai-mini':'sk-proj-...',
  'gemini-3':   'AIzaSy...',
  'gemini-2.5': 'AIzaSy...',
};

export default function ApiConfigCard({
  apiKey, provider, apiStatus, onApiKeyChange, onProviderChange, onTestKey
}: Props) {
  return (
    <div className="card">
      <div className="card-title">Configuração de IA</div>

      <div style={{ marginBottom: 12 }}>
        <label>Provedor</label>
        <select
          value={provider}
          onChange={e => onProviderChange(e.target.value as ApiProvider)}
          style={{ marginBottom: 12 }}
        >
          <optgroup label="Anthropic">
            <option value="anthropic">Claude Sonnet 4 (Anthropic)</option>
          </optgroup>
          <optgroup label="OpenAI">
            <option value="openai">GPT-4o (OpenAI)</option>
            <option value="openai-mini">GPT-4o Mini (OpenAI)</option>
          </optgroup>
          <optgroup label="Google">
            <option value="gemini-3">Gemini 3 Flash Preview (Google)</option>
            <option value="gemini-2.5">Gemini 2.5 Flash (Google)</option>
          </optgroup>
        </select>

        <label>Chave de API</label>
        <input
          type="password"
          placeholder={PLACEHOLDERS[provider]}
          value={apiKey}
          onChange={e => onApiKeyChange(e.target.value)}
          autoComplete="off"
        />
      </div>

      <button className="btn-sm" onClick={onTestKey}>
        Testar conexão
      </button>

      {apiStatus.msg && (
        <div className={`api-status api-status-${apiStatus.type}`}>
          {apiStatus.msg}
        </div>
      )}
    </div>
  );
}
