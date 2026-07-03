const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'resume_analyzer',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Quick connectivity check on startup (skipped during automated tests)
if (process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      const conn = await pool.getConnection();
      console.log('✅ Connected to MySQL database:', process.env.DB_NAME);
      conn.release();
    } catch (err) {
      console.error('❌ MySQL connection failed:', err.message);
    }
  })();
}

module.exports = pool;
