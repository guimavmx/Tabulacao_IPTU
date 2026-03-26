import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key');
  const provider = req.headers.get('x-api-provider') || 'anthropic';

  if (!apiKey) {
    return NextResponse.json({ error: 'API key não fornecida' }, { status: 400 });
  }

  try {
    if (provider === 'anthropic') {
      const client = new Anthropic({ apiKey });
      await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'hi' }],
      });
    } else if (provider === 'openai' || provider === 'openai-mini') {
      const client = new OpenAI({ apiKey });
      await client.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'hi' }],
      });
    } else {
      const genAI = new GoogleGenerativeAI(apiKey);
      const modelName = provider === 'gemini-3' ? 'gemini-3-flash-preview' : 'gemini-2.5-flash';
      const model = genAI.getGenerativeModel({ model: modelName });
      await model.generateContent('hi');
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ success: false, error: message }, { status: 401 });
  }
}
