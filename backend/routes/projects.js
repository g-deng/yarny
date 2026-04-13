const express = require('express');
const router = express.Router();
const pool = require('../db');

// POST /api/projects — create project
router.post('/', async (req, res) => {
  try {
    const { title, image_url, is_public, user_id } = req.body;
    const result = await pool.query(
      `INSERT INTO projects (user_id, title, image_url, is_public)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [user_id, title, image_url || null, is_public || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create project error:', err.message, req.body);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects — all public projects (community feed)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, u.username
       FROM projects p
       JOIN users u ON p.user_id = u.id
       WHERE p.is_public = true
       ORDER BY p.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id — project + sections + rows + derived stats
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const projectResult = await pool.query(
      'SELECT * FROM projects WHERE id = $1',
      [id]
    );
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const project = projectResult.rows[0];

    const sectionsResult = await pool.query(
      `SELECT s.id AS section_id, s.title AS section_title, s.position AS section_position,
              r.id AS row_id, r.row_number, r.instruction, r.position AS row_position
       FROM sections s
       LEFT JOIN rows r ON r.section_id = s.id
       WHERE s.project_id = $1
       ORDER BY s.position, r.position`,
      [id]
    );

    // Group flat rows into nested sections
    const sectionsMap = new Map();
    for (const row of sectionsResult.rows) {
      if (!sectionsMap.has(row.section_id)) {
        sectionsMap.set(row.section_id, {
          id: row.section_id,
          title: row.section_title,
          position: row.section_position,
          rows: [],
        });
      }
      if (row.row_id) {
        sectionsMap.get(row.section_id).rows.push({
          id: row.row_id,
          row_number: row.row_number,
          instruction: row.instruction,
          position: row.row_position,
        });
      }
    }

    res.json({
      ...project,
      sections: Array.from(sectionsMap.values()),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:id — delete project
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM projects WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
