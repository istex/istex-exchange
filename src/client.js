'use strict';


const {istex, nodejs, app} = require('config-component').get(module),
      got                  = require('got'),
      _                    = require('lodash'),
      VError               = require('verror')
;

module.exports.getReviewClient = getReviewClient;
module.exports.getApiClient = getApiClient;

/* public */
function getReviewClient () {
  return got.extend(_getSearchOptions()).extend({timeout: {response: istex.review.timeout}});
}

function getApiClient () {
  return got.extend(_getSearchOptions()).extend({timeout: istex.api.timeout});
}

/* private helpers */
function _getSearchOptions () {
  return {
    retry: 0, /* We using stream under the hood so no retry unless implementing specifics behavior */
    hooks: {
      beforeError: [
        error => {
          const requestUrl = decodeURIComponent(_.get(error, 'options.url'));
          return VError({cause: error, name: 'RequestError', info: {requestUrl}},
                        'Error %s requesting: %s ',
                        _.get(error, 'response.statusCode', 'N/A'),
                        requestUrl);
        }
      ]
    }
  };
}
