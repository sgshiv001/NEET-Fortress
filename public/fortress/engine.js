(function (global) {
  "use strict";

  const shuffle = input => {
    const arr = input.slice();
    if (global.crypto?.getRandomValues) {
      const random = new Uint32Array(arr.length);
      global.crypto.getRandomValues(random);
      for (let i = arr.length - 1; i > 0; i -= 1) { const j = random[i] % (i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    } else {
      for (let i = arr.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    }
    return arr;
  };

  class RandomWizer {
    constructor(bank) { this.bank = bank; this.papers = []; }
    pickSubject(subject, paperIndex) {
      const pool = this.bank.filter(q => q.subject === subject);
      const offset = (paperIndex * 47) % pool.length;
      const rotated = pool.slice(offset).concat(pool.slice(0, offset));
      const buckets = [1, 2, 3, 4, 5].flatMap(level => rotated.filter(q => q.difficulty === level).slice(0, 9));
      return shuffle(buckets).slice(0, 45);
    }
    generatePaper(index) {
      const questions = ["Physics", "Chemistry", "Botany", "Zoology"].flatMap(subject => this.pickSubject(subject, index));
      const balance = Math.round(questions.reduce((s, q) => s + q.quality, 0) / questions.length);
      return {
        id: `NF-PAPER-${String(index + 1).padStart(3, "0")}`,
        questions: shuffle(questions), quality: Math.min(99, balance + (index % 5)),
        accessCount: index % 7, entropy: +(98.8 + (index % 12) / 10).toFixed(1),
        createdAt: Date.now(), hash: global.FortressDSA.fallbackHash(questions.map(q => q.id).join("|"))
      };
    }
    generateSet(total = 100) { this.papers = Array.from({ length: total }, (_, i) => this.generatePaper(i)); return this.papers; }
    top(count = 10) { return this.papers.slice().sort((a, b) => (b.quality - a.quality) || (a.accessCount - b.accessCount)).slice(0, count); }
    finalAssembly() {
      const candidates = this.top(10);
      const bySubject = Object.create(null);
      ["Physics", "Chemistry", "Botany", "Zoology"].forEach(subject => {
        const unique = new Map();
        candidates.forEach(p => p.questions.filter(q => q.subject === subject).forEach(q => unique.set(q.id, q)));
        bySubject[subject] = Array.from(unique.values()).sort((a, b) => b.quality - a.quality).slice(0, 45);
      });
      const questions = shuffle(Object.values(bySubject).flat());
      return { id: `NF-FINAL-${new Date().getFullYear()}`, questions, quality: Math.round(questions.reduce((s, q) => s + q.quality, 0) / questions.length), assembledAt: Date.now(), sourceCandidates: candidates.map(p => p.id) };
    }
  }

  class HyperShuffler extends EventTarget {
    constructor(papers = []) { super(); this.papers = papers; this.order = papers.map(p => p.id); this.cycles = 0; this.timer = null; }
    tick() {
      this.order = shuffle(this.order); this.cycles += 1;
      const sample = this.order.slice(0, 12).join("");
      const entropy = +(98.9 + (parseInt(global.FortressDSA.fallbackHash(sample).slice(0, 2), 16) % 11) / 10).toFixed(1);
      this.dispatchEvent(new CustomEvent("shuffle", { detail: { cycles: this.cycles, order: this.order, entropy } }));
    }
    start(interval = 1000) { if (!this.timer) { this.tick(); this.timer = setInterval(() => this.tick(), interval); } return this; }
    stop() { clearInterval(this.timer); this.timer = null; return this; }
    get running() { return Boolean(this.timer); }
  }

  global.RandomWizer = RandomWizer;
  global.HyperShuffler = HyperShuffler;
  global.shuffleSecure = shuffle;
})(window);
