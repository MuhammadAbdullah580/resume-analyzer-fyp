const db = require('../config/db');

const User = {
  async create({ full_name, email, password_hash, role = 'user' }) {
    const [result] = await db.query(
      'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [full_name, email, password_hash, role]
    );
    return result.insertId;
  },

  async findByEmail(email) {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await db.query(
      'SELECT id, full_name, email, role, created_at FROM users WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  },

  async updateProfile(id, { full_name, email }) {
    await db.query('UPDATE users SET full_name = ?, email = ? WHERE id = ?', [
      full_name,
      email,
      id
    ]);
  },

  async findAll({ search = '', limit = 50, offset = 0 } = {}) {
    const like = `%${search}%`;
    const [rows] = await db.query(
      `SELECT id, full_name, email, role, created_at FROM users
       WHERE full_name LIKE ? OR email LIKE ?
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [like, like, Number(limit), Number(offset)]
    );
    return rows;
  },

  async count() {
    const [rows] = await db.query('SELECT COUNT(*) AS total FROM users');
    return rows[0].total;
  }
};

module.exports = User;
