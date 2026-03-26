const express = require('express');
const multer = require('multer');
const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { PDFDocument } = require('pdf-lib');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Inicio Validador FEBRABAN ---
function validarModulo(block, esperado, isMod11) {
  if (isMod11) {
    let sum = 0, mult = 2;
    for (let i = block.length - 1; i >= 0; i--) {
        sum += parseInt(block[i]) * mult;
        mult = mult > 8 ? 2 : mult + 1;
    }
    let rem = sum % 11;
    let dac = 11 - rem;
    if (dac === 10 || dac === 11) dac = 0;
    return dac === esperado;
  } else {
    let sum = 0, mult = 2;
    for (let i = block.length - 1; i >= 0; i--) {
        let val = parseInt(block[i]) * mult;
        if (val > 9) val = Math.floor(val / 10) + (val % 10);
        sum += val;
        mult = mult === 2 ? 1 : 2;
    }
    let rem = sum % 10;
    let dac = 10 - rem;
    if (dac === 10) dac = 0;
    return dac === esperado;
  }
}

function validarBoleto(codigo) {
    if (!codigo || codigo.length !== 48) return false;
    if (codigo[0] !== '8') return true; 

    let isMod11 = (codigo[2] === '8' || codigo[2] === '9');
    
    let isValid = true;
    for (let i = 0; i < 4; i++) {
       let block = codigo.substring(i*12, i*12+11);
       let digito = parseInt(codigo[i*12+11]);
       if (!validarModulo(block, digito, isMod11)) {
           isValid = false;
           break;
       }
    }
    return isValid;
}
// --- Fim Validador FEBRABAN ---

// Extract IPTU data from a single PDF
app.post('/api/extract', upload.single('pdf'), async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  const provider = req.headers['x-api-provider'] || 'anthropic';
  
  if (!apiKey) return res.status(400).json({ error: 'API key não fornecida' });
  if (!req.file) return res.status(400).json({ error: 'Nenhum PDF enviado' });

  const filename = req.file.originalname;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  // Envia um byte vazio/comentário só para confirmar que a conexão abriu imediatamente
  res.write(': connected\n\n'); 

  try {
    const pdfDoc = await PDFDocument.load(req.file.buffer, { ignoreEncryption: true });
    const totalPages = pdfDoc.getPageCount();
    const chunkSize = 15; // Max 15 pages per chunk to avoid AI output token limits (Unterminated JSON string)

    for (let i = 0; i < totalPages; i += chunkSize) {
      const chunkEnd = Math.min(i + chunkSize, totalPages);
      console.log(`Processando páginas ${i + 1} a ${chunkEnd} de ${totalPages} do arquivo ${filename}...`);
      
      const newPdf = await PDFDocument.create();
      const pagesToCopy = Array.from({ length: chunkEnd - i }, (_, idx) => i + idx);
      const copiedPages = await newPdf.copyPages(pdfDoc, pagesToCopy);
      copiedPages.forEach((page) => newPdf.addPage(page));
      const newPdfBytes = await newPdf.save();
      const base64Chunk = Buffer.from(newPdfBytes).toString('base64');

      const systemPrompt = `Você é um especialista em extração de dados de documentos de IPTU brasileiros.
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

      let text = '';
      if (provider === 'anthropic') {
        const client = new Anthropic({ apiKey });
        const message = await client.messages.create({
          model: 'claude-sonnet-4-20250514', // Mantendo o modelo atual configurado
          max_tokens: 4096, // Aumentado para suportar retorno maior de array
          system: systemPrompt,
          messages: [{
            role: 'user',
            content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Chunk } },
              { type: 'text', text: `Extraia os dados de TODOS os IPTUs deste documento. Retorne APENAS um array JSON válido. Nome do arquivo: ${filename}` }
            ]
          }, {
            role: 'assistant',
            content: '['
          }]
        });
        text = message.content.map(b => b.text || '').join('').trim();
      } else {
        const genAI = new GoogleGenerativeAI(apiKey);
        const modelName = provider === 'gemini-3' ? 'gemini-3-flash-preview' : 'gemini-2.5-flash';
        const model = genAI.getGenerativeModel({ 
            model: modelName,
            systemInstruction: systemPrompt 
        });
        
        const prompt = `Extraia os dados de TODOS os IPTUs deste documento. Retome APENAS um array JSON válido iniciando obrigatoriamente com o caractere '['. Nome do arquivo: ${filename}`;
        const pdfPart = {
            inlineData: {
                data: base64Chunk,
                mimeType: "application/pdf"
            }
        };
        const result = await model.generateContent([prompt, pdfPart]);
        text = result.response.text().trim();
      }
      
      // Como forçamos o início com '[', precisamos repor no texto
      if (!text.startsWith('[')) {
        text = '[' + text;
      }
      
      let clean = text.replace(/```json|```/g, '').trim();

      // Caso o Claude esqueça da vírgula entre objetos
      clean = clean.replace(/\}\s*\{/g, '},{');
      
      // Adiciona colchete de fechamento se estiver faltando
      if (clean.startsWith('[') && !clean.endsWith(']')) {
         clean += ']';
      }

      let parsed;
      try {
        parsed = JSON.parse(clean);
      } catch (e) {
        const match = clean.match(/\[[\s\S]*\]/);
        if (match) {
          try {
            parsed = JSON.parse(match[0]);
          } catch (e2) {
            throw new Error('Falha ao processar array JSON consertado: ' + e2.message);
          }
        } else {
          // Último fallback para pegar objetos e tentar converter para array manualmente
          const objs = clean.match(/\{[\s\S]*?\}/g);
          if (objs && objs.length > 0) {
            parsed = objs.map(o => JSON.parse(o));
          } else {
            throw new Error('Resposta inválida da IA: ' + clean.slice(0, 200));
          }
        }
      }

      if (!Array.isArray(parsed)) {
        parsed = [parsed];
      }

      parsed.forEach(p => {
        p.nome_documento = filename; // Substitui sempre pelo nome real do arquivo enviado, ignorando a IA
        if (p.codigo_barras) {
          let digitos = p.codigo_barras.replace(/\D/g, '');
          if (digitos.length >= 48) {
            digitos = digitos.substring(0, 48);
            
            // Valida matematicamente o código de barras extraído
            if (validarBoleto(digitos)) {
                p.codigo_barras = digitos.substring(0, 11) + '-' + digitos.substring(11, 12) + ' ' +
                                  digitos.substring(12, 23) + '-' + digitos.substring(23, 24) + ' ' +
                                  digitos.substring(24, 35) + '-' + digitos.substring(35, 36) + ' ' +
                                  digitos.substring(36, 47) + '-' + digitos.substring(47, 48);
            } else {
                p.codigo_barras = "";
            }
          } else {
             p.codigo_barras = "";
          }
        }
      });
      
      // Envia os resultados deste chunk para o frontend (Streaming)
      const progress = chunkEnd / totalPages;
      res.write(`data: ${JSON.stringify({ type: 'chunk', data: parsed, progress: progress })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();

  } catch (err) {
    console.error('Erro na extração:', err);
    res.write(`data: ${JSON.stringify({ type: 'error', error: err.message || 'Erro desconhecido' })}\n\n`);
    res.end();
  }
});

// Test API key
app.post('/api/test-key', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  const provider = req.headers['x-api-provider'] || 'anthropic';
  
  if (!apiKey) return res.status(400).json({ error: 'API key não fornecida' });
  
  try {
    if (provider === 'anthropic') {
      const client = new Anthropic({ apiKey });
      await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'hi' }]
      });
    } else {
      const genAI = new GoogleGenerativeAI(apiKey);
      
      try {
        const result = await genAI.listModels();
        console.log("\n--- MODELOS DISPONÍVEIS PARA SUA CHAVE ---");
        result.models.forEach((m) => {
          console.log(`ID: ${m.name} | Métodos: ${m.supportedGenerationMethods.join(', ')}`);
        });
        console.log("------------------------------------------\n");
      } catch (e) {
        console.error("Erro ao listar modelos:", e);
      }

      const modelName = provider === 'gemini-3' ? 'gemini-3-flash-preview' : 'gemini-2.5-flash';
      const model = genAI.getGenerativeModel({ model: modelName });
      await model.generateContent("hi");
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(401).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3131;
app.listen(PORT, () => {
  console.log(`\n✅ IPTU Extractor rodando em: http://localhost:${PORT}\n`);
});
