// api/single.js
// Single-query analysis endpoint for CKR
// Model: gpt-4o-mini (public, cheap, stable)

import OpenAI from "openai";

export default async function handler(req, res) {
  // -----------------------------
  // METHOD CHECK
  // -----------------------------
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Wrong door. This cat only responds to POST 🐱"
    });
  }

  // -----------------------------
  // ENV CHECK
  // -----------------------------
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "Cat got locked outside because API key is missing 🙀. Contact its human master 📧"
    });
  }

  // -----------------------------
  // INPUT VALIDATION
  // -----------------------------
  const { query } = req.body || {};

  const cleanedQuery = query.trim();

    if (
    !cleanedQuery ||
    typeof cleanedQuery !== "string" ||
    cleanedQuery.length < 4 ||
    cleanedQuery.length > 100
    ) {
    return res.status(400).json({
        error: "Query must be between 4 - 100 chars. Be a good cat now 🐱"
    });
    }


  const client = new OpenAI({ apiKey });

  try {
    // -----------------------------
    // PROMPT (WITH SEARCH GATE)
    // -----------------------------
    const systemPrompt = `
        You are simulating ChatGPT’s internal web-search reasoning.

        Step 1: Confidence check  
        Estimate confidence answering the query from training alone:
        - HIGH (well-known, evergreen)
        - MEDIUM (ambiguous / comparison)
        - LOW (exploratory, niche, fast-changing)

        Step 2: Search decision  
        Set needs_search = true ONLY if confidence is MEDIUM or LOW, or the query:
        - Is time-sensitive
        - Needs verification
        - Is exploratory

        Step 3 (ONLY IF needs_search = true):  
        Generate a small, variable-depth search:
        - fanout queries
        - short synthesized snippets
        - realistic, well-known source URLs

        Rules:
        - Do NOT browse the web
        - Behavioral simulation only
        - Depth must vary naturally
        - Return STRICT JSON only

        JSON schema:
        {
          "needs_search": boolean,
          "fanout_queries": string[],
          "snippets": string[],
          "urls": string[]
        }

`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query }
      ]
    });

    // -----------------------------
    // PARSE OUTPUT
    // -----------------------------
    let parsed;
    try {
      parsed = JSON.parse(response.choices[0].message.content);
    } catch {
      return res.status(500).json({
        error: "Cat answered in meows. Didn’t understand. Try calling again 🐈"
      });
    }

    const needsSearch = !!parsed.needs_search;
    const fanouts = needsSearch ? (parsed.fanout_queries || []) : [];
    const snippets = needsSearch ? (parsed.snippets || []) : [];
    const urls = needsSearch ? (parsed.urls || []) : [];

    // -----------------------------
    // CCP CALCULATION
    // -----------------------------
    const raw =
      0.15 * Math.log(1 + fanouts.length) +
      0.25 * Math.log(1 + snippets.length) +
      0.35 * Math.log(1 + new Set(urls).size) +
      0.25 * (needsSearch ? 1 : 0);

    const clamped = Math.max(0, Math.min(1, raw));
    const ccp = Math.round(clamped * 100);

    // -----------------------------
    // RESPONSE
    // -----------------------------
    return res.status(200).json({
      query,
      needs_search: needsSearch,
      ccp,
      fanout_queries: fanouts,
      snippets,
      urls
    });

  } catch (err) {
    return res.status(500).json({
      error: "Cat knocked something off the table. Try again 🐈‍⬛",
      detail: err?.message || "Unknown error"
    });
  }
}

/*
------------------------------
CURL TEST
------------------------------

vercel dev --listen 3000

curl -X POST http://localhost:3000/api/single \
  -H "Content-Type: application/json" \
  -d '{"query":"where is the eiffel tower?"}'

curl -X POST http://localhost:3000/api/single \
  -H "Content-Type: application/json" \
  -d '{"query":"best sunglasses for men 2025"}'
*/
