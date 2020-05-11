'use strict';

const {istex, nodejs, app}            = require('config-component').get(module),
      hl                              = require('highland'),
      got                             = require('got'),
      _                               = require('lodash'),
      path                            = require('path'),
      {parser}                        = require('stream-json'),
      {streamArray}                   = require('stream-json/streamers/StreamArray'),
      {pick}                          = require('stream-json/filters/Pick'),
      {URL, URLSearchParams}          = require('url'),
      {logWarning, logError, logInfo} = require('./helpers/logger'),
      VError                          = require('verror'),
      buildCoverages                  = require('./src/buildCoverages'),
      profile                         = require('./helpers/profile')
;

Error.stackTraceLimit = nodejs.stackTraceLimit || Error.stackTraceLimit;

const model = {
  type                    : 'WmzM',
  title                   : 'XXRn',
  contributor             : 'Ai4O',
  corpus                  : 'aCG7',
  issn                    : 'nC6e',
  eIssn                   : 'auA7',
  isbn                    : 'hLNF',
  eIsbn                   : 'YDZ9',
  istexQuery              : 'BZSn',
  startDate               : 'Rijz',
  endDate                 : 'ZLPq',
  publisher               : 'UVFW',
  titleId                 : 'V7IG',
  precededBy              : 'izmJ',
  followedBy              : 'FdsN',
  creationDate            : 'BblN',
  isPartOf                : 'kber',
  rights                  : 'Fr7z',
  parentPublicationTitleId: 'XX3r'

};
const SERIAL    = 'serial',
      MONOGRAPH = 'monograph'
;

const issnModel            = 'nnnn-nnnn',
      syndicationFromModel = '/api/run/syndication-from/nC6e';

const startDate = new Date();
let generatedExchangeObject = 0,
    expectedExchangeObject  = 0
;

const _buildCoverages = profile(buildCoverages, app.doProfile);

function getSearchOptions () {
  return {
    retry: 0,
    hooks: {
      beforeError: [
        error => {
          const requestUrl = decodeURIComponent(_.get(error, 'options.url'));
          return VError({cause: error, name: 'IstexApiRequestError', info: {requestUrl}},
                        'Error %s requesting: %s ',
                        _.get(error, 'response.statusCode', 'N/A'),
                        requestUrl);
        }
      ]
    }
  };
}

const client     = got.extend(getSearchOptions()),
      dataClient = client.extend({timeout: {response: istex.data.responseTimeout}}),
      apiClient  = client.extend({timeout: istex.api.timeout});

const dataUrl = new URL('api/run/all-documents', istex.data.url);
dataUrl.searchParams.set(model.type, SERIAL);
//dataUrl.searchParams.set('uri', 'ark:/67375/8Q1-FTPN3ZXV-C');
//dataUrl.searchParams.set(model.title,'Journal of the Chemical Society D: Chemical Communications');
dataUrl.searchParams.set(model.corpus, 'oup');
dataUrl.searchParams.set('maxSize', 5000);
dataUrl.searchParams.set('sid', app.sid);


hl(dataClient.stream(dataUrl))
  .through(parser())
  .through(pick({filter: 'data'}))
  .through(streamArray())
  .stopOnError(error => {
    const requestUrl = decodeURIComponent(dataUrl.toString());
    logError(VError({cause: error, name: 'DataRequestError', info: {dataUrl}},
                    'Error requesting: %s',
                    requestUrl));
  })
  .map(hl.get('value'))
  .map(lodexData => {
    let apiQuery;
    expectedExchangeObject++;

    if (!(apiQuery = lodexData[model.istexQuery])) {
      logWarning(`Invalid LODEX data object _id: ${lodexData._id.warning}, missing Istex query.`);
      return;
    }

    apiQuery += ` AND publicationDate:[${lodexData[model.startDate] || '*'} TO ${lodexData[model.endDate] || '*'}]`;

    lodexData._query = apiQuery;


    const apiUrl = new URL('document', istex.api.url);
    apiUrl.searchParams.set('q', apiQuery);
    apiUrl.searchParams.set('size', 1);
    apiUrl.searchParams.set('output', 'host,publicationDate,author');
    apiUrl.searchParams.set('sid', app.sid);
    apiUrl.searchParams.set('facet', buildCoverages.issueByVolume);

    const apiSearch = hl(apiClient.get(apiUrl).json());


    // we needs a second and third request for multiple aggregations
    // @todo add hadoc route in the api
    const apiUrlHostPublicationDateByVolumeAndIssue = new URL('document', istex.api.url);
    apiUrlHostPublicationDateByVolumeAndIssue.search = new URLSearchParams(apiUrl.search);
    apiUrlHostPublicationDateByVolumeAndIssue.searchParams.set('size', 0);
    apiUrlHostPublicationDateByVolumeAndIssue.searchParams.set('facet',
                                                               buildCoverages.hostPublicationDateByVolumeAndIssue);

    const apiSearchHostPublicationDateByVolumeAndIssue = hl(apiClient.get(apiUrlHostPublicationDateByVolumeAndIssue)
                                                                     .json());


    const apiUrlPublicationDateByVolumeAndIssue = new URL('document', istex.api.url);
    apiUrlPublicationDateByVolumeAndIssue.search = new URLSearchParams(apiUrl.search);
    apiUrlPublicationDateByVolumeAndIssue.searchParams.set('size', 0);
    apiUrlPublicationDateByVolumeAndIssue.searchParams.set('facet', buildCoverages.publicationDateByVolumeAndIssue);

    const apiSearchPublicationDateByVolumeAndIssue = hl(apiClient.get(apiUrlPublicationDateByVolumeAndIssue).json());


    return hl([apiSearch,
               apiSearchHostPublicationDateByVolumeAndIssue,
               apiSearchPublicationDateByVolumeAndIssue,
               hl([lodexData])])
      .parallel(4)
      .batch(4)
      .stopOnError(logWarning)
      ;
  })
  .compact()
  .parallel(5)
  .map(([apiResult, apiResultHostPublicationDateByVolumeAndIssue, apiResultPublicationDateByVolumeAndIssue, lodexData]) => {

    if (apiResult.total === 0) {
      logWarning(
        `No Istex API result for LODEX data object _id: `
        + `${_.get(lodexData, '_id', 'UNSET').warning}, `
        + `ark: ${_.get(lodexData, 'uri', 'UNSET').warning}, query: ${_.get(lodexData, '_query', 'UNSET').muted}`);

      return;
    }

    if (lodexData[model.type] === 'monograph'
        && _.get(apiResult.hits, '0.host.genre') === 'book'
        && _.get(apiResult.aggregations, ['host.volume', 'buckets'], []).length > 1
    ) {
      logWarning(`Multiple volume ref. for monograph,  _id: ${_.get(lodexData, '_id', 'UNSET').warning}, ark: ${_.get(
        lodexData,
        'uri',
        'UNSET').warning}, query: ${_.get(lodexData, '_query', 'UNSET').muted}`);
      return;
    }

    if (!lodexData.uri) {
      logWarning(`Missing Uri in lodexData object id:${lodexData._id}\n`, lodexData);
    }
    const coverages = lodexData[model.type] === 'serial'
      ? _buildCoverages(apiResult.aggregations,
                        apiResultHostPublicationDateByVolumeAndIssue.aggregations,
                        apiResultPublicationDateByVolumeAndIssue.aggregations)
      : [];

    const titleUrl = lodexData.uri && path.join(istex.data.url, lodexData.uri) || '';
    generatedExchangeObject += 1;

    return {
      coverages,
      publication_title              : lodexData[model.title],
      publication_type               : lodexData[model.type],
      coverage_depth                 : 'fulltext',
      print_identifier               : lodexData[model.type] === SERIAL ? lodexData[model.issn] : lodexData[model.isbn],
      online_identifier              : lodexData[model.type] === SERIAL ? lodexData[model.eIssn] : lodexData[model.eIsbn],
      title_url                      : titleUrl,
      first_author                   : lodexData[model.type] === MONOGRAPH && lodexData[model.contributor] || null,
      title_id                       : lodexData[model.titleId],
      notes                          : _tagFollowedBy(lodexData[model.followedBy]),
      parent_publication_title_id    : _findTitleId(lodexData[model.parentPublicationTitleId]),
      preceding_publication_title_id : _findTitleId(lodexData[model.precededBy]),
      access_type                    : lodexData[model.rights],
      publisher_name                 : lodexData[model.publisher],
      monograph_volume               : _getMonographVolume(lodexData, apiResult),
      date_monograph_published_print : _getDateMonographPublishedPrint(lodexData, apiResult),
      date_monograph_published_online: _getDateMonographPublishedOnline(lodexData, apiResult)
    };
  })
  .stopOnError(logError)
  .compact()
  .tap(hl.log)
  //.tap((o) => {if (o.notes || o.parent_publication_title_id || o.preceding_publication_title_id) console.dir(o)})
  .done(() => {
    logInfo(_buildCoverages.report());
    logInfo(`Generated exchange object: ${generatedExchangeObject}/${expectedExchangeObject}`);
    logInfo('start date: ', startDate);
    logInfo('end date: ', new Date());
  })

;

function _tagFollowedBy(value){
  let titleId;
  if(!(titleId = _findTitleId(value))) return '';
  return `followed by: ${titleId}`;
}

function _findTitleId (value) {
  if (typeof value !== 'string' || value === '' || !value.startsWith(syndicationFromModel)) return null;
  return value.slice(-issnModel.length);
}

function _getMonographVolume (lodexData, apiResult) {
  if (lodexData[model.type] !== MONOGRAPH) return null;
  // we try to get volume number even if the initial data is not mere number
  const volume = parseInt(_.get(apiResult, 'hits.0.host.volume', null));
  if (isNaN(volume)) return null;

  return volume;
}

function _getDateMonographPublishedPrint (lodexData, apiResult) {
  if (lodexData[model.type] !== MONOGRAPH || !lodexData[model.isbn]) return null;
  let monographDate = _.get(apiResult, 'hits.0.publicationDate', null);

  if (!monographDate && !lodexData[model.eisbn]) {
    monographDate = _.get(apiResult, 'hits.0.host.publicationDate', null);
  }

  return monographDate;
}

function _getDateMonographPublishedOnline (lodexData, apiResult) {
  if (lodexData[model.type] !== MONOGRAPH || !lodexData[model.eIsbn]) return null;
  const monographDate = _.get(apiResult,
                              'hits.0.host.publicationDate',
                              _.get(apiResult, 'hits.0.publicationDate', null)
  );

  if (!monographDate.startsWith('20') && !monographDate.startsWith('21')) return null;

  return monographDate;
}


