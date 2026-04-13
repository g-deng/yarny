const pool = require('./db');

async function initializeDatabase() {
  try {
    // 1. Users
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        username           text UNIQUE NOT NULL,
        profile_photo_url  text,
        bio                text,
        created_at         timestamptz DEFAULT now()
      );
    `);

    // 2. Projects
    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         uuid REFERENCES users(id) ON DELETE CASCADE,
        title           text NOT NULL,
        image_url       text,
        pdf_url         text,
        is_public       boolean DEFAULT false,
        total_yards     numeric,
        total_rows      int,
        created_at      timestamptz DEFAULT now(),
        last_worked_at  timestamptz
      );
    `);

    // 3. Sections
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sections (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
        title       text NOT NULL,
        position    int NOT NULL
      );
    `);

    // 4. Rows
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rows (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        section_id   uuid REFERENCES sections(id) ON DELETE CASCADE,
        row_number   int NOT NULL,
        instruction  text NOT NULL,
        position     int NOT NULL
      );
    `);

    // 5. Progress
    await pool.query(`
      CREATE TABLE IF NOT EXISTS progress (
        id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id             uuid REFERENCES users(id) ON DELETE CASCADE,
        project_id          uuid REFERENCES projects(id) ON DELETE CASCADE,
        current_row_id      uuid REFERENCES rows(id),
        rows_completed      int DEFAULT 0,
        updated_at          timestamptz DEFAULT now(),
        UNIQUE(user_id, project_id)
      );
    `);

    // 6. Progress log
    await pool.query(`
      CREATE TABLE IF NOT EXISTS progress_log (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
        project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
        rows_added  int NOT NULL,
        logged_at   timestamptz DEFAULT now()
      );
    `);

    // 7. Comments
    await pool.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
        project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
        row_id      uuid REFERENCES rows(id),
        body        text NOT NULL,
        created_at  timestamptz DEFAULT now()
      );
    `);

    // Add pdf_url column if it doesn't exist (for existing databases)
    await pool.query(`
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS pdf_url text;
    `);

    // Add profile fields to users (for existing databases)
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo_url text;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS bio text;
    `);

    console.log('All 7 tables created successfully');
  } catch (err) {
    console.error('Error initializing database:', err.message);
  } finally {
    await pool.end();
  }
}

initializeDatabase();
