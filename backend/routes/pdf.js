const express = require('express');
const router = express.Router();
const pdfParse = require('pdf-parse');
const OpenAI = require('openai');
const pool = require('../db');

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

// POST /api/projects/:id/parse-pdf
// Body: { pdf_url: "https://...supabase.co/.../file.pdf" }
router.post('/:id/parse-pdf', async (req, res) => {
  const client = await pool.connect();

  try {
    const { pdf_url } = req.body;
    if (!pdf_url) {
      client.release();
      return res.status(400).json({ error: 'No pdf_url provided' });
    }

    // Validate project exists
    const projectResult = await client.query(
      'SELECT * FROM projects WHERE id = $1',
      [req.params.id]
    );
    if (projectResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Project not found' });
    }

    // Download PDF from Supabase URL
    const pdfResponse = await fetch(pdf_url);
    if (!pdfResponse.ok) {
      client.release();
      return res.status(400).json({ error: 'Failed to download PDF from URL' });
    }
    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

    // Extract text from PDF
    const pdfData = await pdfParse(pdfBuffer);
    const pdfText = pdfData.text;

    console.log('--- PDF Text Length:', pdfText.length, 'characters ---');
    console.log('--- Calling LLM... ---');
    const startTime = Date.now();

    // Send extracted text to OpenRouter for structuring
    const response = await openrouter.chat.completions.create({
      model: 'google/gemini-3-flash-preview',
      max_tokens: 16384,
      messages: [
        {
          role: 'user',
          content: `You are parsing a knitting/crochet pattern. Here is the text extracted from the PDF:\n\n${pdfText}\n\nExtract the pattern as structured JSON.

CRITICAL RULES FOR COUNTING ROWS:
1. Every individual row the user must work is its own entry — not just unique row labels.
2. When the pattern says "Repeat rows X and Y until you have N rows total" or "Repeat row X, N times", you MUST EXPAND this into N individual row entries. For example, "Repeat rows 2 and 3 until you have 11 rows" on a size that ends with 11 rows means output 9 more rows (rows 4, 5, 6, 7, 8, 9, 10, 11, 12, alternating the instructions from rows 2 and 3).
3. If the pattern has multiple sizes (Small/Medium/Large), use the LARGEST size's counts to expand repeats.
4. "position" is the GLOBAL 1-based index across the ENTIRE pattern. Row 1 of the first section is position 1, the last row of the last section is position N where N = total_rows.
5. total_rows MUST equal the sum of all rows[] arrays across all sections. Count them before finalizing.
6. row_number is the per-section row number (1, 2, 3...). It is required and must never be null. If a row is part of a repeat, give it the next sequential number within that section.
7. Include EVERY section (setup, body, sleeves, edging, finishing rows, etc.) that has row-by-row instructions.

Format:
{
  "total_yards": <number or null>,
  "total_rows": <integer>,
  "yarn_weight": <integer 0-7 or null — standard yarn weight scale: 0=Lace, 1=Super Fine/Fingering, 2=Fine/Sport, 3=Light/DK, 4=Medium/Worsted, 5=Bulky, 6=Super Bulky, 7=Jumbo>,
  "hook_size": <number in mm or null — e.g. 4.0, 5.5, 6.0>,
  "project_type": <one of: "Amigurumi", "Tops", "Dresses", "Bottoms", "Sweaters", "Accessories", "Hats", "Scarves", "Bags", "Blankets", "Home Decor", "Other">,
  "sections": [
    {
      "title": "<section name>",
      "position": <1-based section index>,
      "rows": [
        { "row_number": <integer>, "instruction": "<text>", "position": <global index> }
      ]
    }
  ]
}

For the tags (yarn_weight, hook_size, project_type), infer them from the pattern text. Look for phrases like "Size 4 yarn", "worsted weight", "5.0mm hook", "H hook", "crochet top", etc. If truly unclear, use null for yarn_weight/hook_size and "Other" for project_type.

Return ONLY valid JSON, no markdown fences, no explanation.`,
        },
      ],
    });

    console.log(`--- LLM returned in ${Date.now() - startTime}ms ---`);

    // Parse OpenRouter's response
    let responseText = response.choices[0].message.content.trim();
    if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    console.log('--- LLM response length:', responseText.length, 'chars ---');
    const parsed = JSON.parse(responseText);
    console.log(`--- Parsed: ${parsed.sections?.length ?? 0} sections, ${parsed.total_rows} total rows ---`);

    // Write to database in a transaction
    await client.query('BEGIN');

    await client.query(
      `UPDATE projects
       SET total_yards = $1, total_rows = $2, pdf_url = $3,
           yarn_weight = $4, hook_size = $5, project_type = $6
       WHERE id = $7`,
      [
        parsed.total_yards,
        parsed.total_rows,
        pdf_url,
        parsed.yarn_weight ?? null,
        parsed.hook_size ?? null,
        parsed.project_type ?? null,
        req.params.id,
      ]
    );

    for (const section of parsed.sections) {
      const sectionResult = await client.query(
        'INSERT INTO sections (project_id, title, position) VALUES ($1, $2, $3) RETURNING id',
        [req.params.id, section.title, section.position]
      );
      const sectionId = sectionResult.rows[0].id;

      let sectionRowIndex = 1;
      for (const row of section.rows) {
        // Fallback to sequential number if LLM left row_number null
        const rowNumber = row.row_number ?? sectionRowIndex;
        await client.query(
          'INSERT INTO rows (section_id, row_number, instruction, position) VALUES ($1, $2, $3, $4)',
          [sectionId, rowNumber, row.instruction, row.position]
        );
        sectionRowIndex++;
      }
    }

    await client.query('COMMIT');
    res.json(parsed);
  } catch (err) {
    console.error('--- PDF Parse Error ---');
    console.error(err);
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
