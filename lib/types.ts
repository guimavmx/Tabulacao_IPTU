export type ApiProvider = 'anthropic' | 'gemini-3' | 'gemini-2.5' | 'openai' | 'openai-mini';

export interface IptuRecord {
  nome_documento: string;
  spe: string;
  inscricao_cadastral: string;
  endereco: string;
  validade: string;
  valor_principal: string;
  multa: string;
  juros: string;
  descontos: string;
  total_a_pagar: string;
  duam: string;
  codigo_barras: string;
  comentario: string;
  _status: 'ok' | 'error';
  _error?: string;
}

export const COLS: { key: keyof IptuRecord; label: string; cls: string }[] = [
  { key: 'nome_documento',      label: 'Nome do Documento',   cls: '' },
  { key: 'spe',                 label: 'SPE',                 cls: 'spe' },
  { key: 'inscricao_cadastral', label: 'Inscrição Cadastral', cls: 'mono' },
  { key: 'endereco',            label: 'Endereço',            cls: '' },
  { key: 'validade',            label: 'Validade',            cls: 'mono' },
  { key: 'valor_principal',     label: 'Valor Principal',     cls: 'val' },
  { key: 'multa',               label: 'Multa',               cls: 'val' },
  { key: 'juros',               label: 'Juros',               cls: 'val' },
  { key: 'descontos',           label: 'Descontos',           cls: 'val' },
  { key: 'total_a_pagar',       label: 'Total a Pagar',       cls: 'val' },
  { key: 'duam',                label: 'DUAM',                cls: 'mono' },
  { key: 'codigo_barras',       label: 'Código de Barras',    cls: 'mono' },
  { key: 'comentario',          label: 'Comentário',          cls: '' },
];
