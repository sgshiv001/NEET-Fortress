(function (global) {
  "use strict";

  const seededTeachers = [
    ["Dr. Ananya Rao", "Physics", 982, 146, 98], ["Prof. Arjun Mehta", "Chemistry", 947, 132, 96],
    ["Dr. Isha Verma", "Botany", 921, 119, 95], ["Prof. Kabir Shah", "Zoology", 896, 108, 94],
    ["Dr. Meera Nair", "Chemistry", 862, 103, 93], ["Prof. Rohan Das", "Physics", 835, 99, 92]
  ].map((t, i) => ({ id: `T-${String(i + 1).padStart(3, "0")}`, name: t[0], subject: t[1], points: t[2], accepted: t[3], reputation: t[4], status: "verified" }));

  class TeacherPortal {
    constructor(professor) {
      this.professor = professor;
      this.teacherKey = "nf4_teachers";
      this.submissionKey = "nf4_submissions";
      this.teachers = JSON.parse(localStorage.getItem(this.teacherKey) || "null") || seededTeachers;
      this.submissions = JSON.parse(localStorage.getItem(this.submissionKey) || "null") || this.seedSubmissions();
      this.persist();
    }
    seedSubmissions() {
      return global.QuestionBank.questions.slice(44, 51).map((q, i) => ({
        id: `SUB-${String(231 + i).padStart(4, "0")}`, teacher: seededTeachers[i % seededTeachers.length].name,
        question: q, score: 74 + i * 3, status: ["peer_review", "approved", "ai_analysis", "approved", "format_check", "peer_review", "approved"][i], reviews: i % 3, submittedAt: Date.now() - i * 3600000
      }));
    }
    persist() { localStorage.setItem(this.teacherKey, JSON.stringify(this.teachers)); localStorage.setItem(this.submissionKey, JSON.stringify(this.submissions)); }
    submit(data) {
      const question = { id: `PENDING-${Date.now().toString(36).toUpperCase()}`, subject: data.subject, chapter: data.chapter, difficulty: +data.difficulty, text: data.text, options: [data.answer, "Plausible distractor A", "Plausible distractor B", "Plausible distractor C"], answer: 0, discrimination: .42, bloom: "Apply" };
      const analysis = this.professor.analyze(question);
      const submission = { id: `SUB-${Date.now().toString(36).toUpperCase()}`, teacher: data.teacher, question, score: analysis.score, status: analysis.score >= 70 ? "peer_review" : "needs_revision", reviews: 0, submittedAt: Date.now() };
      this.submissions.unshift(submission);
      if (!this.teachers.some(t => t.name.toLowerCase() === data.teacher.toLowerCase())) this.teachers.push({ id: `T-${Date.now().toString(36)}`, name: data.teacher, subject: data.subject, points: 10, accepted: 0, reputation: 80, status: "provisional" });
      this.persist();
      return submission;
    }
    review(id, approved, reviewer = "Current Authority") {
      const submission = this.submissions.find(s => s.id === id);
      if (!submission) return null;
      submission.reviews += 1;
      submission.lastReviewer = reviewer;
      if (!approved) submission.status = "needs_revision";
      else if (submission.reviews >= 2 && submission.score >= 70) { submission.status = "approved"; const teacher = this.teachers.find(t => t.name === submission.teacher); if (teacher) { teacher.points += 25; teacher.accepted += 1; } }
      this.persist();
      return submission;
    }
    leaderboard() { return this.teachers.slice().sort((a, b) => b.points - a.points); }
    pipelineCounts() {
      return ["submitted", "format_check", "ai_analysis", "peer_review", "approved"].map(status => ({ status, count: this.submissions.filter(s => s.status === status).length }));
    }
    quarantineTeacher(id) {
      const teacher = this.teachers.find(t => t.id === id);
      if (teacher) { teacher.status = "quarantined"; this.submissions.filter(s => s.teacher === teacher.name).forEach(s => { s.status = "quarantined"; }); this.persist(); }
      return teacher;
    }
  }

  global.TeacherPortal = TeacherPortal;
})(window);
