'use strict';
const _ = require('lodash');

module.exports = buildCoverages;

buildCoverages.issueByVolumeQuery = 'host.volume[*-*:1]>host.issue[*-*:1],host.issue[*-*:1]>host.publicationDate[*-*:1]';
buildCoverages.publicationDateByVolumeQuery = 'host.volume[*-*:1]>host.publicationDate[*-*:1]';

function buildCoverages (aggsIssueByVolume = [], aggsPublicationDateByVolume = []) {
  const issueByVolume           = _.get(aggsIssueByVolume, ['host.volume', 'buckets'], []),
        hostPublicationDateByissue  = _.get(aggsIssueByVolume, ['host.issue', 'buckets'], []),
        hostPublicationDateByVolume = _.get(aggsPublicationDateByVolume, ['host.volume', 'buckets'], [])
  ;

  const hasIssue  = hostPublicationDateByissue.length > 0,
        hasVolume = issueByVolume.length > 0
  ;

  if (!hasIssue && !hasVolume) return [];

  const coverages = [];


// only issues
  if (hasIssue && !hasVolume) {

    coverages.push({
                     first_issue     : hostPublicationDateByissue[0].key || null,
                     first_volume    : null,
                     date_first_issue: _.get(hostPublicationDateByissue[0]['host.publicationDate'].buckets,
                                             '0.keyAsString',
                                             null),
                     last_issue      : hostPublicationDateByissue[hostPublicationDateByissue.length - 1].key || null,
                     last_volume     : null,
                     date_last_issue : _.chain(hostPublicationDateByissue)
                                        .last()
                                        .get(['host.publicationDate', 'buckets'])
                                        .last()
                                        .get('keyAsString', null)
                                        .value()
                   });

    return coverages;
  }

// volumes
  const START = 'START',
        END   = 'END'
  ;
  let searchFor = START;

  for (let i = 0; i < issueByVolume.length; ++i) {

    if (searchFor === START) {
      if (issueByVolume[i].docCount > 0) {

        coverages.push({
                         first_issue     : hasIssue ? _searchFirstIssue(issueByVolume[i]) : null,
                         first_volume    : issueByVolume[i].key,
                         date_first_issue: _.get(hostPublicationDateByVolume[i]['host.publicationDate'].buckets,
                                                 '0.keyAsString',
                                                 null),
                         last_issue      : null,
                         last_volume     : null,
                         date_last_issue : null
                       });

        searchFor = END;

        if (i === issueByVolume.length - 1) {
          let currentCoverage = coverages[coverages.length - 1];
          currentCoverage.last_issue = hasIssue ? _searchLastIssue(issueByVolume[i]) : null;
          currentCoverage.last_volume = currentCoverage.first_volume;
          currentCoverage.date_last_issue = _.chain(hostPublicationDateByVolume[i]['host.publicationDate'].buckets)
                                             .last()
                                             .get('keyAsString', null)
                                             .value();

        }
      }

      continue;
    }

    if (searchFor === END) {
      if (issueByVolume[i].docCount === 0) {
        let currentCoverage = coverages[coverages.length - 1];
        currentCoverage.last_issue = hasIssue ? _searchLastIssue(issueByVolume[i - 1]) : null;
        currentCoverage.last_volume = issueByVolume[i - 1].key;
        currentCoverage.date_last_issue = _.chain(hostPublicationDateByVolume[i - 1]['host.publicationDate'].buckets)
                                           .last()
                                           .get('keyAsString', null)
                                           .value();
        searchFor = START;
        continue;
      }

      if (i === issueByVolume.length - 1) {
        let currentCoverage = coverages[coverages.length - 1];
        currentCoverage.last_issue = hasIssue ? _searchLastIssue(issueByVolume[i]) : null;
        currentCoverage.last_volume = issueByVolume[i].key;
        currentCoverage.date_last_issue = _.chain(hostPublicationDateByVolume[i]['host.publicationDate'].buckets)
                                           .last()
                                           .get('keyAsString', null)
                                           .value();

        searchFor = START;
        continue;
      }

      continue;
    }
  }

  return coverages;

}

function _searchFirstIssue (issueByVolumeBucket = {}) {
  if (issueByVolumeBucket['host.issue'].keyCount === 0) return null;
  return issueByVolumeBucket['host.issue'].buckets[0].key;
}

function _searchLastIssue (issueByVolumeBucket = {}) {
  if (issueByVolumeBucket['host.issue'].keyCount === 0) return null;
  return issueByVolumeBucket['host.issue'].buckets[issueByVolumeBucket['host.issue'].keyCount - 1].key;
}
