const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

// ---------- Text Extraction ----------

async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf') {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  throw new Error('Unsupported file type for text extraction.');
}

// ---------- Section Detection Helpers ----------

// Common section header variants, mapped to a canonical section name.
const SECTION_HEADERS = {
  skills: [
    'skills', 'technical skills', 'core competencies', 'key skills',
    'skill set', 'competencies', 'technologies'
  ],
  education: [
    'education', 'academic background', 'academic qualifications',
    'educational qualifications', 'qualifications'
  ],
  experience: [
    'experience', 'work experience', 'professional experience',
    'employment history', 'work history', 'career history'
  ],
  projects: [
    'projects', 'academic projects', 'personal projects', 'key projects'
  ]
};

// Splits resume text into a map of { sectionName: sectionBodyText }
// by locating header lines and taking everything until the next header.
function splitIntoSections(text) {
  const lines = text.split(/\r?\n/);
  const allHeaderVariants = Object.values(SECTION_HEADERS).flat();

  // Build index of {lineIndex, canonicalSection} for lines that look like headers
  const headerHits = [];
  lines.forEach((line, idx) => {
    const clean = line.trim().toLowerCase().replace(/[:\-–]+$/, '');
    if (!clean || clean.length > 40) return; // headers are short lines

    for (const [canonical, variants] of Object.entries(SECTION_HEADERS)) {
      if (variants.includes(clean)) {
        headerHits.push({ idx, canonical });
        break;
      }
    }
  });

  const sections = {};
  for (let i = 0; i < headerHits.length; i++) {
    const start = headerHits[i].idx + 1;
    const end = i + 1 < headerHits.length ? headerHits[i + 1].idx : lines.length;
    const body = lines.slice(start, end).join('\n').trim();
    // If a section appears more than once, concatenate.
    sections[headerHits[i].canonical] = sections[headerHits[i].canonical]
      ? `${sections[headerHits[i].canonical]}\n${body}`
      : body;
  }

  return sections;
}

// ---------- Contact Info Detection ----------

function detectEmail(text) {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : null;
}

function detectPhone(text) {
  const match = text.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/);
  return match ? match[0] : null;
}

// ---------- Skills Detection ----------

// A reasonably broad seed list; extend as needed.
const KNOWN_SKILLS = [
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'php', 'ruby', 'go', 'swift',
  'kotlin', 'html', 'css', 'sql', 'react', 'angular', 'vue', 'node.js', 'nodejs', 'express',
  'django', 'flask', 'spring', 'mysql', 'postgresql', 'mongodb', 'firebase', 'aws', 'azure',
  'gcp', 'docker', 'kubernetes', 'git', 'github', 'linux', 'rest api', 'graphql', 'redux',
  'tailwind', 'bootstrap', 'jquery', 'excel', 'power bi', 'tableau', 'figma', 'photoshop',
  'machine learning', 'data analysis', 'pandas', 'numpy', 'tensorflow', 'pytorch',
  'communication', 'leadership', 'teamwork', 'problem solving', 'project management'
];

function extractSkillsList(skillsSectionText, fullText) {
  const searchIn = (skillsSectionText || fullText || '').toLowerCase();
  const found = new Set();

  KNOWN_SKILLS.forEach((skill) => {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escaped}\\b`, 'i');
    if (pattern.test(searchIn)) found.add(skill);
  });

  // Also split the skills section on commas/bullets as a fallback signal.
  let listedCount = 0;
  if (skillsSectionText) {
    listedCount = skillsSectionText
      .split(/,|•|\n|\|/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && s.length < 30).length;
  }

  return { matchedSkills: Array.from(found), listedCount };
}

// ---------- Experience Detection ----------

// Attempts to estimate total years of experience from date ranges like
// "2021 - 2023", "Jan 2020 - Present", "2019-2021"
function estimateExperienceYears(experienceSectionText) {
  if (!experienceSectionText) return 0;

  const currentYear = new Date().getFullYear();
  const rangePattern = /(\d{4})\s*(?:-|–|to)\s*(present|\d{4})/gi;

  let totalYears = 0;
  let match;
  let matchedAny = false;

  while ((match = rangePattern.exec(experienceSectionText)) !== null) {
    matchedAny = true;
    const startYear = parseInt(match[1], 10);
    const endYear = /present/i.test(match[2]) ? currentYear : parseInt(match[2], 10);
    if (!isNaN(startYear) && !isNaN(endYear) && endYear >= startYear) {
      totalYears += endYear - startYear;
    }
  }

  // Fallback: look for explicit "X years of experience" phrasing.
  if (!matchedAny) {
    const explicit = experienceSectionText.match(/(\d+(\.\d+)?)\s*\+?\s*years?/i);
    if (explicit) totalYears = parseFloat(explicit[1]);
  }

  return totalYears;
}

// ---------- Projects Detection ----------

function countProjects(projectsSectionText) {
  if (!projectsSectionText) return 0;
  // Count bullet points / lines that look like project titles.
  const lines = projectsSectionText
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 3);
  return lines.length;
}

// ---------- Scoring Engine ----------

function scoreSkills(matchedSkills, listedCount) {
  const count = Math.max(matchedSkills.length, listedCount);
  if (count === 0) return { score: 0, note: 'No skills section detected.' };
  if (count < 5) return { score: 15, note: 'Fewer than 5 skills listed — consider adding more relevant skills.' };
  if (count < 10) return { score: 24, note: 'Good skill coverage; consider adding a few more relevant technologies.' };
  return { score: 30, note: 'Strong skills section.' };
}

function scoreEducation(educationText) {
  if (!educationText) return { score: 0, note: 'No education section detected.' };
  const hasDegreeKeyword = /(bachelor|master|b\.?sc|m\.?sc|b\.?tech|m\.?tech|bs|ms|phd|diploma|degree)/i.test(educationText);
  const hasInstitution = educationText.length > 15;
  if (hasDegreeKeyword && hasInstitution) return { score: 20, note: 'Education details look complete.' };
  if (hasInstitution) return { score: 12, note: 'Education section present but degree info unclear — specify your degree title.' };
  return { score: 8, note: 'Education section is minimal — add institution, degree, and dates.' };
}

function scoreExperience(years, experienceText) {
  if (!experienceText) return { score: 0, note: 'No experience section detected.', years: 0 };
  if (years <= 0) return { score: 10, note: 'Experience section present but duration unclear.', years };
  if (years < 1) return { score: 18, note: 'Less than 1 year of experience — consider highlighting internships.', years };
  if (years < 3) return { score: 24, note: 'Solid early-career experience.', years };
  return { score: 30, note: 'Strong professional experience.', years };
}

function scoreProjects(projectCount) {
  if (projectCount === 0) return { score: 0, note: 'No projects section detected — add 2-3 relevant projects.' };
  if (projectCount === 1) return { score: 10, note: 'Only one project listed — consider adding more to show breadth.' };
  if (projectCount <= 3) return { score: 16, note: 'Good project section.' };
  return { score: 20, note: 'Excellent project portfolio.' };
}

// ---------- Main Analysis Function ----------

async function analyzeResume(filePath) {
  const rawText = await extractText(filePath);
  const sections = splitIntoSections(rawText);

  const email = detectEmail(rawText);
  const phone = detectPhone(rawText);

  const { matchedSkills, listedCount } = extractSkillsList(sections.skills, rawText);
  const experienceYears = estimateExperienceYears(sections.experience);
  const projectCount = countProjects(sections.projects);

  const skillsResult = scoreSkills(matchedSkills, listedCount);
  const educationResult = scoreEducation(sections.education);
  const experienceResult = scoreExperience(experienceYears, sections.experience);
  const projectsResult = scoreProjects(projectCount);

  const overallScore =
    skillsResult.score + educationResult.score + experienceResult.score + projectsResult.score;

  const missingSections = [];
  if (!sections.skills) missingSections.push('skills');
  if (!sections.education) missingSections.push('education');
  if (!sections.experience) missingSections.push('experience');
  if (!sections.projects) missingSections.push('projects');

  const recommendations = [
    skillsResult.note,
    educationResult.note,
    experienceResult.note,
    projectsResult.note
  ];

  if (!email) recommendations.unshift('CRITICAL: No email address detected — recruiters need a way to contact you.');
  if (!phone) recommendations.push('Consider adding a phone number for contact.');

  return {
    overall_score: overallScore,
    skills_score: skillsResult.score,
    education_score: educationResult.score,
    experience_score: experienceResult.score,
    projects_score: projectsResult.score,
    has_email: !!email,
    has_phone: !!phone,
    missing_sections: missingSections,
    recommendations,
    details: {
      matchedSkills,
      experienceYears,
      projectCount
    }
  };
}

module.exports = {
  analyzeResume,
  extractText,
  splitIntoSections,
  detectEmail,
  detectPhone,
  extractSkillsList,
  estimateExperienceYears,
  countProjects,
  scoreSkills,
  scoreEducation,
  scoreExperience,
  scoreProjects
};
