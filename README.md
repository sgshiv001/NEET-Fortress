# Exam Fortress

Exam Fortress is a browser-based exam security and operations prototype for schools, colleges, universities, training providers, certification bodies, employers, and other organizations. Use it to try the workflow for classroom tests, university assessments, entrance exams, professional certifications, and workplace training.

## App working report

| Area | What works |
| --- | --- |
| Organization welcome | Enter an organization name and type, select a workspace role, and see a time-of-day greeting. On Sites, the greeting uses the signed-in ChatGPT display name when identity is available. |
| Role-based navigation | Guests and candidates open the candidate hub. Invigilators open monitoring and can view risk signals and audit events. Exam coordinators configure exams and manage question banks. Administrators also see the local passphrase demo. |
| Question bank | Create, search, import, and export questions for any subject or topic. The runner supports single-answer questions with two to six options, including true/false. |
| Exam setup | Name an assessment, choose a question bank and optional subject, and configure the question count, duration, correct-answer points, and incorrect-answer penalty. Edit or remove saved exams from the candidate hub. |
| Paper variants | Generate randomized variants from the selected question pool and inspect their subject distribution. The timed runner uses the same selection logic. |
| Candidate assessment | Start or resume a timed exam, mark questions for review, submit, and see scoring and answer explanations. A generated science mock and focused practice are available as samples. |
| Security activity | View and verify browser-local audit events, export the audit as JSON, and try simulated risk signals. Staff can enable optional local motion, light, and sound analysis. |

### Try a complete workflow

1. Open Exam Fortress. Enter your organization details, select **Exam coordinator**, and choose **Open workspace**.
2. In **Question bank**, add a few questions or import a JSON file.
3. In **Exam setup**, configure the assessment and save it. Use **Generate paper variants** to preview randomized sets.
4. Open the profile from the workspace header and select **Candidate**. Start the saved exam from **Candidate hub**, answer questions, and submit.
5. Switch back to the coordinator profile and open **Audit** to verify or export exam setup and submission events.

### Verification

The production build and all 12 automated checks passed. In a local browser, a coordinator created a workplace-safety certification exam, generated a paper variant, and saved the exam. The candidate opened it with a five-minute timer, resumed it after a reload, and received 3 out of 3 under the configured marking scheme.

### Question bank format

Import a JSON array of questions or an object with a `questions` array. Use `chapter` for the topic and a zero-based `answer` index. `id`, `difficulty` (1–5), and `explanation` are optional.

```json
{
  "questions": [
    {
      "subject": "Workplace safety",
      "chapter": "Emergency procedures",
      "text": "Which route should you use during a fire evacuation?",
      "options": ["The marked emergency exit route", "The elevator"],
      "answer": 0,
      "explanation": "Follow the marked route to the designated assembly point."
    }
  ]
}
```

## Local preview and production requirements

- Profiles, the organization question bank, saved exams, attempts, and audit events use browser storage. The bank and exam catalog are shared within that browser. Signed-in Sites users have separate local profiles and attempt histories.
- Workspace roles are selectable for demonstrations. Live institutional use requires server-enforced roles, organization membership, exam assignment, and isolated storage.
- The current timer, answer keys, results, and hash-linked audit run in the browser. High-stakes deployment requires server-side timing and scoring, protected paper release, and durable audit records.
- Camera and microphone monitoring starts only after browser permission. Processing stays in the current session. Media is never recorded, stored, or uploaded. The risk indicators are demonstrations.
- The assessment runner currently supports single-answer objective questions. Written, oral, practical, and file-based assessments would require additional workflows.

## Run locally

Use Node.js 22.13 or newer.

```sh
npm install
npm run dev
```

Open the local URL printed by Vinext. Run `npm test` to build the Worker and run the host and browser-module tests.
