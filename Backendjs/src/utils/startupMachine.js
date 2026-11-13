const STAGES = Object.freeze(["connect", "schema", "columns", "indexes", "seed", "reconcile", "listen", "workers"]);
function createStartupMachine() {
  let index = -1, phase = "created";
  return {
    get phase() { return phase; },
    enter(stage) {
      const next = STAGES.indexOf(stage);
      if (phase === "failed" || next < 0 || next <= index) throw new Error(`Invalid startup transition: ${phase} -> ${stage}`);
      index = next; phase = stage;
    },
    fail() { phase = "failed"; },
  };
}
module.exports = { STAGES, createStartupMachine };
