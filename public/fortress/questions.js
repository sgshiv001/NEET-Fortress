(function (global) {
  "use strict";

  const chapters = {
    Physics: ["Units and Measurements", "Motion in a Straight Line", "Laws of Motion", "Work, Energy and Power", "Gravitation", "Thermodynamics", "Electrostatics", "Current Electricity", "Magnetism", "Ray Optics", "Wave Optics", "Atoms and Nuclei"],
    Chemistry: ["Mole Concept", "Atomic Structure", "Chemical Bonding", "Thermodynamics", "Equilibrium", "Electrochemistry", "Chemical Kinetics", "Coordination Compounds", "Hydrocarbons", "Alcohols and Ethers", "Amines", "Biomolecules"],
    Botany: ["Cell: The Unit of Life", "Plant Kingdom", "Morphology of Flowering Plants", "Anatomy of Flowering Plants", "Photosynthesis", "Respiration in Plants", "Plant Growth", "Sexual Reproduction in Plants", "Inheritance", "Molecular Basis of Inheritance", "Ecology", "Biodiversity"],
    Zoology: ["Animal Kingdom", "Structural Organisation", "Digestion", "Breathing", "Body Fluids", "Excretion", "Neural Control", "Chemical Coordination", "Human Reproduction", "Human Health", "Evolution", "Biotechnology"]
  };

  const stems = {
    Physics: [
      ["A body of mass {a} kg accelerates at {b} m s⁻². What net force acts on it?", n => [`${n.a * n.b} N`, `${n.a + n.b} N`, `${Math.abs(n.a - n.b)} N`, `${n.a * n.b * 2} N`], 0],
      ["A resistor of {a} Ω carries a current of {b} A. The potential difference across it is", n => [`${n.a * n.b} V`, `${n.a / n.b} V`, `${n.a + n.b} V`, `${n.b / n.a} V`], 0],
      ["An object moves {a} m in {b} s at uniform speed. Its speed is", n => [`${(n.a / n.b).toFixed(1)} m s⁻¹`, `${n.a * n.b} m s⁻¹`, `${n.a + n.b} m s⁻¹`, `${(n.b / n.a).toFixed(1)} m s⁻¹`], 0],
      ["The dimensional formula of force is", () => ["[MLT⁻²]", "[ML²T⁻²]", "[ML⁻¹T⁻²]", "[M⁰LT⁻¹]"], 0],
      ["For a projectile launched horizontally, which quantity remains constant if air resistance is ignored?", () => ["Horizontal velocity", "Vertical velocity", "Speed", "Kinetic energy"], 0]
    ],
    Chemistry: [
      ["How many moles are present in {a} g of a substance with molar mass {b} g mol⁻¹?", n => [`${(n.a / n.b).toFixed(2)} mol`, `${(n.a * n.b).toFixed(0)} mol`, `${(n.b / n.a).toFixed(2)} mol`, `${(n.a + n.b).toFixed(0)} mol`], 0],
      ["Which orbital is filled immediately after 3p according to the Aufbau principle?", () => ["4s", "3d", "4p", "5s"], 0],
      ["The oxidation number of oxygen in most compounds is", () => ["−2", "+2", "−1", "0"], 0],
      ["Increasing pressure shifts a gaseous equilibrium toward the side with", () => ["Fewer moles of gas", "More moles of gas", "Higher temperature", "More catalyst"], 0],
      ["Which species acts as a Lewis acid?", () => ["BF₃", "NH₃", "OH⁻", "H₂O"], 0]
    ],
    Botany: [
      ["The light-dependent reactions of photosynthesis occur mainly in the", () => ["Thylakoid membranes", "Stroma", "Cytosol", "Mitochondrial matrix"], 0],
      ["Which tissue transports water and minerals upward in vascular plants?", () => ["Xylem", "Phloem", "Cambium", "Cork"], 0],
      ["A typical angiosperm embryo sac is", () => ["7-celled and 8-nucleate", "8-celled and 7-nucleate", "4-celled and 8-nucleate", "8-celled and 8-nucleate"], 0],
      ["The primary CO₂ acceptor in C₄ plants is", () => ["PEP", "RuBP", "PGA", "OAA"], 0],
      ["Which plant hormone primarily promotes cell elongation?", () => ["Auxin", "Abscisic acid", "Ethylene", "Cytokinin only"], 0]
    ],
    Zoology: [
      ["The functional unit of the human kidney is the", () => ["Nephron", "Neuron", "Alveolus", "Villus"], 0],
      ["Oxygen is transported in human blood mainly as", () => ["Oxyhaemoglobin", "Dissolved oxygen", "Bicarbonate", "Carbaminohaemoglobin"], 0],
      ["Which hormone lowers blood glucose concentration?", () => ["Insulin", "Glucagon", "Adrenaline", "Cortisol"], 0],
      ["The pacemaker of the human heart is the", () => ["SA node", "AV node", "Bundle of His", "Purkinje fibres"], 0],
      ["Antibodies are secreted by", () => ["Plasma cells", "Helper T cells", "Macrophages", "Neutrophils"], 0]
    ]
  };

  function seededNumber(seed, min, max) {
    const x = Math.sin(seed * 999.91) * 43758.5453;
    return min + Math.floor((x - Math.floor(x)) * (max - min + 1));
  }

  function rotate(values, by) {
    const n = by % values.length;
    return values.slice(n).concat(values.slice(0, n));
  }

  function makeQuestion(index, subject, localIndex) {
    const template = stems[subject][localIndex % stems[subject].length];
    const a = seededNumber(index + 1, 4, 72);
    const b = seededNumber(index + 19, 2, 12);
    const nums = { a: a - (a % b) || b * 2, b };
    const text = template[0].replace("{a}", nums.a).replace("{b}", nums.b);
    const rawOptions = template[1](nums);
    const rotation = localIndex % 4;
    const options = rotate(rawOptions, rotation);
    const answer = (template[2] - rotation + 8) % 4;
    const difficulty = 1 + (localIndex % 5);
    const id = `NF-${subject.slice(0, 2).toUpperCase()}-${String(localIndex + 1).padStart(4, "0")}`;
    return {
      id,
      subject,
      chapter: chapters[subject][localIndex % chapters[subject].length],
      text,
      options,
      answer,
      difficulty,
      discrimination: +(0.26 + ((localIndex * 7) % 55) / 100).toFixed(2),
      bloom: ["Remember", "Understand", "Apply", "Analyse", "Evaluate"][difficulty - 1],
      quality: 72 + ((localIndex * 11) % 27),
      source: localIndex % 9 === 0 ? "PYQ-aligned" : "Verified contributor",
      exposure: (localIndex * 3) % 7
    };
  }

  function generate(count = 924) {
    const subjects = Object.keys(chapters);
    const bank = [];
    for (let i = 0; i < count; i += 1) {
      const subject = subjects[i % subjects.length];
      bank.push(makeQuestion(i, subject, Math.floor(i / subjects.length)));
    }
    return bank;
  }

  global.QuestionBank = {
    chapters,
    generate,
    questions: generate(924),
    get(id) { return this.questions.find(q => q.id === id); },
    stats() {
      return Object.keys(chapters).map(subject => ({
        subject,
        count: this.questions.filter(q => q.subject === subject).length,
        averageQuality: Math.round(this.questions.filter(q => q.subject === subject).reduce((s, q) => s + q.quality, 0) / this.questions.filter(q => q.subject === subject).length)
      }));
    }
  };
})(window);
