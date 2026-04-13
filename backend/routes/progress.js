const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/users/:userId/projects — user's own + tracked projects with progress
router.get('/:userId/projects', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      `SELECT p.*,
              COALESCE(pr.rows_completed, 0) AS rows_completed,
              pr.current_row_id,
              pr.updated_at AS progress_updated_at
       FROM projects p
       LEFT JOIN progress pr ON pr.project_id = p.id AND pr.user_id = $1
       WHERE p.user_id = $1
          OR pr.user_id = $1
       ORDER BY p.last_worked_at DESC NULLS LAST`,
      [userId]
    );

    // Derive yards_used for each project
    const projects = result.rows.map((p) => {
      const yardsUsed =
        p.total_rows > 0 && p.total_yards
          ? (p.rows_completed / p.total_rows) * Number(p.total_yards)
          : 0;
      return { ...p, yards_used: Math.round(yardsUsed * 100) / 100 };
    });

    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:userId/projects/:id/track — stop tracking a project
router.delete('/:userId/projects/:id/track', async (req, res) => {
  try {
    const { userId, id: projectId } = req.params;
    await pool.query(
      'DELETE FROM progress WHERE user_id = $1 AND project_id = $2',
      [userId, projectId]
    );
    await pool.query(
      'DELETE FROM progress_log WHERE user_id = $1 AND project_id = $2',
      [userId, projectId]
    );
    res.json({ message: 'Stopped tracking project' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/:userId/projects/:id/add — add someone else's project to track
router.post('/:userId/projects/:id/add', async (req, res) => {
  try {
    const { userId, id: projectId } = req.params;

    // Check project exists
    const projectResult = await pool.query('SELECT id FROM projects WHERE id = $1', [projectId]);
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Create progress record (upsert — no-op if already tracking)
    const result = await pool.query(
      `INSERT INTO progress (user_id, project_id, rows_completed, updated_at)
       VALUES ($1, $2, 0, NOW())
       ON CONFLICT (user_id, project_id) DO NOTHING
       RETURNING *`,
      [userId, projectId]
    );

    if (result.rows.length === 0) {
      return res.json({ message: 'Already tracking this project' });
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/users/:userId/projects/:id/progress — increment/decrement progress
router.patch('/:userId/projects/:id/progress', async (req, res) => {
  const client = await pool.connect();

  try {
    const { userId, id: projectId } = req.params;
    const { rows_to_add } = req.body;

    await client.query('BEGIN');

    // Upsert progress (clamped to >= 0)
    const progressResult = await client.query(
      `INSERT INTO progress (user_id, project_id, rows_completed, updated_at)
       VALUES ($1, $2, GREATEST($3, 0), NOW())
       ON CONFLICT (user_id, project_id)
       DO UPDATE SET rows_completed = GREATEST(progress.rows_completed + $3, 0),
                     updated_at = NOW()
       RETURNING *`,
      [userId, projectId, rows_to_add]
    );
    const progress = progressResult.rows[0];

    // Update current_row_id to the next row to work on
    const nextRowResult = await client.query(
      `SELECT id FROM rows
       WHERE section_id IN (SELECT id FROM sections WHERE project_id = $1)
       ORDER BY position
       LIMIT 1 OFFSET $2`,
      [projectId, progress.rows_completed]
    );
    const nextRowId = nextRowResult.rows.length > 0 ? nextRowResult.rows[0].id : null;
    await client.query(
      'UPDATE progress SET current_row_id = $1 WHERE id = $2',
      [nextRowId, progress.id]
    );

    // Log both forward and backward movement so stats can't be gamed
    await client.query(
      'INSERT INTO progress_log (user_id, project_id, rows_added) VALUES ($1, $2, $3)',
      [userId, projectId, rows_to_add]
    );

    // Update project's last_worked_at
    await client.query(
      'UPDATE projects SET last_worked_at = NOW() WHERE id = $1',
      [projectId]
    );

    await client.query('COMMIT');
    res.json({ ...progress, current_row_id: nextRowId });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST /api/users/:userId/projects/:id/restart — reset progress to 0
router.post('/:userId/projects/:id/restart', async (req, res) => {
  try {
    const { userId, id: projectId } = req.params;
    const result = await pool.query(
      `UPDATE progress
       SET rows_completed = 0, current_row_id = NULL, updated_at = NOW()
       WHERE user_id = $1 AND project_id = $2
       RETURNING *`,
      [userId, projectId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Progress record not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:userId/stats — aggregated stats
router.get('/:userId/stats', async (req, res) => {
  try {
    const { userId } = req.params;

    // Row stats from progress_log
    const rowStats = await pool.query(
      `SELECT
        COALESCE(SUM(rows_added), 0) AS all_time,
        COALESCE(SUM(CASE WHEN logged_at >= NOW() - INTERVAL '7 days' THEN rows_added ELSE 0 END), 0) AS week,
        COALESCE(SUM(CASE WHEN logged_at >= CURRENT_DATE THEN rows_added ELSE 0 END), 0) AS today
       FROM progress_log
       WHERE user_id = $1`,
      [userId]
    );

    // Yards used from progress + projects
    const yardStats = await pool.query(
      `SELECT COALESCE(SUM(
        CASE WHEN p.total_rows > 0
        THEN (CAST(pr.rows_completed AS numeric) / p.total_rows) * COALESCE(p.total_yards, 0)
        ELSE 0 END
       ), 0) AS used
       FROM progress pr
       JOIN projects p ON p.id = pr.project_id
       WHERE pr.user_id = $1`,
      [userId]
    );

    res.json({
      rows: {
        today: Number(rowStats.rows[0].today),
        week: Number(rowStats.rows[0].week),
        all_time: Number(rowStats.rows[0].all_time),
      },
      yards: {
        used: Math.round(Number(yardStats.rows[0].used) * 100) / 100,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
