'use strict';

const apiClient = require('./client').getApiClient();
const { istex, app } = require('@istex/config-component').get(module);
const { URL, URLSearchParams } = require('url');
const { omitBy, isNil } = require('lodash');
const hl = require('highland')
;

module.exports.findDocumentsBy = findDocumentsBy;

function findDocumentsBy ({ apiUrl = istex.api.url, apiQuery = '*', size, output, facet } = {}) {
  const istexApiUrl = new URL('document', apiUrl);
  istexApiUrl.search = new URLSearchParams(omitBy({
    q: apiQuery,
    size: size,
    output: output,
    facet: facet,
    sid: app.sid,
  }, isNil));

  return hl(apiClient.get(istexApiUrl).json());
}
