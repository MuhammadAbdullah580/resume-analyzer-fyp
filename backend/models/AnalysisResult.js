const db = require('../config/db');

const AnalysisResult = {
  async create({
    resume_id,
    overall_score,
    skills_score,
    education_score,
    experience_score,
    projects_score,
    has_email,
    has_phone,
    missing_sections,
    recommendations
  }) {
    const [result] = await db.query(
      `INSERT INTO analysis_results
       (resume_id, overall_score, skills_score, education_score, experience_score,
        projects_score, has_email, has_phone, missing_sections, recommendations)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        resume_id,
        overall_score,
        skills_score,
        education_score,
        experience_score,
        projects_score,
        has_email,
        has_phone,
        JSON.stringify(missing_sections || []),
        JSON.stringify(recommendations || [])
      ]
    );
    return result.insertId;
  },

  async findByResumeId(resume_id) {
    const [rows] = await db.query(
      'SELECT * FROM analysis_results WHERE resume_id = ? ORDER BY created_at DESC LIMIT 1',
      [resume_id]
    );
    return rows[0] || null;
  },

  async averageScore() {
    const [rows] = await db.query('SELECT AVG(overall_score) AS avg_score FROM analysis_results');
    return rows[0].avg_score;
  },

  async allMissingSections() {
    const [rows] = await db.query('SELECT missing_sections FROM analysis_results');
    return rows;
  }
};

module.exports = AnalysisResult;
