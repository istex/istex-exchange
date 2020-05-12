'use strict';

const apiClient              = require('./client').getApiClient(),
      {istex, nodejs, app}   = require('config-component').get(module),
      {model}                = require('./dataModel'),
      {URL, URLSearchParams} = require('url'),
      {omitBy, isNil}        = require('lodash'),
      hl                     = require('highland')
;


module.exports.findDocumentsBy = findDocumentsBy;

function findDocumentsBy ({apiQuery = '*', size, output, facet} = {}) {
  const apiUrl = new URL('document', istex.api.url);
  apiUrl.search = new URLSearchParams(omitBy({
                                               'q'     : apiQuery,
                                               'size'  : size,
                                               'output': output,
                                               'facet' : facet,
                                               'sid'   : app.sid
                                             }, isNil));

  return hl(apiClient.get(apiUrl).json());
}

