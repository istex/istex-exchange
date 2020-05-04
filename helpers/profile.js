'use strict';

module.exports = profile;

const NS_PER_MS = 1e6;

function profile (fn, doProfile) {
  if (typeof fn !== 'function') throw new Error('fn must be a FUNCTION');
  if (!doProfile) {
    fn.report = () => `No profile for function: ${fn.name || 'NA'}`;
    return fn;
  }

  tick.executionTime = 0;
  tick.iteration = 0;
  tick.shortestIteration = Infinity;
  tick.longestIteration = 0;
  tick.report = report.bind(tick);
  tick.fn = fn;

  function tick () {
    const startTime = process.hrtime.bigint();
    const result = fn(...arguments);
    const diff = process.hrtime.bigint() - startTime;
    if (diff > tick.longestIteration) tick.longestIteration = diff;
    if (diff < tick.shortestIteration) tick.shortestIteration = diff;
    tick.executionTime = tick.executionTime + Number(diff);
    tick.iteration++;

    return result;
  }

  return tick;
}

function report () {
  return `Benchmark function: ${this.fn.name || 'NA'}\n`
         + `Total : ${this.executionTime / NS_PER_MS} ms\n`
         + `Iterations: ${this.iteration}\n`
         + `Average : ${this.executionTime / this.iteration / NS_PER_MS} mS\n`
         + `Shortest : ${Number(this.shortestIteration) / NS_PER_MS} ms\n`
         + `Longest : ${Number(this.longestIteration) / NS_PER_MS} mS\n`
    ;
}
