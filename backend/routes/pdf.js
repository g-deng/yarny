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

    // Send extracted text to Gemini for structuring
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const response = await model.generateContent([
      {
        text: `You are parsing a knitting/crochet pattern. Here is the text extracted from the PDF:\n\n${pdfText}\n\nExtract the following as JSON:
{
  "total_yards": <number or null>,
  "total_rows": <number>,
  "sections": [
    {
      "title": "<section name>",
      "position": <1-based>,
      "rows": [
        {
          "row_number": <number>,
          "instruction": "<full instruction text>",
          "position": <global 1-based position across entire pattern>
        }
      ]
    }
  ]
}
Return ONLY valid JSON, no markdown fences, no explanation. If you are unsure about any of the fields, DO NOT RETURN NULL and estimate the value based on the text.`,
      },
    ]);

    // Parse Gemini's response
    let responseText = response.response.text().trim();
    if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    const parsed = JSON.parse(responseText);

    // Write to database in a transaction
    await client.query('BEGIN');

    await client.query(
      'UPDATE projects SET total_yards = $1, total_rows = $2, pdf_url = $3 WHERE id = $4',
      [parsed.total_yards, parsed.total_rows, pdf_url, req.params.id]
    );

    for (const section of parsed.sections) {
      const sectionResult = await client.query(
        'INSERT INTO sections (project_id, title, position) VALUES ($1, $2, $3) RETURNING id',
        [req.params.id, section.title, section.position]
      );
      const sectionId = sectionResult.rows[0].id;

      for (const row of section.rows) {
        await client.query(
          'INSERT INTO rows (section_id, row_number, instruction, position) VALUES ($1, $2, $3, $4)',
          [sectionId, row.row_number, row.instruction, row.position]
        );
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
