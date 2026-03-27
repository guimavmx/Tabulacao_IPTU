import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { PDFDocument } from 'pdf-lib';
import { validarBoleto, formatarBoleto } from '@/lib/barcode';

export const maxDuration = 300;

const SYSTEM_PROMPT = `Você é um especialista em extração de dados de documentos de IPTU brasileiros.
Analise o PDF fornecido e extraia as informações de TODOS os boletos/guias de IPTU encontrados.
Retorne APENAS um array de objetos JSON, sem markdown, sem explicações, sem texto extra.
Exemplo do formato esperado:
[
  {
    "nome_documento": "nome do arquivo ou título da guia",
    "spe": "nome da SPE ou empresa proprietária",
    "inscricao_cadastral": "número de inscrição cadastral do imóvel",
    "endereco": "endereço completo do imóvel",
    "validade": "data de validade do boleto/guia (formato DD/MM/AAAA)",
    "valor_principal": "valor principal do IPTU (apenas números e vírgula, ex: 1.234,56)",
    "multa": "valor de multa (apenas números e vírgula, ex: 0,00 — retorne '0,00' se o campo existir mas for zero)",
    "juros": "valor de juros (apenas números e vírgula, ex: 0,00 — retorne '0,00' se o campo existir mas for zero)",
    "descontos": "valor de descontos (apenas números e vírgula, ex: 0,00 — retorne '0,00' se o campo existir mas for zero)",
    "total_a_pagar": "valor total a pagar (apenas números e vírgula, ex: 1.234,56)",
    "duam": "número DUAM ou número do documento de arrecadação",
    "codigo_barras": "código de barras no padrão FEBRABAN para guias (ex: 86850000001-8 09590161209-6 22025061301-5 61000139400-8)",
    "comentario": ""
  }
]
Regras:
- Se um campo não for encontrado, use string vazia ""
- Não invente dados
- Preserve formatação original de valores monetários e datas
- O JSON deve ser estritamente um Array [] no nível superior, mesmo se contiver apenas 1 item.
- Para "codigo_barras", extraia apenas os 48 dígitos do código da guia (ignorando textos extras como "WEB" ou datas soltas fora do código). Formate-o separando em 4 blocos com espaços e hifens se possível.`;

function parseAiResponse(text: string): Record<string, string>[] {
  if (!text.startsWith('[')) text = '[' + text;
  let clean = text.replace(/```json|```/g, '').trim();
  clean = clean.replace(/\}\s*\{/g, '},{');
  if (clean.startsWith('[') && !clean.endsWith(']')) clean += ']';

  // Sanitiza caracteres de controle literais dentro de strings JSON (frequente no GPT)
  clean = clean.replace(/"(?:[^"\\]|\\.)*"/g, match =>
    match
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  );

  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/\[[\s\S]*\]/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }
    const objs = clean.match(/\{[\s\S]*?\}/g);
    if (objs && objs.length > 0) return objs.map(o => JSON.parse(o));
    throw new Error('Resposta inválida da IA: ' + clean.slice(0, 200));
  }
}

function applyBarcodeValidation(parsed: Record<string, string>[], filename: string) {
  parsed.forEach(p => {
    p.nome_documento = filename;
    if (p.codigo_barras) {
      const digitos = p.codigo_barras.replace(/\D/g, '');
      if (digitos.length >= 48) {
        const d48 = digitos.substring(0, 48);
        p.codigo_barras = validarBoleto(d48) ? formatarBoleto(d48) : '';
      } else {
        p.codigo_barras = '';
      }
    }
  });
  return parsed;
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key');
  const provider = req.headers.get('x-api-provider') || 'anthropic';

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key não fornecida' }), { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return new Response(JSON.stringify({ error: 'Erro ao ler form data' }), { status: 400 });
  }

  const file = formData.get('pdf') as File | null;
  if (!file) {
    return new Response(JSON.stringify({ error: 'Nenhum PDF enviado' }), { status: 400 });
  }

  const filename = file.name;
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      controller.enqueue(encoder.encode(': connected\n\n'));

      try {
        const pdfDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
        const totalPages = pdfDoc.getPageCount();
        const chunkSize = 15;

        // ── OpenAI: Files API (upload) + Responses API (qualidade) + paralelo ───
        if (provider === 'openai' || provider === 'openai-mini') {
          const client = new OpenAI({ apiKey });
          const modelName = provider === 'openai-mini' ? 'gpt-4o-mini' : 'gpt-4o';

          // Retry com backoff exponencial para absorver rate limits (429)
          async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 2000): Promise<T> {
            for (let attempt = 0; attempt <= retries; attempt++) {
              try {
                return await fn();
              } catch (err: unknown) {
                const isRateLimit = err instanceof Error && err.message.includes('429');
                if (isRateLimit && attempt < retries) {
                  await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt)));
                } else {
                  throw err;
                }
              }
            }
            throw new Error('Max retries exceeded');
          }

          // 1. Gerar todos os chunks de PDF
          const chunks: { end: number; buf: Buffer }[] = [];
          for (let i = 0; i < totalPages; i += chunkSize) {
            const chunkEnd = Math.min(i + chunkSize, totalPages);
            const newPdf = await PDFDocument.create();
            const copied = await newPdf.copyPages(
              pdfDoc,
              Array.from({ length: chunkEnd - i }, (_, idx) => i + idx)
            );
            copied.forEach(p => newPdf.addPage(p));
            chunks.push({ end: chunkEnd, buf: Buffer.from(await newPdf.save()) });
          }

          // 2. Upload de todos os chunks em paralelo para a Files API
          //    A Responses API exige file_id — base64 inline retorna 500
          const fileIds = await Promise.all(
            chunks.map(({ buf }) =>
              withRetry(() =>
                client.files.create({
                  file: new File([new Uint8Array(buf)], filename, { type: 'application/pdf' }),
                  purpose: 'user_data',
                }).then(f => f.id)
              )
            )
          );

          // 3. Inferência em paralelo via Responses API usando file_id
          let completed = 0;
          const openaiUsage = { input: 0, output: 0 };
          await Promise.all(
            fileIds.map(async (fileId) => {
              try {
                const response = await withRetry(() =>
                  client.responses.create({
                    model: modelName,
                    temperature: 0,
                    instructions: SYSTEM_PROMPT,
                    max_output_tokens: 16000,
                    input: [{
                      role: 'user',
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      content: [
                        { type: 'input_file', file_id: fileId } as any,
                        {
                          type: 'input_text',
                          text: `Extraia os dados de TODOS os IPTUs deste documento. Retome APENAS um array JSON válido iniciando com '['. Nome do arquivo: ${filename}`,
                        },
                      ],
                    }],
                  })
                );

                openaiUsage.input += response.usage?.input_tokens ?? 0;
                openaiUsage.output += response.usage?.output_tokens ?? 0;

                const text = response.output_text || '';
                let parsed = parseAiResponse(text);
                if (!Array.isArray(parsed)) parsed = [parsed];
                applyBarcodeValidation(parsed, filename);

                completed++;
                send({ type: 'chunk', data: parsed, progress: completed / chunks.length });
              } finally {
                await client.files.del(fileId).catch(() => {});
              }
            })
          );
          send({ type: 'usage', input: openaiUsage.input, output: openaiUsage.output, cacheRead: 0, cacheCreated: 0 });

        // ── Anthropic / Gemini ────────────────────────────────────────────────
        } else {
          // Instancia o cliente uma única vez fora do loop
          const anthropicClient = provider === 'anthropic' ? new Anthropic({ apiKey }) : null;
          const geminiClient = provider !== 'anthropic'
            ? new GoogleGenerativeAI(apiKey).getGenerativeModel({
                model: provider === 'gemini-3' ? 'gemini-2.0-flash' : 'gemini-2.5-flash',
                systemInstruction: SYSTEM_PROMPT,
                generationConfig: {
                  temperature: 0,
                  maxOutputTokens: 16000,
                  responseMimeType: 'application/json',
                },
              })
            : null;

          // Gera todos os chunks de PDF antecipadamente
          const pdfChunks: { base64: string; end: number }[] = [];
          for (let i = 0; i < totalPages; i += chunkSize) {
            const chunkEnd = Math.min(i + chunkSize, totalPages);
            const newPdf = await PDFDocument.create();
            const copied = await newPdf.copyPages(
              pdfDoc,
              Array.from({ length: chunkEnd - i }, (_, idx) => i + idx)
            );
            copied.forEach(page => newPdf.addPage(page));
            pdfChunks.push({ base64: Buffer.from(await newPdf.save()).toString('base64'), end: chunkEnd });
          }

          let completed = 0;

          // Anthropic: processa todos os chunks em paralelo
          if (provider === 'anthropic') {
            const anthropicUsage = { input: 0, output: 0, cacheRead: 0, cacheCreated: 0 };
            await Promise.all(
              pdfChunks.map(async ({ base64 }) => {
                const message = await anthropicClient!.messages.create({
                  model: 'claude-sonnet-4-20250514',
                  max_tokens: 16000,
                  system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
                  messages: [{
                    role: 'user',
                    content: [
                      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
                      { type: 'text', text: `Extraia os dados de TODOS os IPTUs deste documento. Retorne APENAS um array JSON válido. Nome do arquivo: ${filename}` }
                    ]
                  }, {
                    role: 'assistant',
                    content: '['
                  }]
                });
                anthropicUsage.input += message.usage.input_tokens;
                anthropicUsage.output += message.usage.output_tokens;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const u = message.usage as any;
                anthropicUsage.cacheRead += u.cache_read_input_tokens ?? 0;
                anthropicUsage.cacheCreated += u.cache_creation_input_tokens ?? 0;
                const text = message.content.map(b => ('text' in b ? b.text : '')).join('').trim();
                let parsed = parseAiResponse(text);
                if (!Array.isArray(parsed)) parsed = [parsed];
                applyBarcodeValidation(parsed, filename);
                completed++;
                send({ type: 'chunk', data: parsed, progress: completed / pdfChunks.length });
              })
            );
            send({ type: 'usage', ...anthropicUsage });

          // Gemini: mantém sequencial (não tem rate limit generoso o suficiente para paralelo)
          } else {
            const geminiUsage = { input: 0, output: 0, cacheRead: 0, cacheCreated: 0 };
            for (const { base64, end } of pdfChunks) {
              const result = await geminiClient!.generateContent([
                `Extraia os dados de TODOS os IPTUs deste documento. Retome APENAS um array JSON válido iniciando obrigatoriamente com o caractere '['. Nome do arquivo: ${filename}`,
                { inlineData: { data: base64, mimeType: 'application/pdf' } }
              ]);
              const meta = result.response.usageMetadata;
              geminiUsage.input += meta?.promptTokenCount ?? 0;
              geminiUsage.output += meta?.candidatesTokenCount ?? 0;
              const text = result.response.text().trim();
              let parsed = parseAiResponse(text);
              if (!Array.isArray(parsed)) parsed = [parsed];
              applyBarcodeValidation(parsed, filename);
              completed++;
              send({ type: 'chunk', data: parsed, progress: end / totalPages });
            }
            send({ type: 'usage', ...geminiUsage });
          }
        }

        send({ type: 'done' });
      } catch (err: unknown) {
        send({ type: 'error', error: err instanceof Error ? err.message : 'Erro desconhecido' });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
