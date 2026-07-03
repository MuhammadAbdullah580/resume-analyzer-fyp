const {
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
} = require('../services/resumeAnalyzer');

describe('resumeAnalyzer — section detection', () => {
  const sampleResume = `
John Doe
john.doe@example.com | +1 555 123 4567

Skills
JavaScript, Node.js, React, MySQL, Docker

Education
Bachelor of Science in Computer Science, State University

Experience
Software Engineer Intern, Acme Corp
2022 - 2023

Projects
Resume Analyzer Web App
Personal Portfolio Site
`;

  test('detects all four sections', () => {
    const sections = splitIntoSections(sampleResume);
    expect(sections).toHaveProperty('skills');
    expect(sections).toHaveProperty('education');
    expect(sections).toHaveProperty('experience');
    expect(sections).toHaveProperty('projects');
  });

  test('returns empty object when no recognizable headers exist', () => {
    const sections = splitIntoSections('Just some random text with no headers.');
    expect(Object.keys(sections).length).toBe(0);
  });

  test('recognizes header synonyms (e.g. "Work Experience")', () => {
    const text = `Work Experience\nDeveloper at X\n2020-2022\n\nTechnical Skills\nPython, SQL`;
    const sections = splitIntoSections(text);
    expect(sections).toHaveProperty('experience');
    expect(sections).toHaveProperty('skills');
  });
});

describe('resumeAnalyzer — contact info detection', () => {
  test('detects a valid email address', () => {
    expect(detectEmail('Contact me at jane.smith@company.com for details')).toBe(
      'jane.smith@company.com'
    );
  });

  test('returns null when no email is present', () => {
    expect(detectEmail('No contact info here.')).toBeNull();
  });

  test('detects a phone number', () => {
    expect(detectPhone('Call me at +1 555-123-4567 anytime')).toBeTruthy();
  });

  test('returns null when no phone number is present', () => {
    expect(detectPhone('No phone number in this text.')).toBeNull();
  });
});

describe('resumeAnalyzer — skills extraction', () => {
  test('matches known skills from a skills section', () => {
    const { matchedSkills } = extractSkillsList('JavaScript, React, MySQL, Docker', '');
    expect(matchedSkills).toEqual(
      expect.arrayContaining(['javascript', 'react', 'mysql', 'docker'])
    );
  });

  test('returns empty array when nothing matches', () => {
    const { matchedSkills } = extractSkillsList('gardening, painting, hiking', '');
    expect(matchedSkills.length).toBe(0);
  });
});

describe('resumeAnalyzer — experience estimation', () => {
  test('calculates years from a date range', () => {
    const years = estimateExperienceYears('Software Engineer\n2020 - 2023');
    expect(years).toBe(3);
  });

  test('treats "Present" as the current year', () => {
    const currentYear = new Date().getFullYear();
    const years = estimateExperienceYears(`Developer\n${currentYear - 2} - Present`);
    expect(years).toBe(2);
  });

  test('falls back to explicit "X years" phrasing', () => {
    const years = estimateExperienceYears('Over 4 years of experience in backend development');
    expect(years).toBe(4);
  });

  test('returns 0 for empty input', () => {
    expect(estimateExperienceYears('')).toBe(0);
  });
});

describe('resumeAnalyzer — project counting', () => {
  test('counts project lines', () => {
    const count = countProjects('Resume Analyzer App\nPortfolio Website\nChat Bot');
    expect(count).toBe(3);
  });

  test('returns 0 for empty section', () => {
    expect(countProjects('')).toBe(0);
    expect(countProjects(undefined)).toBe(0);
  });
});

describe('resumeAnalyzer — scoring rules', () => {
  test('scoreSkills: 0 marks when no skills detected', () => {
    expect(scoreSkills([], 0).score).toBe(0);
  });

  test('scoreSkills: full marks for 10+ skills', () => {
    const skills = Array.from({ length: 10 }, (_, i) => `skill${i}`);
    expect(scoreSkills(skills, 10).score).toBe(30);
  });

  test('scoreEducation: 0 marks when section missing', () => {
    expect(scoreEducation(null).score).toBe(0);
  });

  test('scoreEducation: full marks when degree keyword present', () => {
    expect(scoreEducation('Bachelor of Science in Computer Science, State University').score).toBe(20);
  });

  test('scoreExperience: suggests internships for <1 year', () => {
    const result = scoreExperience(0.5, 'Intern, 6 months');
    expect(result.score).toBe(18);
    expect(result.note).toMatch(/internship/i);
  });

  test('scoreExperience: full marks for 3+ years', () => {
    expect(scoreExperience(3, 'text').score).toBe(30);
  });

  test('scoreProjects: recommends adding projects when none exist', () => {
    const result = scoreProjects(0);
    expect(result.score).toBe(0);
    expect(result.note).toMatch(/add.*projects/i);
  });

  test('scoreProjects: full marks for 4+ projects', () => {
    expect(scoreProjects(4).score).toBe(20);
  });
});
