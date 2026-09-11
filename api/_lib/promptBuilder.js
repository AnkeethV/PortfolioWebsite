import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { query } from './db.js';
import { parseProfile } from './parseProfile.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Builds the grounded system prompt dynamically from live database records
 * with an instant fallback to profile.md when the database is unavailable.
 */
export async function buildSystemPrompt() {
  let p = {};
  let experiences = '';
  let projects = '';
  let skillsByCategory = { technical: [], tools: [], soft: [] };
  let faqs = '';

  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (connectionString) {
    try {
      // 1. Fetch live profile data from DB
      const pRes = await query('SELECT * FROM personal_info LIMIT 1');
      p = pRes.rows[0] || {};

      const eRes = await query('SELECT company, title, start_date, end_date, bullets FROM experience ORDER BY sort_order ASC, id ASC');
      experiences = eRes.rows.map(e => {
        const bullets = typeof e.bullets === 'string' ? JSON.parse(e.bullets) : (e.bullets || []);
        return `* ${e.company} — ${e.title} (${e.start_date} – ${e.end_date})\n${bullets.map(b => `  - ${b}`).join('\n')}`;
      }).join('\n\n');

      const projRes = await query('SELECT name, description, tech_tags, external_link FROM projects ORDER BY sort_order ASC, id ASC');
      projects = projRes.rows.map(pr => {
        const tags = typeof pr.tech_tags === 'string' ? JSON.parse(pr.tech_tags) : (pr.tech_tags || []);
        return `* ${pr.name}: ${pr.description} (Tech: ${tags.join(', ')}) [Link: ${pr.external_link || 'N/A'}]`;
      }).join('\n');

      const sRes = await query('SELECT category, value FROM skills ORDER BY category, sort_order ASC, id ASC');
      sRes.rows.forEach(s => {
        const cat = s.category ? s.category.toLowerCase() : 'technical';
        if (skillsByCategory[cat]) skillsByCategory[cat].push(s.value);
      });

      const fRes = await query('SELECT question, answer FROM faq ORDER BY sort_order ASC, id ASC');
      faqs = fRes.rows.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n');
    } catch (err) {
      console.warn('DB query in buildSystemPrompt failed, falling back to profile.md:', err.message);
    }
  }

  // Fallback: If DB data is empty or unavailable, parse profile.md directly
  if (!p.name || !experiences) {
    try {
      const candidatePaths = [
        path.resolve(__dirname, '../../profile.md'),
        path.resolve(__dirname, '../profile.md'),
        path.resolve(process.cwd(), 'profile.md'),
        path.resolve(process.cwd(), 'api/profile.md')
      ];

      for (const candidate of candidatePaths) {
        if (fs.existsSync(candidate)) {
          const parsed = parseProfile(candidate);
          p = parsed.personalInfo || {};

          experiences = (parsed.experience || []).map(e => {
            const bullets = Array.isArray(e.bullets) ? e.bullets : [];
            return `* ${e.company} — ${e.title} (${e.start_date} – ${e.end_date})\n${bullets.map(b => `  - ${b}`).join('\n')}`;
          }).join('\n\n');

          projects = (parsed.projects || []).map(pr => {
            const tags = Array.isArray(pr.tech_tags) ? pr.tech_tags : [];
            return `* ${pr.name}: ${pr.description} (Tech: ${tags.join(', ')}) [Link: ${pr.external_link || 'N/A'}]`;
          }).join('\n');

          skillsByCategory = { technical: [], tools: [], soft: [] };
          (parsed.skills || []).forEach(s => {
            const cat = s.category ? s.category.toLowerCase() : 'technical';
            if (skillsByCategory[cat]) skillsByCategory[cat].push(s.value);
          });

          faqs = (parsed.faq || []).map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n');
          break;
        }
      }
    } catch (fallbackErr) {
      console.warn('Fallback profile.md parse in buildSystemPrompt failed:', fallbackErr.message);
    }
  }

  // Ensure grounded content is never empty
  if (!p.name) {
    p = {
      name: 'Ankeeth V',
      title: 'Senior Engineer - Infrastructure Management Services at Kaseya',
      location: 'Bengaluru, Karnataka, India',
      email: 'ankeeth.v@gmail.com',
      linkedin_url: 'https://www.linkedin.com/in/ankeeth-v-',
      github_url: 'https://github.com/AnkeethV',
      bio: 'Client-focused problem solver and data & AI specialist with deep experience in stakeholder communication and systems engineering.'
    };
  }

  if (!experiences) {
    experiences = `* Kaseya — Senior Engineer - Infrastructure Management Services (May 2022 – Present)
  - Spearheaded analysis of customer resolution-time data across high-frequency support categories, identifying recurring operational friction points.
  - Formulated and executed a standardized incident routing and triage framework, reducing repeated-issue volume by 85% and elevating first-contact resolution rates.
  - Partnered directly with enterprise clients to diagnose complex system anomalies, translating high-friction technical issues into clear analytical problem statements.
  - Monitored real-time system performance and incident metrics, providing cross-functional teams with actionable operational insights that prevented SLA breaches.
  - Authored comprehensive process documentation and troubleshooting runbooks adopted team-wide, cutting new engineer onboarding time significantly.`;
  }

  if (!projects) {
    projects = `* Business360: Integrated executive business intelligence dashboard consolidating sales, finance, and supply chain KPIs across multi-region operations. (Tech: SQL, Power BI, Advanced Excel, DAX) [Link: https://github.com/AnkeethV]
* AdHoc Analysis: Automated SQL-driven analytics repository generating rapid, ad-hoc business intelligence insights for operational decision-making. (Tech: SQL, PostgreSQL, Data Modeling) [Link: https://github.com/AnkeethV]`;
  }

  if (!skillsByCategory.technical.length) {
    skillsByCategory = {
      technical: ['SQL', 'Data Analytics', 'Business Intelligence', 'Data Modeling', 'Database Systems', 'Systems Engineering', 'AI-Assisted Workflows'],
      tools: ['Power BI', 'Advanced Excel', 'PostgreSQL', 'Git', 'Vercel', 'Jira', 'ServiceNow'],
      soft: ['Stakeholder Communication', 'Problem Solving', 'Incident Management', 'Cross-Functional Collaboration', 'Process Optimization']
    };
  }

  if (!faqs) {
    faqs = `Q: What is your notice period?
A: 60 Days.

Q: Are you open to relocation?
A: I am based in Bengaluru, Karnataka, India and not open to physical relocation at this time. However, I am open to remote opportunities or local roles.

Q: What are your salary expectations?
A: My compensation expectations are competitive and depend on the scope, seniority, and impact of the role. Please feel free to email me directly at [ankeeth.v@gmail.com](mailto:ankeeth.v@gmail.com) to discuss.`;
  }

  const prompt = `
You are the AI version of ${p.name || 'Ankeeth V'}, speaking directly to recruiters, hiring managers, and clients who visit your portfolio website.

### CORE IDENTITY & PERSONA
- Always speak in the **first person** ("I", "my", "me") as ${p.name || 'Ankeeth V'}.
- Tone: Warm, confident, humble, articulate, and professional.
- Current Title: ${p.title || 'Senior Engineer - Infrastructure Management Services at Kaseya'}.
- Location: ${p.location || 'Bengaluru, Karnataka, India'}.
- Bio: ${p.bio || ''}

### STRICT LENGTH CONSTRAINT
- Keep answers concise: **2 to 4 short sentences per response** maximum.
- Be direct, informative, and impactful without fluff.

### GROUNDING & ZERO-HALLUCINATION RULES (FIRM)
1. Answer **ONLY** using the facts provided in the "PORTFOLIO GROUNDING DATA" section below.
2. NEVER invent credentials, past employers, degrees, certifications, or commitments not explicitly stated below.
3. If asked about something unknowable or not in the data (e.g., college graduation year, specific unlisted technologies), state honestly that it is not in your current profile and invite them to reach out directly via email.

### LINK FORMATTING RULES (MANDATORY)
- Whenever referencing contact methods or links, ALWAYS format them as valid Markdown links:
  - Email: [${p.email || 'ankeeth.v@gmail.com'}](mailto:${p.email || 'ankeeth.v@gmail.com'})
  - LinkedIn: [LinkedIn Profile](${p.linkedin_url || 'https://www.linkedin.com/in/ankeeth-v-'})
  - GitHub: [GitHub Profile](${p.github_url || 'https://github.com/AnkeethV'})
  - Resume: [View My Resume](/resume.pdf)
- Never output raw unformatted URLs or plain text emails.

### SENSITIVE & NEGOTIATION QUESTIONS RULES
- **Notice Period / Availability:** Answer directly and helpfully with "60 Days" (as specified in my FAQ).
- **Relocation:** Answer diplomatically that I am based in Bengaluru and not open to relocating, but open to remote opportunities or local roles.
- **Salary / Compensation:** State diplomatically that compensation depends on the role's scope and impact, and invite the visitor to discuss details directly with me at [${p.email || 'ankeeth.v@gmail.com'}](mailto:${p.email || 'ankeeth.v@gmail.com'}).
- **Working for Free / Free Trials:** State professionally that I do not take unpaid work, but I am happy to discuss paid freelance, consulting, or full-time opportunities.

### OFF-TOPIC QUESTIONS (LAST RESORT)
- If the visitor asks about the weather, general trivia, politics, or personal matters unrelated to my professional career, politely decline and steer the conversation back to my experience in Data, Analytics, Systems, and AI.

---
### PORTFOLIO GROUNDING DATA

#### 1. Experience:
${experiences}

#### 2. Projects:
${projects}

#### 3. Skills:
- Technical: ${skillsByCategory.technical.join(', ')}
- Tools & Platforms: ${skillsByCategory.tools.join(', ')}
- Soft Skills: ${skillsByCategory.soft.join(', ')}

#### 4. Pre-written FAQs:
${faqs}
`.trim();

  return prompt;
}

export default buildSystemPrompt;
