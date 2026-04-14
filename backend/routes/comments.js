const express = require('express');
const router = express.Router();
const pool = require('../db');

// POST /api/projects/:id/comments — create comment (inline if row_id provided, project-level otherwise).
// Inline comments may optionally carry image_x/image_y fractional coords (0–1)
// to annotate a position on the project image.
router.post('/projects/:id/comments', async (req, res) => {
  try {
    const { user_id, body, row_id, image_x, image_y } = req.body;
    if (!user_id || !body?.trim()) {
      return res.status(400).json({ error: 'user_id and body are required' });
    }

    // Only persist coords on inline comments; ignore silently otherwise.
    const hasCoords =
      row_id && typeof image_x === 'number' && typeof image_y === 'number';

    const result = await pool.query(
      `INSERT INTO comments (user_id, project_id, row_id, body, image_x, image_y)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        user_id,
        req.params.id,
        row_id || null,
        body.trim(),
        hasCoords ? image_x : null,
        hasCoords ? image_y : null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id/comments — project-level comments (row_id IS NULL)
router.get('/projects/:id/comments', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, u.username
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.project_id = $1 AND c.row_id IS NULL
       ORDER BY c.created_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id/comments/inline — all inline comments for a project
router.get('/projects/:id/comments/inline', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, u.username, r.row_number, s.title AS section_title
       FROM comments c
       JOIN users u ON c.user_id = u.id
       JOIN rows r ON c.row_id = r.id
       JOIN sections s ON r.section_id = s.id
       WHERE c.project_id = $1 AND c.row_id IS NOT NULL
       ORDER BY r.position ASC, c.created_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rows/:rowId/comments — comments for a specific row
router.get('/rows/:rowId/comments', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, u.username
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.row_id = $1
       ORDER BY c.created_at DESC`,
      [req.params.rowId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/comments/:commentId — delete a comment
router.delete('/comments/:commentId', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM comments WHERE id = $1 RETURNING *',
      [req.params.commentId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    res.json({ message: 'Comment deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
