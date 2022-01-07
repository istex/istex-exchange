'use strict';
const _ = require('lodash');
const { URL } = require('url');
const stringify = require('csv-stringify');
const { fields } = require('./kbartModel');
const {
  model,
  SERIAL,
  MONOGRAPH,
  issnShape,
  syndicationFromModel,
} = require('./reviewModel');
const {
  getMonographVolume,
  getDateMonographPublishedPrint,
  getDateMonographPublishedOnline,
} = require('./monographHelpers')
;

module.exports.toKbart = function ({ header = true } = {}) {
  const stringifier = stringify({ header, delimiter: '\t', columns: fields });
  return function (s) {
    return s.map((exchangeData) => {
      return _unfoldCoverages(_exchangeDataToJsKbart(exchangeData));
    })
      .flatten()
      .through(stringifier)
      .map((buffer) => buffer.toString())
    ;
  };
};

//
// private helpers
//

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

function _exchangeDataToJsKbart ({ coverages, reviewData, apiResult, reviewUrl }) {
  const titleUrl = new URL(reviewUrl);
  titleUrl.pathname = reviewData[model.uri];

  return {
    _coverages: coverages,
    publication_title: reviewData[model.title],
    publication_type: reviewData[model.type],
    coverage_depth: 'fulltext',
    print_identifier: reviewData[model.type] === SERIAL ? reviewData[model.issn] : reviewData[model.isbn],
    online_identifier: reviewData[model.type] === SERIAL ? reviewData[model.eIssn] : reviewData[model.eIsbn],
    title_url: titleUrl.toString(),
    first_author: _takeFirstAuthor(reviewData),
    title_id: reviewData[model.uri],
    notes: _tagFollowedBy(reviewData[model.followedBy]),
    parent_publication_title_id: _findTitleId(reviewData[model.parentPublicationTitleId]),
    preceding_publication_title_id: _findTitleId(reviewData[model.precededBy]),
    access_type: reviewData[model.rights],
    publisher_name: reviewData[model.publisher],
    monograph_volume: getMonographVolume(reviewData, apiResult),
    date_monograph_published_print: getDateMonographPublishedPrint(reviewData, apiResult),
    date_monograph_published_online: getDateMonographPublishedOnline(reviewData, apiResult),
  };
}

function _takeFirstAuthor (reviewData) {
  if (reviewData[model.type] !== MONOGRAPH || _.isEmpty(reviewData[model.contributor])) { return; }

  return reviewData[model.contributor].split(',')[0];
}

function _tagFollowedBy (value) {
  let titleId;
  if (!(titleId = _findTitleId(value))) { return ''; }
  return `followed by: ${titleId}`;
}

function _findTitleId (value) {
  if (typeof value !== 'string' || value === '' || !value.startsWith(syndicationFromModel)) { return null; }
  return value.slice(-issnShape.length);
}
