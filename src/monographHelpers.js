'use strict';

const _ = require('lodash');
const { model, MONOGRAPH } = require('./reviewModel')
;

module.exports = {
  getMonographVolume,
  getDateMonographPublishedOnline,
  getDateMonographPublishedPrint,
};

/*
 * @param reviewData Object
 * @param apiResult Object
 */
function getMonographVolume ({ [model.type]: type }, apiResult) {
  if (type !== MONOGRAPH) return null;
  // we try to get volume number even if the initial data is not mere number
  const volume = parseInt(_.get(apiResult, 'hits.0.host.volume', null));
  if (isNaN(volume)) return null;

  return volume;
}

/*
 * @param reviewData Object
 * @param apiResult Object
 */
function getDateMonographPublishedPrint ({ [model.type]: type, [model.isbn]: isbn, [model.eIsbn]: eIsbn }, apiResult) {
  if (type !== MONOGRAPH) return null;

  const monographDate = _.get(apiResult,
    'hits.0.host.publicationDate',
    _.get(apiResult, 'hits.0.publicationDate', null),
  );

  return monographDate;
}

/*
 * @param reviewData Object
 * @param apiResult Object
 */
function getDateMonographPublishedOnline ({ [model.type]: type, [model.eIsbn]: eIsbn }, apiResult) {
  if (type !== MONOGRAPH) return null;

  const monographDate = _.get(apiResult,
    'hits.0.host.publicationDate',
    _.get(apiResult, 'hits.0.publicationDate', null),
  );

  // a bit of guessing, probably not the best way
  if (!monographDate?.startsWith?.('20') && !monographDate?.startsWith?.('21')) return null;

  return monographDate;
}
