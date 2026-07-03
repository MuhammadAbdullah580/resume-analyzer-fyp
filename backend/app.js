const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const resumeRoutes = require('./routes/resumeRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the frontend (static files) — optional convenience for the MVP demo.
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Resume Analyzer API is running.' });
});

// Multer / general error handler
app.use((err, req, res, next) => {
  if (err) {
    console.error(err.message);
    return res.status(400).json({ message: err.message });
  }
  next();
});

// 404 handler for unmatched API routes
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

module.exports = app;
