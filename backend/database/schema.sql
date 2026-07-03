-- AI-Based Web Resume Analyzer — Database Schema
-- Run this once to create the database and tables.

CREATE DATABASE IF NOT EXISTS resume_analyzer;
USE resume_analyzer;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('user','admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS resumes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    file_name VARCHAR(255),
    file_path VARCHAR(255),
    file_type VARCHAR(10),
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS analysis_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    resume_id INT NOT NULL,

    overall_score INT,
    skills_score INT,
    education_score INT,
    experience_score INT,
    projects_score INT,

    has_email BOOLEAN DEFAULT FALSE,
    has_phone BOOLEAN DEFAULT FALSE,
    missing_sections TEXT,
    recommendations TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (resume_id)
    REFERENCES resumes(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT,
    action VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (admin_id)
    REFERENCES users(id)
);

-- Optional: seed an admin user.
-- Password hash below corresponds to plaintext "Admin@123" (bcrypt, 10 rounds).
-- Generate your own hash before using this in production.
-- INSERT INTO users (full_name, email, password_hash, role)
-- VALUES ('System Admin', 'admin@example.com', '$2a$10$REPLACE_WITH_REAL_HASH', 'admin');
