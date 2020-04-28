'use strict';

const {istex, nodejs, app}            = require('config-component').get(module),
      hl                              = require('highland'),
      got                             = require('got'),
      _                               = require('lodash'),
      path                            = require('path'),
      {parser}                        = require('stream-json'),
      {streamValues}                  = require('stream-json/streamers/StreamValues'),
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

const startDate = new Date();
let generatedExchangeObject = 0,
    expectedExchangeObject  = 0
;

const profiledBuildCoverages = profile(buildCoverages);

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
//dataUrl.searchParams.set(model.type, MONOGRAPH);
//dataUrl.searchParams.set('uri', 'ark:/67375/8Q1-01098048-D');
//dataUrl.searchParams.set(model.title,'Journal of the Chemical Society D: Chemical Communications');
//dataUrl.searchParams.set(model.corpus, 'springer-ebooks');
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
    let apiQuery, requestSize = 1;
    expectedExchangeObject++;

    if (!(apiQuery = lodexData[model.istexQuery])) {
      logWarning(`Invalid LODEX data object _id: ${lodexData._id.warning}, missing Istex query.`);
      return;
    }


    apiQuery += ` AND publicationDate:[${lodexData[model.startDate] || '*'} TO ${lodexData[model.endDate] || '*'}]`;


    lodexData._query = apiQuery;

    const apiUrl = new URL('document', istex.api.url);

    apiUrl.searchParams.set('q', apiQuery);
    apiUrl.searchParams.set('size', requestSize);
    apiUrl.searchParams.set('output', 'host,publicationDate,author');
    apiUrl.searchParams.set('sid', app.sid);


    apiUrl.searchParams.set('facet', buildCoverages.issueByVolumeQuery);

    let apiSearch =
          hl(
            apiClient.get(apiUrl).json()
          )
    ;

    // we needs a second request for volume by publicationDate aggregations
    // @todo add hadoc route in the api
    let apiSearchPublicationDateByVolume = hl.of({});

    const apiUrlPublicationDateByVolume = new URL('document', istex.api.url);
    apiUrlPublicationDateByVolume.search = new URLSearchParams(apiUrl.search);
    apiUrlPublicationDateByVolume.searchParams.set('size', 0);
    apiUrlPublicationDateByVolume.searchParams.set('facet', buildCoverages.publicationDateByVolumeQuery);
    apiSearchPublicationDateByVolume = hl(apiClient.get(apiUrlPublicationDateByVolume).json());

    return hl([apiSearch, apiSearchPublicationDateByVolume, hl([lodexData])])
      .parallel(3)
      .batch(3)
      .stopOnError(logWarning)
      ;
  })
  .compact()
  .parallel(3)
  .map(([apiResult, apiResultPublicationDateByVolume, lodexData]) => {
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
      ? profiledBuildCoverages(apiResult.aggregations, apiResultPublicationDateByVolume.aggregations)
      : [];

    const titleUrl = lodexData.uri && path.join(istex.data.url, lodexData.uri) || '';
    generatedExchangeObject += 1;

    return {
      coverages,
      publication_title              : lodexData[model.title],
      publication_type               : lodexData[model.type],
      coverage_depth                 : 'fulltext',
      print_identifier               : lodexData[model.issn] || lodexData[model.isbn],
      online_identifier              : lodexData[model.eIssn] || lodexData[model.eIsbn],
      date_first_issue_online        : lodexData[model.startDate],
      num_first_vol_online           : null,
      num_first_issue_online         : null,
      date_last_issue_online         : lodexData[model.endDate],
      num_last_vol_online            : null,
      num_last_issue_online          : null,
      title_url                      : titleUrl,
      first_author                   : lodexData[model.type] === MONOGRAPH && lodexData[model.contributor] || null,
      title_id                       : lodexData[model.titleId],
      notes                          : lodexData[model.followedBy],
      parent_publication_title_id    : lodexData[model.parentPublicationTitleId],
      preceding_publication_title_id : lodexData[model.precededBy],
      access_type                    : lodexData[model.rights],
      publisher_name                 : lodexData[model.publisher],
      monograph_volume               : _getMonographVolume(lodexData, apiResult),
      date_monograph_published_print : _getDateMonographPublishedPrint(lodexData, apiResult),
      date_monograph_published_online: _getDateMonographPublishedOnline(lodexData, apiResult)
    };
  })
  .stopOnError(logError)
  .tap(hl.log)
  .done(() => {
    logInfo(profiledBuildCoverages.report());
    logInfo(`Generated exchange object: ${generatedExchangeObject}/${expectedExchangeObject}`);
    logInfo('start date: ', startDate);
    logInfo('end date: ', new Date());
  })

;

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


