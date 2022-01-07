'use strict';

const { istex } = require('@istex/config-component').get(module);
const got = require('got');
const _ = require('lodash');
const VError = require('verror')
;
const CacheableLookup = require('cacheable-lookup');

const cacheable = istex.api.useCacheLookup ? new CacheableLookup() : false;

module.exports.getReviewClient = getReviewClient;
module.exports.getApiClient = getApiClient;

/* public */
function getReviewClient () {
  return got.extend(_getSearchOptions()).extend({ timeout: istex.review.timeout });
}

function getApiClient () {
  return got.extend(_getSearchOptions()).extend({ timeout: istex.api.timeout, dnsCache: cacheable });
}

/* private helpers */
function _getSearchOptions () {
  return {
    retry: 0, /* We using stream under the hood so no retry unless implementing specifics behavior */
    hooks: {
      beforeError: [
        error => {
          const requestUrl = decodeURIComponent(_.get(error, 'options.url'));
          return new VError({ cause: error, name: 'RequestError', info: { requestUrl } },
            'Error %s requesting: %s',
            _.get(error, 'response.statusCode', 'N/A'),
            requestUrl);
        },
      ],
    },
  };
}
