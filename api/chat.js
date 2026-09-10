import Groq from 'groq-sdk';
import { buildSystemPrompt } from './_lib/promptBuilder.js';
import { getClientIp, checkRateLimit } from './_lib/rateLimiter.js';

/**
 * Fallback grounded generator for local testing or when GROQ_API_KEY is not configured
 */
function getSimulatedGroundedResponse(userMessage) {
  const msg = (userMessage || '').toLowerCase();

  if (msg.includes('notice') || msg.includes('availability') || msg.includes('join')) {
    return 'My current notice period is 60 Days. I am available to transition smoothly into suitable opportunities within that timeframe.';
  }

  if (msg.includes('relocat') || msg.includes('move') || msg.includes('location') || msg.includes('remote')) {
    return 'I am based in Bengaluru, Karnataka, India, and I am not open to physical relocation at this time. However, I am very enthusiastic about remote opportunities or Bengaluru-based roles.';
  }

  if (msg.includes('salary') || msg.includes('compensation') || msg.includes('ctc') || msg.includes('rate') || msg.includes('money')) {
    return 'My compensation expectations depend on the specific scope, seniority, and impact of the role. Please feel free to email me directly at [ankeeth.v@gmail.com](mailto:ankeeth.v@gmail.com) so we can discuss the details.';
  }

  if (msg.includes('weather') || msg.includes('president') || msg.includes('recipe') || msg.includes('movie') || msg.includes('joke')) {
    return "I'd love to chat, but I'm focused specifically on sharing Ankeeth's professional background in data, systems, and AI. Feel free to ask about my experience, skills, or projects!";
  }

  if (msg.includes('skill') || msg.includes('tech') || msg.includes('stack') || msg.includes('tools')) {
    return 'My strongest skills include SQL, Power BI, Advanced Excel, dashboard design, and AI-assisted workflows. I specialize in combining analytical problem-solving with client-facing stakeholder management.';
  }

  if (msg.includes('project') || msg.includes('work') || msg.includes('portfolio') || msg.includes('kaseya')) {
    return 'At Kaseya, I analyzed customer resolution-time data and introduced a standardized process that reduced repeated-issue volume by 85%. You can also explore my projects like Business360 and AdHoc Analysis on my [GitHub Profile](https://github.com/AnkeethV).';
  }

  return 'I am a client-focused problem solver and data & AI specialist with deep experience in stakeholder communication and systems engineering. Feel free to explore my experience below or email me directly at [ankeeth.v@gmail.com](mailto:ankeeth.v@gmail.com).';
}

/**
 * Vercel Serverless Function: POST /api/chat
 * Streams token responses grounded in DB content
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // 1. Rate Limiting Check
  const clientIp = getClientIp(req);
  const rateStatus = checkRateLimit(clientIp);

  if (!rateStatus.allowed) {
    return res.status(429).json({
      error: `Rate limit reached. You can send up to 15 messages per 10 minutes. Please try again in ${rateStatus.retryAfter}s, or email Ankeeth directly at ankeeth.v@gmail.com.`
    });
  }

  try {
    const { message, history = [] } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message text is required.' });
    }

    const cleanUserMessage = message.trim();

    // 2. Build live grounded system prompt from database
    const systemPrompt = await buildSystemPrompt();

    // 3. Assemble chat message history (up to last 6 messages)
    const sanitizedHistory = Array.isArray(history)
      ? history.slice(-6).map(h => ({
          role: h.role === 'assistant' ? 'assistant' : 'user',
          content: String(h.content || '').slice(0, 1000)
        }))
      : [];

    const messages = [
      { role: 'system', content: systemPrompt },
      ...sanitizedHistory,
      { role: 'user', content: cleanUserMessage }
    ];

    // 4. Setup Server-Sent Events (SSE) Streaming Response
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const groqApiKey = process.env.GROQ_API_KEY;

    if (groqApiKey && groqApiKey !== 'your_groq_api_key_here' && groqApiKey.startsWith('gsk_')) {
      // Live Groq Streaming
      const groq = new Groq({ apiKey: groqApiKey });

      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.3,
        max_tokens: 350,
        stream: true,
      });

      for await (const chunk of completion) {
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
        }
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      // Zero-config simulated streaming engine
      const simulatedText = getSimulatedGroundedResponse(cleanUserMessage);
      const words = simulatedText.split(' ');

      for (let i = 0; i < words.length; i++) {
        const token = (i === 0 ? '' : ' ') + words[i];
        res.write(`data: ${JSON.stringify({ content: token })}\n\n`);
      }

      res.write('data: [DONE]\n\n');
      res.end();
    }

  } catch (err) {
    console.error('Error in /api/chat handler:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to process chat message', details: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Stream error occurred' })}\n\n`);
      res.end();
    }
  }
}
