const db = require('../config/db');
const User = require('../models/User');
const Resume = require('../models/Resume');
const AnalysisResult = require('../models/AnalysisResult');

async function logAction(adminId, action) {
  try {
    await db.query('INSERT INTO admin_logs (admin_id, action) VALUES (?, ?)', [adminId, action]);
  } catch (err) {
    console.error('Failed to write admin log:', err.message);
  }
}

exports.listUsers = async (req, res) => {
  try {
    const { search = '', limit = 50, offset = 0 } = req.query;
    const users = await User.findAll({ search, limit, offset });
    await logAction(req.user.id, search ? `searched_users:${search}` : 'viewed_users');
    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching users.' });
  }
};

exports.listAllResumes = async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const resumes = await Resume.findAll({ limit, offset });
    await logAction(req.user.id, 'viewed_all_resumes');
    res.json({ resumes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching resumes.' });
  }
};

exports.getReports = async (req, res) => {
  try {
    const totalUsers = await User.count();
    const totalResumes = await Resume.count();
    const avgScoreRaw = await AnalysisResult.averageScore();
    const averageScore = avgScoreRaw ? Math.round(Number(avgScoreRaw) * 10) / 10 : 0;

    const allMissing = await AnalysisResult.allMissingSections();
    const missingTally = {};
    allMissing.forEach((row) => {
      let sections = [];
      try {
        sections = JSON.parse(row.missing_sections || '[]');
      } catch (e) {
        sections = [];
      }
      sections.forEach((s) => {
        missingTally[s] = (missingTally[s] || 0) + 1;
      });
    });

    const mostMissingSkills = Object.entries(missingTally)
      .sort((a, b) => b[1] - a[1])
      .map(([section, count]) => ({ section, count }));

    await logAction(req.user.id, 'viewed_reports');

    res.json({
      totalUsers,
      totalResumes,
      averageScore,
      mostMissingSections: mostMissingSkills
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error generating reports.' });
  }
};
