// api/bulk.js
// Bulk query analysis endpoint for CKR
// Model: gpt-4o-mini (search-reasoning simulation)

import OpenAI from "openai";

// -----------------------------
// UTIL: IST DATE (FIXED & SIMPLIFIED)
// - Correct IST
// - Full year
// - Format: dd-mm-yyyy
// -----------------------------
function getISTDate() {
  return new Date().toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).replace(/\//g, "-");
}


// -----------------------------
// UTIL: CSV ESCAPE (unchanged)
// -----------------------------
function csvEscape(value) {
  if (value == null) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

export default async function handler(req, res) {
  // -----------------------------
  // METHOD CHECK
  // -----------------------------
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only 🐱" });
  }

  // -----------------------------
  // ENV CHECK
  // -----------------------------
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res
      .status(500)
      .json({ error: "Missing API key 🙀. Contact mayankbishwas@gmail.com" });
  }

  const { queries } = req.body || {};

  // -----------------------------
  // INPUT VALIDATION
  // -----------------------------
  if (!Array.isArray(queries) || queries.length < 2 || queries.length > 5) {
    return res.status(400).json({
      error: "Provide 2–5 queries only 🐾"
    });
  }

  const client = new OpenAI({ apiKey });

  const rows = [];

  // -----------------------------
  // PROMPT (IMPROVED REALISM)
  // - Allows variable depth
  // - Allows uneven fanout/snippet/url counts
  // - Explicitly avoids fake precision
  // -----------------------------
  const systemPrompt = `
You are simulating ChatGPT’s internal web-search reasoning.

Step 1: Confidence check  
Estimate ChatGPT’s confidence answering the query from training alone:
- HIGH (well-known, evergreen)
- MEDIUM (some ambiguity / comparison)
- LOW (exploratory, niche, fast-changing)

Step 2: Search decision  
Set needs_search = true ONLY if confidence is MEDIUM or LOW, or if the query:
- Is time-sensitive
- Needs verification
- Is exploratory / research-oriented

Step 3 (ONLY IF needs_search = true):  
Scale depth based on confidence:
- HIGH → shallow search
- MEDIUM → moderate search
- LOW → deep, broad search

Generate variable (not fixed) numbers of:
- fanout queries
- snippets
- realistic, well-known source URLs

Rules:
- Do NOT browse the web
- Behavioral simulation only
- Output sizes must vary naturally
- Return STRICT JSON only

JSON schema:
{
  "needs_search": boolean,
  "fanout_queries": string[],
  "snippets": string[],
  "urls": string[]
}

`;

  // -----------------------------
  // PROCESS QUERIES (SEQUENTIAL)
  // -----------------------------
  for (let i = 0; i < queries.length; i++) {
    const q = String(queries[i]).trim();

    let row = {
      index: i + 1,
      query: q,
      ccp: "",
      fanouts: "",
      snippets: "",
      urls: "",
      searchDepth: "",
      error: "N/A" // CHANGE: default to N/A
    };

    try {
      if (q.length < 4 || q.length > 100) {
        throw new Error("Query length must be 4–100 chars");
      }

      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: q }
        ]
      });

      const parsed = JSON.parse(response.choices[0].message.content);

      const needsSearch = !!parsed.needs_search;

      // -----------------------------
      // CHANGE: Handle NO SEARCH case explicitly
      // -----------------------------
      if (!needsSearch) {
        const msg =
          "None. Because web search was NOT triggered to answer this query.";

        row.ccp = 0;
        row.fanouts = msg;
        row.snippets = msg;
        row.urls = msg;
        row.searchDepth = 0;

        rows.push(row);
        continue;
      }

      const fanouts = parsed.fanout_queries || [];
      const snippets = parsed.snippets || [];
      const urls = parsed.urls || [];

      // -----------------------------
      // CCP CALCULATION (NON-BINARY)
      // -----------------------------
      const fanoutScore = Math.min(fanouts.length / 6, 1);   // cap at 6
      const snippetScore = Math.min(snippets.length / 5, 1); // cap at 5
      const urlScore = Math.min(new Set(urls).size / 5, 1);  // cap at 5

      // weighted blend
      const raw =
        0.4 * fanoutScore +
        0.35 * snippetScore +
        0.25 * urlScore;

      // soft floor + ceiling
      const ccp = Math.round((0.15 + raw * 0.75) * 100);


      row.ccp = ccp;
      row.fanouts = fanouts.join("\n");
      row.snippets = snippets.join("\n");
      row.urls = urls.join("\n");
      row.searchDepth = fanouts.length + snippets.length + urls.length;

    } catch (err) {
      row.error = err.message || "Processing failed";
    }

    rows.push(row);
  }

  // -----------------------------
  // BUILD CSV (REMOVED AVG. CCP)
  // -----------------------------
  const istDate = getISTDate();

  const header = [
    "#",
    "Input_Query",
    "CCP (%)",
    "ChatGPT_Queries",
    "ChatGPT_Snippets",
    "ChatGPT_URLs",
    "Search_Depth",
    "Error (if any)"
  ];

  const csvLines = [];
  csvLines.push(header.map(csvEscape).join(","));

  rows.forEach(r => {
    csvLines.push(
      [
        r.index,
        r.query,
        r.ccp,
        r.fanouts,
        r.snippets,
        r.urls,
        r.searchDepth,
        r.error
      ].map(csvEscape).join(",")
    );
  });

  csvLines.push("");

  // -----------------------------
  // FOOTER / LEGENDS (UNCHANGED LOCATION)
  // -----------------------------
  csvLines.push(
    ["", "CCP = Likelihood a query triggers ChatGPT web-search reasoning", "", "", "", "", "", ""]
      .map(csvEscape).join(",")
  );

  csvLines.push(
    ["", "Search Depth = Number of ChatGPT Queries+Snippets+URLs", "", "", "", "", "", ""]
      .map(csvEscape).join(",")
  );

  csvLines.push(
  ["", `Generated with ♡ by ChatGPTKeyword.com on ${istDate}`, "", "", "", "", "", ""]
    .map(csvEscape).join(",")
  );


  const csv = csvLines.join("\n");

  // -----------------------------
  // RESPONSE (FILENAME FIXED)
  // -----------------------------
  res.setHeader("Content-Type", "text/csv; charset=utf-8");

  res.setHeader(
  "Content-Disposition",
  `attachment; filename="chatgptkwr_bulk_${istDate}.csv"`
  );


  return res.status(200).send(csv);
}
