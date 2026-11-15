(function (global) {
  "use strict";

  const KEYS = { questions: "nf6_custom_questions", attempts: "nf6_attempt_history", current: "nf6_current_attempt", exams: "ef_exam_catalog" };
  const demoSubjects = Object.keys(global.QuestionBank.chapters);
  const demoIds = new Set(global.QuestionBank.questions.map(question => question.id));
  const defaultMarking = { correct: 4, incorrect: -1 };
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; }
    catch { return fallback; }
  };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const shuffled = values => {
    const result = values.slice();
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };
  const validQuestion = q => q && typeof q.subject === "string" && q.subject.trim() &&
    typeof q.text === "string" && q.text.trim() && typeof q.chapter === "string" && q.chapter.trim() &&
    Array.isArray(q.options) && q.options.length >= 2 && q.options.length <= 6 &&
    Array.from(q.options).every(option => typeof option === "string" && option.trim()) &&
    (typeof q.answer === "number" || typeof q.answer === "string" && q.answer.trim()) &&
    Number.isInteger(Number(q.answer)) && Number(q.answer) >= 0 && Number(q.answer) < q.options.length;

  function normalizeQuestion(question, id) {
    return {
      id, subject: question.subject.trim(), chapter: question.chapter.trim(), text: question.text.trim(),
      options: question.options.map(option => option.trim()), answer: Number(question.answer),
      difficulty: [1, 2, 3, 4, 5].includes(Number(question.difficulty)) ? Number(question.difficulty) : 3,
      explanation: typeof question.explanation === "string" ? question.explanation.trim() : "",
      quality: Number.isFinite(question.quality) ? Math.max(0, Math.min(100, question.quality)) : 0,
      bloom: typeof question.bloom === "string" ? question.bloom : "",
    };
  }

  function newId(prefix) {
    const random = global.crypto.randomUUID?.() || Array.from(global.crypto.getRandomValues(new Uint32Array(4))).join("-");
    return `${prefix}-${random}`;
  }

  function loadCustomQuestions() { return read(KEYS.questions, []).filter(validQuestion); }
  function attach(bank) {
    const custom = loadCustomQuestions();
    const ids = new Set(bank.questions.map(q => q.id));
    custom.forEach(question => {
      if (ids.has(question.id)) return;
      ids.add(question.id);
      bank.questions.push(question);
    });
    return bank;
  }
  function saveCustom(question) {
    if (!validQuestion(question)) throw new Error("Enter a subject, topic, question, two to six options, and a correct option.");
    const custom = loadCustomQuestions();
    const normalized = normalizeQuestion(question, newId("EF-Q"));
    custom.push(normalized);
    write(KEYS.questions, custom);
    return normalized;
  }
  function importQuestions(data) {
    const rows = Array.isArray(data) ? data : data?.questions;
    if (!Array.isArray(rows) || !rows.length) throw new Error("The JSON must contain an array of questions or a questions property.");
    const custom = loadCustomQuestions();
    const badIndex = rows.findIndex(question => !validQuestion(question));
    if (badIndex >= 0) throw new Error(`Question ${badIndex + 1} needs a subject, topic, prompt, two to six options, and a valid answer index.`);
    const known = new Set([...demoIds, ...custom.map(q => q.id)]);
    const additions = rows.map(question => {
      let id = typeof question.id === "string" ? question.id.trim() : "";
      if (!id || known.has(id)) id = newId("EF-Q");
      known.add(id);
      return normalizeQuestion(question, id);
    });
    write(KEYS.questions, custom.concat(additions));
    return additions.length;
  }
  const attemptKey = key => {
    const user = global.ExamWorkspace?.account();
    return user ? `${key}:${user.id}` : key;
  };
  function history() { return read(attemptKey(KEYS.attempts), []); }
  function current() { return read(attemptKey(KEYS.current), null); }
  function questionPool(source, subject = "") {
    return global.QuestionBank.questions.filter(q =>
      demoIds.has(q.id) === (source === "demo") && (!subject || q.subject === subject));
  }
  function subjects(source) {
    return Array.from(new Set(questionPool(source).map(q => q.subject))).sort((a, b) => a.localeCompare(b));
  }
  function exams() { return read(KEYS.exams, []); }
  function validateExam(values) {
    const exam = {
      name: String(values.name || "").trim().slice(0, 100),
      source: values.source === "demo" ? "demo" : "organization",
      subject: String(values.subject || "").trim(),
      count: Number(values.count),
      minutes: Number(values.minutes),
      correct: Number(values.correct),
      incorrect: Number(values.incorrect),
    };
    const available = questionPool(exam.source, exam.subject).length;
    if (!exam.name) throw new Error("Enter an exam name.");
    if (!Number.isInteger(exam.count) || exam.count < 1 || exam.count > 500) throw new Error("Choose between 1 and 500 questions.");
    if (exam.count > available) throw new Error(`The selected bank has ${available} matching questions. Add more questions or reduce the exam size.`);
    if (!Number.isInteger(exam.minutes) || exam.minutes < 1 || exam.minutes > 720) throw new Error("Choose a duration between 1 and 720 minutes.");
    if (!Number.isInteger(exam.correct) || exam.correct < 1 || exam.correct > 100 ||
        !Number.isInteger(exam.incorrect) || exam.incorrect < -100 || exam.incorrect > 0) {
      throw new Error("Use 1 to 100 points for a correct answer and −100 to 0 for an incorrect answer.");
    }
    return exam;
  }
  function saveExam(values, id = newId("EF-EXAM")) {
    const saved = { id, ...validateExam(values) };
    const catalog = exams();
    const index = catalog.findIndex(exam => exam.id === id);
    if (index < 0) catalog.push(saved);
    else catalog[index] = saved;
    write(KEYS.exams, catalog);
    return saved;
  }
  function removeExam(id) {
    write(KEYS.exams, exams().filter(exam => exam.id !== id));
  }

  function start(mode, subject = "", configuredExam) {
    if (mode === "configured") {
      const exam = validateExam(configuredExam);
      const pool = questionPool(exam.source, exam.subject);
      return createAttempt({ mode, subject: exam.subject, name: exam.name, minutes: exam.minutes,
        marking: { correct: exam.correct, incorrect: exam.incorrect } }, global.assembleExamQuestions(pool, exam.count));
    }
    const bank = questionPool("demo");
    const size = mode === "mock" ? 180 : 20;
    const questions = mode === "mock"
      ? demoSubjects.flatMap(name => shuffled(bank.filter(q => q.subject === name)).slice(0, 45))
      : shuffled(questionPool("demo", subject)).slice(0, size);
    if (questions.length < size) throw new Error(`Not enough questions available for this exam. ${size} are needed.`);
    return createAttempt({ mode, subject, minutes: mode === "mock" ? 180 : 30, marking: defaultMarking }, questions);
  }
  function createAttempt({ mode, subject, name, minutes, marking }, questions) {
    const timeLimitMs = minutes * 60 * 1000;
    const paper = shuffled(questions).map(q => {
      const options = shuffled(q.options.map((text, index) => ({ text, correct: index === Number(q.answer) })));
      return { id: q.id, subject: q.subject, chapter: q.chapter, text: q.text, options: options.map(option => option.text), answer: options.findIndex(option => option.correct), difficulty: q.difficulty || 3, explanation: q.explanation || "Review the concept in your notes and try a similar question." };
    });
    const now = Date.now();
    const attempt = { id: newId("ATT"), mode, subject, name, marking, questions: paper, answers: {}, marked: [], currentIndex: 0, startedAt: now, expiresAt: now + timeLimitMs, timeLimitMs, status: "in_progress" };
    update(attempt);
    return attempt;
  }
  function update(attempt) { write(attemptKey(KEYS.current), attempt); }
  function score(attempt) {
    const marking = attempt.marking || defaultMarking;
    const bySubject = new Map();
    let correct = 0, incorrect = 0, unanswered = 0;
    attempt.questions.forEach((q, index) => {
      const chosen = attempt.answers[index];
      if (!bySubject.has(q.subject)) bySubject.set(q.subject, { subject: q.subject, total: 0, correct: 0, incorrect: 0, unanswered: 0, score: 0, maxScore: 0 });
      const row = bySubject.get(q.subject);
      row.total += 1;
      row.maxScore += marking.correct;
      if (chosen === undefined || chosen === null) { unanswered += 1; row.unanswered += 1; }
      else if (Number(chosen) === q.answer) { correct += 1; row.correct += 1; row.score += marking.correct; }
      else { incorrect += 1; row.incorrect += 1; row.score += marking.incorrect; }
    });
    return { correct, incorrect, unanswered, score: correct * marking.correct + incorrect * marking.incorrect, maxScore: attempt.questions.length * marking.correct, accuracy: attempt.questions.length ? Math.round(correct / attempt.questions.length * 100) : 0, subjects: Array.from(bySubject.values()), completedAt: Date.now() };
  }
  function finish(attempt) {
    const result = score(attempt);
    const completed = { ...attempt, status: "completed", result };
    write(attemptKey(KEYS.attempts), [completed, ...history().filter(item => item.id !== attempt.id)].slice(0, 40));
    localStorage.removeItem(attemptKey(KEYS.current));
    return completed;
  }
  function clearHistory() { localStorage.removeItem(attemptKey(KEYS.attempts)); }

  global.ExamLearning = { attach, saveCustom, importQuestions, questionPool, subjects, exams, validateExam, saveExam, removeExam, history, current, start, update, score, finish, clearHistory };
})(window);
