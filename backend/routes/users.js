const express = require('express');
const router = express.Router();
const pool = require('../db');

// POST /api/users — create user
router.post('/', async (req, res) => {
  try {
    const { username } = req.body;
    const result = await pool.query(
      'INSERT INTO users (username) VALUES ($1) RETURNING *',
      [username]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username already taken' });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/by-username/:username — look up user by username (for login)
router.get('/by-username/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/search?q=...&viewer_id=... — username prefix search.
// Must be defined BEFORE /:userId so Express doesn't route "search" as an id.
// Returns users with follower_count and is_following (for the viewer), sorted by follower_count desc.
router.get('/search', async (req, res) => {
  try {
    const { q, viewer_id } = req.query;
    const query = (q || '').toString().trim();
    if (!query) return res.json([]);

    const result = await pool.query(
      `SELECT u.*,
              (SELECT COUNT(*)::int FROM follows WHERE following_id = u.id) AS follower_count,
              (SELECT COUNT(*)::int FROM follows WHERE follower_id = u.id) AS following_count,
              EXISTS (
                SELECT 1 FROM follows
                WHERE follower_id = $2 AND following_id = u.id
              ) AS is_following
       FROM users u
       WHERE u.username ILIKE $1
       ORDER BY follower_count DESC, u.username ASC
       LIMIT 50`,
      [`${query}%`, viewer_id || null]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:userId — get user info, augmented with follower/following counts
// and (if ?viewer_id= is passed) whether the viewer already follows this user.
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { viewer_id } = req.query;
    const result = await pool.query(
      `SELECT u.*,
              (SELECT COUNT(*)::int FROM follows WHERE following_id = u.id) AS follower_count,
              (SELECT COUNT(*)::int FROM follows WHERE follower_id = u.id) AS following_count,
              EXISTS (
                SELECT 1 FROM follows
                WHERE follower_id = $2 AND following_id = u.id
              ) AS is_following
       FROM users u
       WHERE u.id = $1`,
      [userId, viewer_id || null]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/users/:userId — update user profile (photo, bio)
router.patch('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { profile_photo_url, bio } = req.body;
    const result = await pool.query(
      `UPDATE users
       SET profile_photo_url = COALESCE($1, profile_photo_url),
           bio = COALESCE($2, bio)
       WHERE id = $3
       RETURNING *`,
      [profile_photo_url ?? null, bio ?? null, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:userId/public-projects — list a user's public projects
router.get('/:userId/public-projects', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      `SELECT * FROM projects
       WHERE user_id = $1 AND is_public = true
       ORDER BY created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/:userId/follow — :userId follows body.target_id
router.post('/:userId/follow', async (req, res) => {
  try {
    const { userId } = req.params;
    const { target_id } = req.body;
    if (!target_id) return res.status(400).json({ error: 'target_id required' });
    if (target_id === userId) return res.status(400).json({ error: 'cannot follow self' });

    await pool.query(
      `INSERT INTO follows (follower_id, following_id)
       VALUES ($1, $2)
       ON CONFLICT (follower_id, following_id) DO NOTHING`,
      [userId, target_id]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:userId/follow/:targetId — :userId unfollows :targetId
router.delete('/:userId/follow/:targetId', async (req, res) => {
  try {
    const { userId, targetId } = req.params;
    await pool.query(
      'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
      [userId, targetId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:userId/followers — users following :userId
router.get('/:userId/followers', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      `SELECT u.*, f.created_at AS followed_at
       FROM follows f
       JOIN users u ON u.id = f.follower_id
       WHERE f.following_id = $1
       ORDER BY f.created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:userId/following — users that :userId follows
router.get('/:userId/following', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      `SELECT u.*, f.created_at AS followed_at
       FROM follows f
       JOIN users u ON u.id = f.following_id
       WHERE f.follower_id = $1
       ORDER BY f.created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
