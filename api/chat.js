import Groq from 'groq-sdk';
import { buildSystemPrompt } from './_lib/promptBuilder.js';
import { getClientIp, checkRateLimit } from './_lib/rateLimiter.js';

/**
 * Fallback grounded generator for local testing or when Groq API encounters any issue
 */
function getSimulatedGroundedResponse(userMessage) {
  const msg = (userMessage || '').toLowerCase();

  if (msg.includes('notice') || msg.includes('availability') || msg.includes('join') || msg.includes('available')) {
    return 'My current notice period is 60 Days. I am available to transition smoothly into suitable opportunities within that timeframe.';
  }

  if (msg.includes('relocat') || msg.includes('move') || msg.includes('location') || msg.includes('remote') || msg.includes('bengaluru') || msg.includes('bangalore') || msg.includes('mumbai') || msg.includes('delhi')) {
    return 'I am based in Bengaluru, Karnataka, India, and I am not open to physical relocation at this time. However, I am very enthusiastic about remote opportunities or Bengaluru-based roles.';
  }

  if (msg.includes('salary') || msg.includes('compensation') || msg.includes('ctc') || msg.includes('rate') || msg.includes('money') || msg.includes('pay')) {
    return 'My compensation expectations depend on the specific scope, seniority, and impact of the role. Please feel free to email me directly at [ankeeth.v@gmail.com](mailto:ankeeth.v@gmail.com) so we can discuss the details.';
  }

  if (msg.includes('role') || msg.includes('position') || msg.includes('looking for') || msg.includes('job') || msg.includes('opportunity') || msg.includes('opportunities') || msg.includes('hire')) {
    return 'I am looking for roles in Data Analytics, Business Intelligence, Systems Analysis, or Solutions Engineering where I can leverage my experience in SQL, Power BI, automated data workflows, and stakeholder management.';
  }

  if (msg.includes('skill') || msg.includes('tech') || msg.includes('stack') || msg.includes('tools') || msg.includes('strength') || msg.includes('power bi') || msg.includes('sql') || msg.includes('excel')) {
    return 'My strongest skills include SQL (complex queries, window functions), Power BI (DAX, executive dashboards), Advanced Excel, and AI-assisted workflows. I specialize in combining analytical problem-solving with client-facing stakeholder management.';
  }

  if (msg.includes('project') || msg.includes('work') || msg.includes('portfolio') || msg.includes('kaseya') || msg.includes('challeng') || msg.includes('solved') || msg.includes('business360') || msg.includes('adhoc') || msg.includes('impact')) {
    return 'At Kaseya, I analyzed customer resolution-time data across high-frequency support categories and introduced a standardized process that reduced repeated-issue volume by 85%. You can also explore my projects like Business360 and AdHoc Analysis on my [GitHub Profile](https://github.com/AnkeethV).';
  }

  if (msg.includes('resume') || msg.includes('cv') || msg.includes('download') || msg.includes('pdf')) {
    return 'You can view and download my complete resume here: [View My Resume](/resume.pdf).';
  }

  if (msg.includes('contact') || msg.includes('email') || msg.includes('linkedin') || msg.includes('reach') || msg.includes('connect')) {
    return 'You can contact me directly at [ankeeth.v@gmail.com](mailto:ankeeth.v@gmail.com) or connect with me on [LinkedIn](https://www.linkedin.com/in/ankeeth-v-).';
  }

  if (msg.includes('weather') || msg.includes('president') || msg.includes('recipe') || msg.includes('movie') || msg.includes('joke') || msg.includes('sport') || msg.includes('tokyo') || msg.includes('music')) {
    return "I'd love to chat, but I'm focused specifically on sharing Ankeeth's professional background in data, systems, and AI. Feel free to ask about my experience, skills, or projects!";
  }

  return 'I am a client-focused problem solver and data & AI specialist with deep experience in stakeholder communication and systems engineering. Feel free to explore my experience below or email me directly at [ankeeth.v@gmail.com](mailto:ankeeth.v@gmail.com).';
}

/**
 * Vercel Serverless Function: POST /api/chat
 * Streams token responses grounded in DB content
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
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

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {}
  }
  const { message, history = [] } = body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message text is required.' });
  }

  const cleanUserMessage = message.trim();

  // Setup Server-Sent Events (SSE) Streaming Response
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  let streamedAnyToken = false;

  try {
    // 2. Build live grounded system prompt from database or profile fallback
    let systemPrompt = '';
    try {
      systemPrompt = await buildSystemPrompt();
    } catch (promptErr) {
      console.warn('buildSystemPrompt error, using fallback:', promptErr.message);
    }

    // 3. Assemble chat message history (up to last 6 messages)
    const sanitizedHistory = Array.isArray(history)
      ? history.slice(-6).map(h => ({
          role: h.role === 'assistant' ? 'assistant' : 'user',
          content: String(h.content || '').slice(0, 1000)
        }))
      : [];

    const messages = [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      ...sanitizedHistory,
      { role: 'user', content: cleanUserMessage }
    ];

    const rawGroqKey = process.env.GROQ_API_KEY;
    const groqApiKey = rawGroqKey ? rawGroqKey.trim().replace(/^["']|["']$/g, '') : '';

    if (groqApiKey && groqApiKey !== 'your_groq_api_key_here' && groqApiKey.startsWith('gsk_')) {
      try {
        const groq = new Groq({ apiKey: groqApiKey });
        let completion = null;

        try {
          completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages,
            temperature: 0.3,
            max_tokens: 350,
            stream: true,
          });
        } catch (modelErr) {
          console.warn('Groq 70b model failed, attempting 8b instant fallback:', modelErr.message);
          completion = await groq.chat.completions.create({
            model: 'llama-3.1-8b-instant',
            messages,
            temperature: 0.3,
            max_tokens: 350,
            stream: true,
          });
        }

        if (completion) {
          for await (const chunk of completion) {
            const delta = chunk.choices[0]?.delta?.content || '';
            if (delta) {
              streamedAnyToken = true;
              res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
            }
          }

          if (streamedAnyToken) {
            res.write('data: [DONE]\n\n');
            return res.end();
          }
        }
      } catch (groqErr) {
        console.warn('Groq API error in /api/chat, falling back to simulated grounded engine:', groqErr.message);
      }
    }

    // 4. Fallback Grounded Engine: If Groq was not configured, threw an error, or returned empty tokens
    if (!streamedAnyToken) {
      const simulatedText = getSimulatedGroundedResponse(cleanUserMessage);
      const words = simulatedText.split(' ');

      for (let i = 0; i < words.length; i++) {
        const token = (i === 0 ? '' : ' ') + words[i];
        res.write(`data: ${JSON.stringify({ content: token })}\n\n`);
      }

      res.write('data: [DONE]\n\n');
      return res.end();
    }
  } catch (err) {
    console.error('Fatal error in /api/chat handler:', err);
    if (!streamedAnyToken) {
      try {
        const fallbackText = getSimulatedGroundedResponse(cleanUserMessage);
        res.write(`data: ${JSON.stringify({ content: fallbackText })}\n\n`);
        res.write('data: [DONE]\n\n');
      } catch (_) {}
    }
    return res.end();
  }
}
