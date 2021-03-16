'use strict';

const reviewClient           = require('./client').getReviewClient(),
      {istex, app}           = require('@istex/config-component').get(module),
      {model}                = require('./reviewModel'),
      {URL, URLSearchParams} = require('url'),
      {pickBy}               = require('lodash'),
      hl                     = require('highland'),
      {parser}               = require('stream-json'),
      {streamArray}          = require('stream-json/streamers/StreamArray'),
      {pick}                 = require('stream-json/filters/Pick'),
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
                                                  [model.uri]   : uri,
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
    .stopOnError((error, push) => {
      const requestUrl = decodeURIComponent(reviewUrl.toString());
      const verror = VError({cause: error, name: 'ReviewRequestError', info: {reviewUrl}},
                            'Error requesting: %s',
                            requestUrl);
      push(verror);

    })
    .map(hl.get('value'));
}

function _isNotAnEmptyString (value) {
  return typeof value === 'string' && value.length > 1;
}
