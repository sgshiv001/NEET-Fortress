(function (global) {
  "use strict";

  const KEYS = { questions: "nf6_custom_questions", attempts: "nf6_attempt_history", current: "nf6_current_attempt", student: "nf6_student_name" };
  const subjects = ["Physics", "Chemistry", "Botany", "Zoology"];
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
  const validQuestion = q => q && subjects.includes(q.subject) && typeof q.text === "string" && q.text.trim() &&
    typeof q.chapter === "string" && q.chapter.trim() && Array.isArray(q.options) && q.options.length === 4 &&
    q.options.every(option => typeof option === "string" && option.trim()) && Number.isInteger(Number(q.answer)) && Number(q.answer) >= 0 && Number(q.answer) < 4;

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
    if (!validQuestion(question)) throw new Error("A question needs a subject, chapter, prompt, four options, and a valid correct answer.");
    const custom = loadCustomQuestions();
    const normalized = { ...question, id: question.id || `NF-CUSTOM-${Date.now().toString(36).toUpperCase()}`, answer: Number(question.answer), difficulty: Number(question.difficulty) || 3, quality: 100, source: "Added by administrator" };
    custom.push(normalized);
    write(KEYS.questions, custom);
    return normalized;
  }
  function importQuestions(data) {
    const rows = Array.isArray(data) ? data : data?.questions;
    if (!Array.isArray(rows) || !rows.length) throw new Error("The JSON must contain an array of questions or a questions property.");
    const custom = loadCustomQuestions();
    const known = new Set(custom.map(q => q.id));
    const additions = rows.filter(validQuestion).map((q, index) => {
      const id = String(q.id || `NF-IMPORT-${Date.now().toString(36)}-${index}`);
      return { ...q, id: known.has(id) ? `NF-IMPORT-${Date.now().toString(36)}-${index}` : id, answer: Number(q.answer), difficulty: Number(q.difficulty) || 3 };
    });
    if (!additions.length) throw new Error("No valid questions found. Each needs a subject, chapter, prompt, four options, and a correct answer index from 0 to 3.");
    write(KEYS.questions, custom.concat(additions));
    return additions.length;
  }
  function history() { return read(KEYS.attempts, []); }
  function current() { return read(KEYS.current, null); }
  function start(mode, subject) {
    const bank = global.QuestionBank.questions;
    const size = mode === "mock" ? 180 : 20;
    const timeLimitMs = mode === "mock" ? 180 * 60 * 1000 : 30 * 60 * 1000;
    const questions = [];
    if (mode === "mock") {
      subjects.forEach(name => questions.push(...shuffled(bank.filter(q => q.subject === name)).slice(0, 45)));
    } else {
      const pool = subject === "All" ? bank : bank.filter(q => q.subject === subject);
      questions.push(...shuffled(pool).slice(0, size));
    }
    if (questions.length < size) throw new Error(`Not enough questions available for this exam. ${size} are needed.`);
    const paper = shuffled(questions).map(q => {
      const options = shuffled(q.options.map((text, index) => ({ text, correct: index === Number(q.answer) })));
      return { id: q.id, subject: q.subject, chapter: q.chapter, text: q.text, options: options.map(option => option.text), answer: options.findIndex(option => option.correct), difficulty: q.difficulty || 3, explanation: q.explanation || "Review the concept in your notes and try a similar question." };
    });
    const now = Date.now();
    const attempt = { id: `ATT-${now.toString(36).toUpperCase()}`, mode, subject, questions: paper, answers: {}, marked: [], currentIndex: 0, startedAt: now, expiresAt: now + timeLimitMs, timeLimitMs, status: "in_progress" };
    write(KEYS.current, attempt);
    return attempt;
  }
  function update(attempt) { write(KEYS.current, attempt); }
  function score(attempt) {
    const bySubject = Object.fromEntries(subjects.map(name => [name, { subject: name, total: 0, correct: 0, incorrect: 0, unanswered: 0, score: 0 }]));
    let correct = 0, incorrect = 0, unanswered = 0;
    attempt.questions.forEach((q, index) => {
      const chosen = attempt.answers[index];
      const row = bySubject[q.subject]; row.total += 1;
      if (chosen === undefined || chosen === null) { unanswered += 1; row.unanswered += 1; }
      else if (Number(chosen) === q.answer) { correct += 1; row.correct += 1; row.score += 4; }
      else { incorrect += 1; row.incorrect += 1; row.score -= 1; }
    });
    return { correct, incorrect, unanswered, score: correct * 4 - incorrect, maxScore: attempt.questions.length * 4, accuracy: attempt.questions.length ? Math.round(correct / attempt.questions.length * 100) : 0, subjects: Object.values(bySubject), completedAt: Date.now() };
  }
  function finish(attempt) {
    const result = score(attempt);
    const completed = { ...attempt, status: "completed", result };
    write(KEYS.attempts, [completed, ...history().filter(item => item.id !== attempt.id)].slice(0, 40));
    localStorage.removeItem(KEYS.current);
    return completed;
  }
  function studentName() { return localStorage.getItem(KEYS.student) || ""; }
  function setStudentName(name) { localStorage.setItem(KEYS.student, String(name).trim().slice(0, 48)); }
  function clearHistory() { localStorage.removeItem(KEYS.attempts); }

  global.NEETLearning = { attach, saveCustom, importQuestions, loadCustomQuestions, history, current, start, update, score, finish, studentName, setStudentName, clearHistory, subjects };
})(window);
