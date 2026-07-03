const db = require('../config/db');

const Resume = {
  async create({ user_id, file_name, file_path, file_type }) {
    const [result] = await db.query(
      'INSERT INTO resumes (user_id, file_name, file_path, file_type) VALUES (?, ?, ?, ?)',
      [user_id, file_name, file_path, file_type]
    );
    return result.insertId;
  },

  async findById(id) {
    const [rows] = await db.query('SELECT * FROM resumes WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async findByUser(user_id) {
    const [rows] = await db.query(
      'SELECT * FROM resumes WHERE user_id = ? ORDER BY upload_date DESC',
      [user_id]
    );
    return rows;
  },

  async findAll({ limit = 50, offset = 0 } = {}) {
    const [rows] = await db.query(
      `SELECT r.*, u.full_name, u.email
       FROM resumes r JOIN users u ON r.user_id = u.id
       ORDER BY r.upload_date DESC LIMIT ? OFFSET ?`,
      [Number(limit), Number(offset)]
    );
    return rows;
  },

  async count() {
    const [rows] = await db.query('SELECT COUNT(*) AS total FROM resumes');
    return rows[0].total;
  }
};

module.exports = Resume;
