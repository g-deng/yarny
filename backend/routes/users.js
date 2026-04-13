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

// GET /api/users/:userId — get user info
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
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

module.exports = router;
