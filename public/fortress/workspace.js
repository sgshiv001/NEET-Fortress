(function (global) {
  "use strict";

  const roles = {
    guest: { label: "Guest", home: "student", views: ["student"] },
    candidate: { label: "Candidate", home: "student", views: ["student"] },
    invigilator: { label: "Invigilator", home: "monitor", views: ["monitor", "sentinel", "audit"] },
    coordinator: { label: "Exam coordinator", home: "command", views: ["command", "student", "vault", "papers", "monitor", "sentinel", "audit"] },
    admin: { label: "Administrator", home: "command", views: ["command", "student", "vault", "papers", "monitor", "sentinel", "audit", "unlock"] },
  };
  const types = {
    school: "School", college: "College", university: "University",
    training: "Training provider", certification: "Certification body",
    employer: "Employer", other: "Other organization",
  };
  let account = null;

  const profileKey = () => account ? `ef_workspace:${account.id}` : "ef_workspace";
  const clean = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";
  const normalize = (value = {}) => ({
    name: clean(value.name, 64),
    organization: clean(value.organization, 100),
    type: Object.hasOwn(types, value.type) ? value.type : "",
    role: Object.hasOwn(roles, value.role) ? value.role : "guest",
  });

  function profile() {
    try {
      const saved = JSON.parse(localStorage.getItem(profileKey()) || "null");
      if (saved) return normalize(saved);
    } catch { /* An invalid saved profile can be replaced from the welcome page. */ }
    if (account) return normalize();
    const adminName = localStorage.getItem("nf5_admin_name") || localStorage.getItem("nf4_admin_name");
    const candidateName = localStorage.getItem("nf6_student_name");
    if (candidateName) return normalize({ name: candidateName, role: "candidate" });
    if (adminName) return normalize({ name: adminName, role: "admin" });
    return normalize();
  }

  function save(value) {
    const next = normalize(value);
    localStorage.setItem(profileKey(), JSON.stringify(next));
    return next;
  }

  function greeting(date = new Date()) {
    const hour = date.getHours();
    return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  }

  async function loadAccount() {
    try {
      const response = await fetch("/api/current-user", { cache: "no-store", signal: AbortSignal.timeout(4000) });
      if (!response.ok) return;
      const { user } = await response.json();
      if (user?.id && user.displayName) account = user;
    } catch { /* The local workspace also runs without hosted sign-in. */ }
  }

  global.ExamWorkspace = { roles, types, profile, save, greeting, loadAccount, account: () => account };
})(window);
