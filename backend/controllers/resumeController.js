const path = require('path');
const fs = require('fs');
const Resume = require('../models/Resume');
const AnalysisResult = require('../models/AnalysisResult');
const { analyzeResume } = require('../services/resumeAnalyzer');

exports.uploadResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded. Only PDF and DOCX are allowed.' });
    }

    const { filename, path: filePath, originalname } = req.file;
    const ext = path.extname(originalname).toLowerCase().replace('.', '');

    // 1. Store resume metadata
    const resumeId = await Resume.create({
      user_id: req.user.id,
      file_name: originalname,
      file_path: filename,
      file_type: ext
    });

    // 2. Run rule-based analysis
    let analysis;
    try {
      analysis = await analyzeResume(filePath);
    } catch (parseErr) {
      console.error('Parsing error:', parseErr);
      return res.status(422).json({
        message: 'Could not parse the resume file. Please ensure it is a valid PDF or DOCX.'
      });
    }

    // 3. Store analysis results
    await AnalysisResult.create({
      resume_id: resumeId,
      overall_score: analysis.overall_score,
      skills_score: analysis.skills_score,
      education_score: analysis.education_score,
      experience_score: analysis.experience_score,
      projects_score: analysis.projects_score,
      has_email: analysis.has_email,
      has_phone: analysis.has_phone,
      missing_sections: analysis.missing_sections,
      recommendations: analysis.recommendations
    });

    res.status(201).json({
      message: 'Resume uploaded and analyzed successfully.',
      resumeId,
      analysis
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during resume upload/analysis.' });
  }
};

exports.getResumeResult = async (req, res) => {
  try {
    const resume = await Resume.findById(req.params.id);
    if (!resume) return res.status(404).json({ message: 'Resume not found.' });

    // Users can only view their own resumes; admins can view any.
    if (resume.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const result = await AnalysisResult.findByResumeId(resume.id);
    if (!result) return res.status(404).json({ message: 'Analysis result not found.' });

    result.missing_sections = JSON.parse(result.missing_sections || '[]');
    result.recommendations = JSON.parse(result.recommendations || '[]');

    res.json({ resume, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching result.' });
  }
};

exports.getMyHistory = async (req, res) => {
  try {
    const resumes = await Resume.findByUser(req.user.id);
    res.json({ resumes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching history.' });
  }
};
