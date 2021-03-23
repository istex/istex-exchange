'use strict';
const _ = require('lodash');


module.exports = buildCoverages;

// public
buildCoverages.issueByVolume = 'host.volume[*-*:1]>host.issue[*-*:1]';
buildCoverages.hostPublicationDateByVolumeAndIssue = 'host.volume[*-*:1]>host.publicationDate[*-*:1],host.issue[*-*:1]>host.publicationDate[*-*:1]';
buildCoverages.publicationDateByVolumeAndIssue = 'host.volume[*-*:1]>publicationDate[*-*:1],host.issue[*-*:1]>publicationDate[*-*:1]';

function buildCoverages (aggsIssueByVolume                       = [],
                         aggsHostPublicationDateByVolumeAndIssue = [],
                         aggsPublicationDateByVolumeAndIssue     = []) {

  const issueByVolume               = _.get(aggsIssueByVolume, ['host.volume', 'buckets'], []),
        hostPublicationDateByIssue  = _.get(aggsHostPublicationDateByVolumeAndIssue, ['host.issue', 'buckets'], []),
        hostPublicationDateByVolume = _.get(aggsHostPublicationDateByVolumeAndIssue, ['host.volume', 'buckets'], []),
        publicationDateByIssue      = _.get(aggsPublicationDateByVolumeAndIssue, ['host.issue', 'buckets'], []),
        publicationDateByVolume     = _.get(aggsPublicationDateByVolumeAndIssue, ['host.volume', 'buckets'], [])
  ;
  const hasIssue  = hostPublicationDateByIssue.length > 0,
        hasVolume = issueByVolume.length > 0
  ;
  if (!hasIssue && !hasVolume) { return [];}

  const coverages = [];


// only issues
  if (hasIssue && !hasVolume) {

    coverages.push({
                     num_first_issue_online : hostPublicationDateByIssue[0].key || null,
                     num_first_vol_online   : null,
                     date_first_issue_online: _getDateFirstIssue(hostPublicationDateByIssue, publicationDateByIssue),
                     num_last_issue_online  : hostPublicationDateByIssue[hostPublicationDateByIssue.length - 1].key || null,
                     num_last_vol_online    : null,
                     date_last_issue_online : _getDateLastIssue(hostPublicationDateByIssue, publicationDateByIssue)
                   });

    return coverages;
  }


// volumes and issues
  const START = 'START',
        END   = 'END'
  ;
  let searchFor = START;

  for (let volumeIndex = 0, volumesSize = issueByVolume.length, volumesLastIndex = volumesSize - 1;
       volumeIndex <= volumesLastIndex;
       volumeIndex += 1
  ) {

    let issuesDocCountSum = 0;
    for (let i = 0; i <= issueByVolume[volumeIndex]['host.issue'].buckets.length - 1; i += 1) {
      issuesDocCountSum += issueByVolume[volumeIndex]['host.issue'].buckets[i].docCount;
    }

    if (searchFor === START) {

      if (issueByVolume[volumeIndex].docCount === 0) { continue;}

      // Has documents but no issue or no consistency between volume doc count and issues doc count
      if (
        issueByVolume[volumeIndex]['host.issue'].buckets.length === 0
        || issueByVolume[volumeIndex].docCount !== issuesDocCountSum
      ) {
        coverages.push({
                         num_first_issue_online :_hasFirstIssue(issueByVolume, volumeIndex)?1:null,
                         num_first_vol_online   : issueByVolume[volumeIndex].key,
                         date_first_issue_online: _getDateFirstIssueByVolume(volumeIndex,
                                                                             hostPublicationDateByVolume,
                                                                             publicationDateByVolume),
                         num_last_issue_online  : null,
                         num_last_vol_online    : null,
                         date_last_issue_online : null
                       });

        searchFor = END;
        continue;
      }
    }

    if (searchFor === END) {
      // volume empty
      if (issueByVolume[volumeIndex].docCount === 0) {
        let currentCoverage = coverages[coverages.length - 1];
        currentCoverage.num_last_issue_online = _getLastIssue(issueByVolume[volumeIndex - 1]);
        currentCoverage.num_last_vol_online = issueByVolume[volumeIndex - 1].key;
        currentCoverage.date_last_issue_online = _getDateLastIssueByVolume(volumeIndex - 1,
                                                                           hostPublicationDateByVolume,
                                                                           publicationDateByVolume);
        searchFor = START;
        continue;
      }

      // Has documents but no issue or no consistency between volume doc count and issues doc count
      if (issueByVolume[volumeIndex]['host.issue'].buckets.length === 0
          || issueByVolume[volumeIndex].docCount !== issuesDocCountSum
      ) {
        if (volumeIndex === volumesLastIndex) {
          let currentCoverage = coverages[coverages.length - 1];
          currentCoverage.num_last_issue_online = null;
          currentCoverage.num_last_vol_online = issueByVolume[volumeIndex].key;
          currentCoverage.date_last_issue_online = _getDateLastIssueByVolume(volumeIndex,
                                                                             hostPublicationDateByVolume,
                                                                             publicationDateByVolume);
          searchFor = START; // only for logic coz its the last iteration
        }

        continue;
      }

      // no first issue
      if (_.chain(issueByVolume[volumeIndex]['host.issue'].buckets)
           .first()
           .get('key')
           .value() !== 1) {
        let currentCoverage = coverages[coverages.length - 1];
        currentCoverage.num_last_issue_online = _getLastIssue(issueByVolume[volumeIndex - 1]);
        currentCoverage.num_last_vol_online = issueByVolume[volumeIndex - 1].key;
        currentCoverage.date_last_issue_online = _getDateLastIssueByVolume(volumeIndex - 1,
                                                                           hostPublicationDateByVolume,
                                                                           publicationDateByVolume);
        searchFor = START;
      }
    }


    for (let issueIndex      = 0,
             issues          = issueByVolume[volumeIndex]['host.issue'].buckets,
             issuesSize      = issues.length,
             issuesLastIndex = issuesSize - 1;
         issueIndex <= issuesLastIndex;
         issueIndex += 1
    ) {
      if (searchFor === START) {
        if (issueByVolume[volumeIndex]['host.issue'].buckets[issueIndex].docCount > 0) {
          coverages.push({
                           num_first_issue_online : issueByVolume[volumeIndex]['host.issue'].buckets[issueIndex].key,
                           num_first_vol_online   : issueByVolume[volumeIndex].key,
                           date_first_issue_online: _getDateFirstIssueByVolume(volumeIndex,
                                                                               hostPublicationDateByVolume,
                                                                               publicationDateByVolume),
                           num_last_issue_online  : null,
                           num_last_vol_online    : null,
                           date_last_issue_online : null
                         });

          searchFor = END;
          continue;
        }
      }

      if (searchFor === END) {
        if (issueByVolume[volumeIndex]['host.issue'].buckets[issueIndex].docCount === 0) {
          let currentCoverage = coverages[coverages.length - 1];
          currentCoverage.num_last_issue_online = _getLastValidIssue(issueByVolume[volumeIndex], issueIndex);
          currentCoverage.num_last_vol_online = issueByVolume[volumeIndex].key;
          currentCoverage.date_last_issue_online = _getIssueDate(volumeIndex,
                                                                 issueIndex === issuesLastIndex,
                                                                 hostPublicationDateByVolume,
                                                                 publicationDateByVolume);
          searchFor = START;
          continue;
        }

        if (volumeIndex === volumesLastIndex && issueIndex === issuesLastIndex) {
          let currentCoverage = coverages[coverages.length - 1];
          currentCoverage.num_last_issue_online = issueByVolume[volumeIndex]['host.issue'].buckets[issueIndex].key;
          currentCoverage.num_last_vol_online = issueByVolume[volumeIndex].key;
          currentCoverage.date_last_issue_online = _getDateLastIssueByVolume(volumeIndex,
                                                                             hostPublicationDateByVolume,
                                                                             publicationDateByVolume);

        }
      }

    }

  }

  return coverages;

}

// private helpers
function _hasFirstIssue (issueByVolume, volumeIndex) {
  return _.get(issueByVolume,
               [volumeIndex,
                'host.issue',
                'buckets',
                0,
                'key']) ===1;
}
function _getDateLastIssueByVolume (index, hostPublicationDateByVolume, publicationDateByVolume) {
  return _.chain(hostPublicationDateByVolume[index]['host.publicationDate'].buckets)
          .last()
          .get('keyAsString', _.chain(publicationDateByVolume[index]['publicationDate'].buckets)
                               .last()
                               .get('keyAsString', null)
                               .value())
          .value()
    ;
}

function _getDateFirstIssueByVolume (index, hostPublicationDateByVolume, publicationDateByVolume) {
  return _.get(hostPublicationDateByVolume[index]['host.publicationDate'].buckets,
               '0.keyAsString',
               _.get(publicationDateByVolume[index]['publicationDate'].buckets,
                     '0.keyAsString',
                     null));
}

function _getDateFirstIssue (hostPublicationDateByIssue, publicationDateByIssue) {
  return _.get(hostPublicationDateByIssue[0]['host.publicationDate'].buckets,
               '0.keyAsString',
               _.get(publicationDateByIssue[0]['publicationDate'].buckets,
                     '0.keyAsString',
                     null));
}

function _getDateLastIssue (hostPublicationDateByIssue, publicationDateByIssue) {
  return _.chain(hostPublicationDateByIssue)
          .last()
          .get(['host.publicationDate', 'buckets'])
          .last()
          .get('keyAsString', _.chain(publicationDateByIssue)
                               .last()
                               .get(['publicationDate', 'buckets'])
                               .last()
                               .get('keyAsString', null)
                               .value())
          .value();
}

function _getFirstIssue (issueByVolumeBucket) {
  if (issueByVolumeBucket['host.issue'].keyCount === 0) return null;
  return issueByVolumeBucket['host.issue'].buckets[0].key;
}

function _getLastIssue (issueByVolumeBucket) {
  if (issueByVolumeBucket['host.issue'].keyCount === 0) return null;
  return issueByVolumeBucket['host.issue'].buckets[issueByVolumeBucket['host.issue'].buckets.length - 1].key;
}

function _getLastValidIssue (issueByVolumeBucket, fromIssue = 0) {
  if (issueByVolumeBucket['host.issue'].keyCount === 0) return null;
  return issueByVolumeBucket['host.issue'].buckets[fromIssue - 1].key;
}

function _getIssueDate (index, isLastIssue, hostPublicationDateByVolume, publicationDateByVolume) {
  const position = isLastIssue ? 'last' : 'first';
  return _.chain(hostPublicationDateByVolume[index]['host.publicationDate'].buckets)
    [position]()
    .get('keyAsString', _.chain(publicationDateByVolume[index]['publicationDate'].buckets)
      [position]()
      .get('keyAsString', null)
      .value())
    .value()
    ;
}
