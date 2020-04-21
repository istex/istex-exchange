'use strict';
const _ = require('lodash');

module.exports = buildCoverage;

buildCoverage.volumeMatchIssueCount = 0;

function buildCoverage (aggs) {

  const volumeAggs = _(aggs).get(['host.volume', 'buckets'], []);
  console.dir(volumeAggs, {depth: 10});
  if (!(volumeAggs && volumeAggs.length)) return [];
  let done = false
  ;

  const coverage = [];

  while (!done) {

    const startCoverageIndex = volumeAggs.findIndex(bucket => bucket.docCount);
    if (startCoverageIndex === -1) {
      done = true;
      continue;
    }
    const startCoverageVolume = volumeAggs[startCoverageIndex].key;
    const coveragePair = [startCoverageVolume];

    if (volumeAggs[startCoverageIndex].docCount === volumeAggs[startCoverageIndex]['host.issue'].buckets[0].docCount) {
      buildCoverage.volumeMatchIssueCount++;
    }
    volumeAggs.splice(0, startCoverageIndex + 1);

    if (volumeAggs.length === 0) {
      coveragePair.push(startCoverageVolume);
      coverage.push(coveragePair);
      done = true;
      continue;
    }

    const endCoverageIndex = volumeAggs.findIndex(volume => !volume.docCount);
    if (endCoverageIndex === -1) {
      coveragePair.push(volumeAggs[volumeAggs.length - 1].key);
      coverage.push(coveragePair);
      done = true;
      continue;
    }

    const endCoverageVolume = volumeAggs[endCoverageIndex].key;
    coveragePair.push(endCoverageVolume);
    coverage.push(coveragePair);
    volumeAggs.splice(0, endCoverageIndex + 1);
  }


  return coverage;
}
