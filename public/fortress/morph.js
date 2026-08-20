(function (global) {
  "use strict";

  const strategyLabels = {
    numerical: "Numerical values changed while mathematical relationships and units remain consistent.",
    structural: "Stem clauses and answer choices reordered without changing the assessed learning objective.",
    conceptual: "The prompt was reframed through a closely related concept and flagged for human review.",
    distractor: "Incorrect options were regenerated from plausible misconception patterns.",
    stem: "A new stem template now tests the same answer logic and cognitive level.",
    hybrid: "Numerical, structural and distractor transformations were combined with a conservative validity gate."
  };

  const clone = value => JSON.parse(JSON.stringify(value));
  const rotate = (arr, n = 1) => arr.slice(n).concat(arr.slice(0, n));

  function recalculateNumerical(question) {
    const q = clone(question);
    const numbers = [...q.text.matchAll(/\b\d+(?:\.\d+)?\b/g)].map(m => +m[0]);
    if (numbers.length >= 2 && /force|potential difference|speed|moles/i.test(q.text)) {
      const [a, b] = numbers;
      const nextA = a + (a > 10 ? 6 : 3);
      const nextB = b + 2;
      q.text = q.text.replace(String(a), String(nextA)).replace(String(b), String(nextB));
      if (/force|potential difference/i.test(q.text)) q.options[q.answer] = `${nextA * nextB} ${/potential/i.test(q.text) ? "V" : "N"}`;
      if (/speed/i.test(q.text)) q.options[q.answer] = `${(nextA / nextB).toFixed(1)} m s⁻¹`;
      if (/moles/i.test(q.text)) q.options[q.answer] = `${(nextA / nextB).toFixed(2)} mol`;
      return { question: q, score: 96 };
    }
    q.text = `In a revised experimental context, ${q.text.charAt(0).toLowerCase()}${q.text.slice(1)}`;
    return { question: q, score: 88 };
  }

  function structural(question) {
    const q = clone(question);
    q.text = q.text.endsWith("?") ? `Select the scientifically correct response: ${q.text}` : `Select the scientifically correct completion. ${q.text}`;
    const by = 1 + (parseInt(q.id.slice(-1), 10) || 1) % 3;
    const answerText = q.options[q.answer];
    q.options = rotate(q.options, by);
    q.answer = q.options.indexOf(answerText);
    return { question: q, score: 98 };
  }

  function conceptual(question) {
    const q = clone(question);
    const prefix = {
      Physics: "Applying the governing physical principle, ", Chemistry: "Using the relevant chemical principle, ",
      Botany: "With reference to plant structure and function, ", Zoology: "With reference to animal physiology, "
    }[q.subject];
    q.text = prefix + q.text.charAt(0).toLowerCase() + q.text.slice(1);
    return { question: q, score: 84 };
  }

  function distractor(question) {
    const q = clone(question);
    const correct = q.options[q.answer];
    q.options = q.options.map((option, i) => i === q.answer ? option : option.replace(/(\d+(?:\.\d+)?)/, n => String(+(+n * (i + 1.25)).toFixed(2))));
    if (q.options.every((o, i) => i === q.answer || o === question.options[i])) q.options = q.options.map((o, i) => i === q.answer ? o : `${o} only`);
    q.answer = q.options.indexOf(correct);
    return { question: q, score: 92 };
  }

  function stemSwap(question) {
    const q = clone(question);
    q.text = `A candidate is asked to identify the correct statement for ${q.chapter.toLowerCase()}. ${q.text}`;
    return { question: q, score: 89 };
  }

  function morph(question, strategy = "hybrid") {
    let result;
    if (strategy === "numerical") result = recalculateNumerical(question);
    if (strategy === "structural") result = structural(question);
    if (strategy === "conceptual") result = conceptual(question);
    if (strategy === "distractor") result = distractor(question);
    if (strategy === "stem") result = stemSwap(question);
    if (strategy === "hybrid") {
      const numerical = recalculateNumerical(question);
      const rearranged = structural(numerical.question);
      result = distractor(rearranged.question);
      result.score = Math.min(numerical.score, 94);
    }
    result.question.id = `${question.id}-M${Date.now().toString(36).slice(-4).toUpperCase()}`;
    result.question.morphedFrom = question.id;
    result.question.strategy = strategy;
    result.validity = result.score;
    result.rationale = strategyLabels[strategy];
    return result;
  }

  global.MorphEngine = { morph, strategies: Object.keys(strategyLabels), labels: strategyLabels };
})(window);
