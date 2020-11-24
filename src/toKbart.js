'use strict';
const _         = require('lodash'),
      {URL}     = require('url'),
      stringify = require('csv-stringify'),
      {fields}  = require('./kbartModel'),
      {
        model,
        SERIAL,
        MONOGRAPH,
        issnShape,
        syndicationFromModel
      }         = require('./reviewModel')
;


module.exports.toKbart = function({header = true} = {}) {
  const stringifier = stringify({header, delimiter: '\t', columns: fields});
  return function(s) {
    return s.map((exchangeData) => {
              return _unfoldCoverages(_exchangeDataToJsKbart(exchangeData));
            })
            .flatten()
            .through(stringifier)
            .map((buffer) => buffer.toString())
      ;
  };
};

// private helpers

// Create one jsKbart by coverages entry
function _unfoldCoverages (jsKbart) {
  if (!_.get(jsKbart, ['_coverages', 'length'], false)) return _.omit(jsKbart, ['_coverages']);
  return _.chain(jsKbart._coverages)
          .transform((result, coverage) => {
                       const unfoldCoverage = _.chain(jsKbart)
                                               .omit(['_coverages'])
                                               .assign(coverage)
                                               .value()
                       ;
                       result.push(unfoldCoverage);
                     },
                     [])
          .value();

}

function _exchangeDataToJsKbart ({coverages, reviewData, apiResult, reviewUrl}) {

  const titleUrl = new URL(reviewUrl);
  titleUrl.pathname = reviewData[model.uri];

  return {
    _coverages                     : coverages,
    publication_title              : reviewData[model.title],
    publication_type               : reviewData[model.type],
    coverage_depth                 : 'fulltext',
    print_identifier               : reviewData[model.type] === SERIAL ? reviewData[model.issn] : reviewData[model.isbn],
    online_identifier              : reviewData[model.type] === SERIAL ? reviewData[model.eIssn] : reviewData[model.eIsbn],
    title_url                      : titleUrl.toString(),
    first_author                   : reviewData[model.type] === MONOGRAPH && reviewData[model.contributor] || null,
    title_id                       : reviewData[model.titleId],
    notes                          : _tagFollowedBy(reviewData[model.followedBy]),
    parent_publication_title_id    : _findTitleId(reviewData[model.parentPublicationTitleId]),
    preceding_publication_title_id : _findTitleId(reviewData[model.precededBy]),
    access_type                    : reviewData[model.rights],
    publisher_name                 : reviewData[model.publisher],
    monograph_volume               : _getMonographVolume(reviewData, apiResult),
    date_monograph_published_print : _getDateMonographPublishedPrint(reviewData, apiResult),
    date_monograph_published_online: _getDateMonographPublishedOnline(reviewData, apiResult)
  };
}

function _tagFollowedBy (value) {
  let titleId;
  if (!(titleId = _findTitleId(value))) return '';
  return `followed by: ${titleId}`;
}

function _findTitleId (value) {
  if (typeof value !== 'string' || value === '' || !value.startsWith(syndicationFromModel)) return null;
  return value.slice(-issnShape.length);
}

function _getMonographVolume ({[model.type]: type}, apiResult) {
  if (type !== MONOGRAPH) return null;
  // we try to get volume number even if the initial data is not mere number
  const volume = parseInt(_.get(apiResult, 'hits.0.host.volume', null));
  if (isNaN(volume)) return null;

  return volume;
}

function _getDateMonographPublishedPrint ({[model.type]: type, [model.isbn]: isbn, [model.eIsbn]: eIsbn}, apiResult) {
  if (type !== MONOGRAPH || !isbn) return null;
  let monographDate = _.get(apiResult, 'hits.0.publicationDate', null);

  // If we can't find publicationDate and the doc doesn't seems to have been published electonically, we check
  // the host publicationDate
  if (!monographDate && !eIsbn) {
    monographDate = _.get(apiResult, 'hits.0.host.publicationDate', null);
  }

  return monographDate;
}

function _getDateMonographPublishedOnline ({[model.type]: type, [model.eIsbn]: eIsbn}, apiResult) {
  if (type !== MONOGRAPH || !eIsbn) return null;
  const monographDate = _.get(apiResult,
                              'hits.0.host.publicationDate',
                              _.get(apiResult, 'hits.0.publicationDate', null)
  );

  // a bit of guessing, probably not the best way
  if (!monographDate.startsWith('20') && !monographDate.startsWith('21')) return null;

  return monographDate;
}
