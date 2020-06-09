'use strict';

const reviewClient           = require('./client').getReviewClient(),
      {istex, app}           = require('config-component').get(module),
      {model}                = require('./dataModel'),
      {URL, URLSearchParams} = require('url'),
      {pickBy}               = require('lodash'),
      hl                     = require('highland'),
      {parser}               = require('stream-json'),
      {streamArray}          = require('stream-json/streamers/StreamArray'),
      {pick}                 = require('stream-json/filters/Pick'),
      {logError}             = require('../helpers/logger'),
      VError                 = require('verror')
;


module.exports.findDocumentsBy = findDocumentsBy;

/*
 * @return {Object} return highland stream
 */
function findDocumentsBy ({uri, type, corpus, title, maxSize} = {}) {
  maxSize = typeof maxSize === 'number' ? maxSize.toString() : maxSize;

  const reviewUrl = new URL('api/run/all-documents', istex.review.url);
  reviewUrl.search = new URLSearchParams(pickBy({
                                                  'uri'         : uri,
                                                  [model.type]  : type,
                                                  [model.corpus]: corpus,
                                                  [model.title] : title,
                                                  'maxSize'     : maxSize,
                                                  'sid'         : app.sid
                                                }, _isNotAnEmptyString));
  return hl(reviewClient.stream(reviewUrl))
    .through(parser())
    .through(pick({filter: 'data'}))
    .through(streamArray())
    .stopOnError(error => {
      const requestUrl = decodeURIComponent(reviewUrl.toString());
      logError(VError({cause: error, name: 'ReviewRequestError', info: {reviewUrl}},
                      'Error requesting: %s',
                      requestUrl));
    })
    .map(hl.get('value'));
}

function _isNotAnEmptyString (value) {
  return typeof value === 'string' && value.length > 1;
}
