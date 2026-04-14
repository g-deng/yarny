const pool = require('./db');

async function resetDatabase() {
  try {
    console.log('Dropping all tables...');

    // Drop in reverse dependency order (cascade handles the rest)
    await pool.query(`
      DROP TABLE IF EXISTS comments CASCADE;
      DROP TABLE IF EXISTS progress_log CASCADE;
      DROP TABLE IF EXISTS progress CASCADE;
      DROP TABLE IF EXISTS rows CASCADE;
      DROP TABLE IF EXISTS sections CASCADE;
      DROP TABLE IF EXISTS projects CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);

    console.log('All tables dropped. Recreating schema...');

    // Re-run init
    await pool.query(`
      CREATE TABLE users (
        id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        username           text UNIQUE NOT NULL,
        profile_photo_url  text,
        bio                text,
        created_at         timestamptz DEFAULT now()
      );

      CREATE TABLE projects (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         uuid REFERENCES users(id) ON DELETE CASCADE,
        title           text NOT NULL,
        image_url       text,
        pdf_url         text,
        is_public       boolean DEFAULT false,
        total_yards     numeric,
        total_rows      int,
        yarn_weight     int,
        hook_size       numeric,
        project_type    text,
        created_at      timestamptz DEFAULT now(),
        last_worked_at  timestamptz
      );

      CREATE TABLE sections (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
        title       text NOT NULL,
        position    int NOT NULL
      );

      CREATE TABLE rows (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        section_id   uuid REFERENCES sections(id) ON DELETE CASCADE,
        row_number   int NOT NULL,
        instruction  text NOT NULL,
        position     int NOT NULL
      );

      CREATE TABLE progress (
        id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id             uuid REFERENCES users(id) ON DELETE CASCADE,
        project_id          uuid REFERENCES projects(id) ON DELETE CASCADE,
        current_row_id      uuid REFERENCES rows(id),
        rows_completed      int DEFAULT 0,
        updated_at          timestamptz DEFAULT now(),
        UNIQUE(user_id, project_id)
      );

      CREATE TABLE progress_log (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
        project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
        rows_added  int NOT NULL,
        logged_at   timestamptz DEFAULT now()
      );

      CREATE TABLE comments (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
        project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
        row_id      uuid REFERENCES rows(id),
        body        text NOT NULL,
        created_at  timestamptz DEFAULT now()
      );
    `);

    console.log('Database reset complete. All 7 tables recreated.');
  } catch (err) {
    console.error('Error resetting database:', err.message);
  } finally {
    await pool.end();
  }
}

resetDatabase();
