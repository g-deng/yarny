const express = require('express');
const router = express.Router();
const pool = require('../db');

// POST /api/projects — create project (global + local state in one txn)
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { title, image_url, is_public, user_id } = req.body;

    await client.query('BEGIN');

    const projectResult = await client.query(
      `INSERT INTO projects (user_id, title, image_url, is_public)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [user_id, title, image_url || null, is_public || false]
    );
    const project = projectResult.rows[0];

    // Seed the creator's local state so the project appears on their Home immediately.
    await client.query(
      `INSERT INTO progress (user_id, project_id, rows_completed, updated_at)
       VALUES ($1, $2, 0, NOW())
       ON CONFLICT (user_id, project_id) DO NOTHING`,
      [user_id, project.id]
    );

    await client.query('COMMIT');
    res.status(201).json(project);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create project error:', err.message, req.body);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET /api/projects — public projects feed.
// Query params:
//   ?filter=all|following (default: all)
//   ?viewer_id=...        (required when filter=following)
//   ?sort=adds|created    (default: adds for all, created for following)
// Always returns adds_count (count of distinct users tracking the project in progress).
router.get('/', async (req, res) => {
  try {
    const filter = (req.query.filter || 'all').toString();
    const viewerId = req.query.viewer_id ? req.query.viewer_id.toString() : null;
    const sort = (req.query.sort || (filter === 'following' ? 'created' : 'adds')).toString();

    const orderBy =
      sort === 'created' ? 'p.created_at DESC' : 'adds_count DESC, p.created_at DESC';

    if (filter === 'following') {
      if (!viewerId) {
        return res.status(400).json({ error: 'viewer_id required for following filter' });
      }
      const result = await pool.query(
        `SELECT p.*, u.username, u.profile_photo_url,
                (SELECT COUNT(DISTINCT user_id)::int FROM progress WHERE project_id = p.id) AS adds_count
         FROM projects p
         JOIN users u ON p.user_id = u.id
         WHERE p.is_public = true
           AND (p.user_id = $1
                OR p.user_id IN (SELECT following_id FROM follows WHERE follower_id = $1))
         ORDER BY ${orderBy}`,
        [viewerId]
      );
      return res.json(result.rows);
    }

    const result = await pool.query(
      `SELECT p.*, u.username, u.profile_photo_url,
              (SELECT COUNT(DISTINCT user_id)::int FROM progress WHERE project_id = p.id) AS adds_count
       FROM projects p
       JOIN users u ON p.user_id = u.id
       WHERE p.is_public = true
       ORDER BY ${orderBy}`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id — project + sections + rows + derived stats.
// Private projects are owner-only: pass ?user_id=<caller> for auth.
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.query;

    const projectResult = await pool.query(
      `SELECT p.*, u.username, u.profile_photo_url,
              (SELECT COUNT(DISTINCT user_id)::int FROM progress WHERE project_id = p.id) AS adds_count
       FROM projects p
       JOIN users u ON p.user_id = u.id
       WHERE p.id = $1`,
      [id]
    );
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const project = projectResult.rows[0];

    if (!project.is_public && project.user_id !== user_id) {
      return res.status(403).json({ error: 'This project is private' });
    }

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

// PATCH /api/projects/:id/publish — one-way flip from private → public
router.patch('/:id/publish', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(400).json({ error: 'user_id required' });
    }

    const existing = await pool.query('SELECT user_id, is_public FROM projects WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (existing.rows[0].user_id !== user_id) {
      return res.status(403).json({ error: 'Only the owner can publish this project' });
    }
    if (existing.rows[0].is_public) {
      return res.status(400).json({ error: 'Project is already public' });
    }

    const result = await pool.query(
      'UPDATE projects SET is_public = true WHERE id = $1 RETURNING *',
      [id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:id — delete semantics depend on ownership + visibility:
//   - non-owner              → 403 (non-owners drop their library entry via /track)
//   - owner + private        → hard delete (cascades wipe sections/rows/progress/etc.)
//   - owner + public         → preserve global state; wipe only caller's progress + log
//   - owner + public + force → hard delete, but only if no other user tracks it; 409 otherwise
router.delete('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { user_id, force } = req.query;
    const wantsHardDelete = force === 'true' || force === '1';
    if (!user_id) {
      client.release();
      return res.status(400).json({ error: 'user_id required' });
    }

    const projectResult = await client.query(
      'SELECT user_id, is_public FROM projects WHERE id = $1',
      [id]
    );
    if (projectResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Project not found' });
    }
    const project = projectResult.rows[0];

    if (project.user_id !== user_id) {
      client.release();
      return res.status(403).json({ error: 'Only the owner can delete this project' });
    }

    await client.query('BEGIN');

    if (project.is_public) {
      if (wantsHardDelete) {
        const others = await client.query(
          'SELECT 1 FROM progress WHERE project_id = $1 AND user_id <> $2 LIMIT 1',
          [id, user_id]
        );
        if (others.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            error: 'Other users are tracking this project. Unpublish or remove them first.',
          });
        }
        await client.query('DELETE FROM projects WHERE id = $1', [id]);
        await client.query('COMMIT');
        return res.json({ kept_global: false, message: 'Project deleted' });
      }
      // Default public-owner behavior: keep global, drop owner's local state.
      await client.query(
        'DELETE FROM progress WHERE user_id = $1 AND project_id = $2',
        [user_id, id]
      );
      await client.query(
        'DELETE FROM progress_log WHERE user_id = $1 AND project_id = $2',
        [user_id, id]
      );
      await client.query('COMMIT');
      return res.json({
        kept_global: true,
        message: 'Removed from your library. The project is still public.',
      });
    }

    // Private: hard delete — FK cascades clean up dependents.
    await client.query('DELETE FROM projects WHERE id = $1', [id]);
    await client.query('COMMIT');
    res.json({ kept_global: false, message: 'Project deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
