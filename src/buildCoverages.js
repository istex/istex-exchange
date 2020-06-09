'use strict';
const _ = require('lodash');


module.exports = buildCoverages;

// public
buildCoverages.issueByVolume = 'host.volume[*-*:1]>host.issue[*-*:1]';
buildCoverages.hostPublicationDateByVolumeAndIssue = 'host.volume[*-*:1]>host.publicationDate[*-*:1],host.issue[*-*:1]>host.publicationDate[*-*:1]';
buildCoverages.publicationDateByVolumeAndIssue = 'host.volume[*-*:1]>publicationDate[*-*:1],host.issue[*-*:1]>publicationDate[*-*:1]';

function buildCoverages (aggsIssueByVolume = [], aggsHostPublicationDateByVolumeAndIssue = [], aggsPublicationDateByVolumeAndIssue = []) {
  const issueByVolume               = _.get(aggsIssueByVolume, ['host.volume', 'buckets'], []),
        hostPublicationDateByIssue  = _.get(aggsHostPublicationDateByVolumeAndIssue, ['host.issue', 'buckets'], []),
        hostPublicationDateByVolume = _.get(aggsHostPublicationDateByVolumeAndIssue, ['host.volume', 'buckets'], []),
        publicationDateByIssue      = _.get(aggsPublicationDateByVolumeAndIssue, ['host.issue', 'buckets'], []),
        publicationDateByVolume     = _.get(aggsPublicationDateByVolumeAndIssue, ['host.volume', 'buckets'], [])
  ;

  const hasIssue  = hostPublicationDateByIssue.length > 0,
        hasVolume = issueByVolume.length > 0
  ;

  if (!hasIssue && !hasVolume) return [];

  const coverages = [];


// only issues
  if (hasIssue && !hasVolume) {

    coverages.push({
                     num_first_issue_online     : hostPublicationDateByIssue[0].key || null,
                     num_first_vol_online    : null,
                     date_first_issue_online: _getDateFirstIssue(hostPublicationDateByIssue, publicationDateByIssue),
                     num_last_issue_online      : hostPublicationDateByIssue[hostPublicationDateByIssue.length - 1].key || null,
                     num_last_vol_online     : null,
                     date_last_issue_online : _getDateLastIssue(hostPublicationDateByIssue, publicationDateByIssue)
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
                         num_first_issue_online     : hasIssue ? _searchFirstIssue(issueByVolume[i]) : null,
                         num_first_vol_online    : issueByVolume[i].key,
                         date_first_issue_online: _getDateFirstIssueByVolume(i,
                                                                      hostPublicationDateByVolume,
                                                                      publicationDateByVolume),
                         num_last_issue_online      : null,
                         num_last_vol_online     : null,
                         date_last_issue_online : null
                       });

        searchFor = END;

        if (i === issueByVolume.length - 1) {
          let currentCoverage = coverages[coverages.length - 1];
          currentCoverage.num_last_issue_online = hasIssue ? _searchLastIssue(issueByVolume[i]) : null;
          currentCoverage.num_last_vol_online = currentCoverage.num_first_vol_online;
          currentCoverage.date_last_issue_online = _getDateLastIssueByVolume(i,
                                                                      hostPublicationDateByVolume,
                                                                      publicationDateByVolume);

        }
      }

      continue;
    }

    if (searchFor === END) {
      if (issueByVolume[i].docCount === 0) {
        let currentCoverage = coverages[coverages.length - 1];
        currentCoverage.num_last_issue_online = hasIssue ? _searchLastIssue(issueByVolume[i - 1]) : null;
        currentCoverage.num_last_vol_online = issueByVolume[i - 1].key;
        currentCoverage.date_last_issue_online = _getDateLastIssueByVolume(i - 1,
                                                                    hostPublicationDateByVolume,
                                                                    publicationDateByVolume);
        searchFor = START;
        continue;
      }


      if (i === issueByVolume.length - 1) {
        let currentCoverage = coverages[coverages.length - 1];
        currentCoverage.num_last_issue_online = hasIssue ? _searchLastIssue(issueByVolume[i]) : null;
        currentCoverage.num_last_vol_online = issueByVolume[i].key;
        currentCoverage.date_last_issue_online =  _getDateLastIssueByVolume(i, hostPublicationDateByVolume, publicationDateByVolume);

        searchFor = START;
        continue;
      }

      continue;
    }
  }

  return coverages;

}

// private helpers
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

function _searchFirstIssue (issueByVolumeBucket = {}) {
  if (issueByVolumeBucket['host.issue'].keyCount === 0) return null;
  return issueByVolumeBucket['host.issue'].buckets[0].key;
}

function _searchLastIssue (issueByVolumeBucket = {}) {
  if (issueByVolumeBucket['host.issue'].keyCount === 0) return null;
  return issueByVolumeBucket['host.issue'].buckets[issueByVolumeBucket['host.issue'].keyCount - 1].key;
}
