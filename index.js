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
      buildCoverage                   = require('./src/buildCoverage')
;
const NS_PER_MS = 1e6;
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
    expectedExchangeObject  = 0,
    volumeMatchIssueCount   = 0

;
const profiledBuildCoverage = _profile(buildCoverage);

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
dataUrl.searchParams.set('uri', 'ark:/67375/8Q1-0NFVZWPD-M');
//dataUrl.searchParams.set(model.corpus, 'brepols-ebooks');
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
    let apiQuery, requestSize = 2;
    expectedExchangeObject++;

    if (!(apiQuery = lodexData[model.istexQuery])) {
      logWarning(`Invalid LODEX data object _id: ${lodexData._id.warning}, missing Istex query.`);
      return;
    }

    if (lodexData[model.type] === 'serial') {
      requestSize = 1;
      apiQuery += ` AND publicationDate:[${lodexData[model.startDate] || '*'} TO ${lodexData[model.endDate] || '*'}]`;
    }


    lodexData._query = apiQuery;

    const apiUrlFirst = new URL('document', istex.api.url);

    apiUrlFirst.searchParams.set('q', apiQuery);
    apiUrlFirst.searchParams.set('size', requestSize);
    apiUrlFirst.searchParams.set('sortBy', 'host.volume[asc],host.issue[asc]');
    apiUrlFirst.searchParams.set('output', 'host,publicationDate,author');
    apiUrlFirst.searchParams.set('sid', app.sid);

    if (lodexData[model.type] === 'serial') {
      apiUrlFirst.searchParams.set('facet', 'host.volume[*-*:1]>host.issue[*-*:1],host.issue');
    }

    let searchFirstResult =
          hl(
            apiClient.get(apiUrlFirst).json()
          )
    ;

    let searchLastResult = hl.of({});

    if (lodexData[model.type] === 'serial') {
      const apiUrlLast = new URL('document', istex.api.url);
      apiUrlLast.search = new URLSearchParams(apiUrlFirst.search);
      apiUrlLast.searchParams.set('sortBy', 'host.volume[desc],host.issue[desc]');
      apiUrlLast.searchParams.delete('facet');
      searchLastResult = hl(apiClient.get(apiUrlLast).json());
    }

    return hl([searchFirstResult, searchLastResult, hl([lodexData])])
      .parallel(3)
      .batch(3)
      .stopOnError(logWarning)
      ;
  })
  .compact()
  .parallel(5)
  //.batch(3)
  //.stopOnError(logError)
  .map(([apiResultFirst, apiResultLast, lodexData]) => {
    //if (!(apiResultFirst && lodexData) || !(apiResultFirst.total !== undefined && apiResultFirst.hits !== undefined) || !(lodexData._id !== undefined && lodexData.lodex_published !== undefined)) {
    //  console.dir(apiResultFirst, {depth: 10});
    //  console.dir(apiResultLast, {depth: 10});
    //  console.dir(lodexData);
    //  console.log('---------------------------------------------------');
    //  throw new Error('Missing object');
    //}


    if (apiResultFirst.total === 0) {
      logWarning(
        `No Istex API result for LODEX data object _id: `
        + `${_.get(lodexData, '_id', 'UNSET').warning}, `
        + `ark: ${_.get(lodexData, 'uri', 'UNSET').warning}, query: ${_.get(lodexData, '_query', 'UNSET').muted}`);

      return;
    }

    if (lodexData[model.type] === 'monograph' && apiResultFirst.total > 1) {
      logWarning(`Non unique result for monograph,  _id: ${_.get(lodexData, '_id', 'UNSET').warning}, ark: ${_.get(
        lodexData,
        'uri',
        'UNSET').warning}, query: ${_.get(lodexData, '_query', 'UNSET').muted}`);
      return;
    }

    if (!lodexData.uri) {
      logWarning(`Missing Uri in lodexData object id:${lodexData._id}\n`, lodexData);
    }

    let coverage;
    if (lodexData[model.type] === 'serial') {
      coverage = profiledBuildCoverage(apiResultFirst.aggregations);
      //console.dir(coverage)
    }

    const titleUrl = lodexData.uri && path.join(istex.data.url, lodexData.uri) || '';
    generatedExchangeObject += 1;

    return {
      publication_title             : lodexData[model.title],
      publication_type              : lodexData[model.type],
      coverage_depth                : 'fulltext',
      print_identifier              : lodexData[model.issn] || lodexData[model.isbn],
      online_identifier             : lodexData[model.eIssn] || lodexData[model.eIsbn],
      date_first_issue_online       : lodexData[model.startDate],
      num_first_vol_online          : _.get(apiResultFirst, 'hits.0.host.volume', null),
      num_first_issue_online        : _.get(apiResultFirst, 'hits.0.host.issue', null),
      date_last_issue_online        : lodexData[model.endDate],
      num_last_vol_online           : _.get(apiResultLast, 'hits.0.host.volume', null),
      num_last_issue_online         : _.get(apiResultLast, 'hits.0.host.issue', null),
      title_url                     : titleUrl,
      first_author                  : lodexData[model.type] === 'monograph' && lodexData[model.contributor] || null,
      title_id                      : lodexData[model.titleId],
      notes                         : lodexData[model.followedBy],
      parent_publication_title_id   : lodexData[model.parentPublicationTitleId],
      preceding_publication_title_id: lodexData[model.precededBy],
      access_type                   : lodexData[model.rights],
      publisher_name                : lodexData[model.publisher],
      date_monograph_published_print: lodexData[model.type] === 'monograph' && _.get(apiResultFirst,
                                                                                     'hits.0.publicationDate') || null
    };
  })
  .stopOnError(logError)
  //.tap(hl.log)
  .done(() => {
    logInfo(profiledBuildCoverage.report());
    logInfo('Volume match issue docCount: ', volumeMatchIssueCount);
    logInfo(`Generated exchange object: ${generatedExchangeObject}/${expectedExchangeObject}`);
    logInfo('start date: ', startDate);
    logInfo('end date: ', new Date());
  })


;


function _profile (fn) {
  function report () {
    return `Benchmark function: ${fn.name || 'NA'}\n`
           + `Total : ${this.executionTime / NS_PER_MS} ms\n`
           + `Iterations: ${this.iteration}\n`
           + `Average : ${this.executionTime / this.iteration / NS_PER_MS} mS\n`
           + `Shortest : ${Number(this.shortestIteration) / NS_PER_MS} ms\n`
           + `Longest : ${Number(this.longestIteration) / NS_PER_MS} mS\n`
      ;
  }

  tick.executionTime = 0;
  tick.iteration = 0;
  tick.shortestIteration = Infinity;
  tick.longestIteration = 0;
  tick.report = report.bind(tick);
  function tick () {
    const startTime = process.hrtime.bigint();
    const result = fn(...arguments);
    const diff = process.hrtime.bigint() - startTime;
    if (diff > tick.longestIteration) tick.longestIteration = diff;
    if (diff < tick.shortestIteration) tick.shortestIteration = diff;
    tick.executionTime = tick.executionTime + Number(diff);
    tick.iteration++;

    return result;
  }

  return tick;
}


function getAllProperties (obj) {
  var allProps = [], curr = obj
  do {
    var props = Object.getOwnPropertyNames(curr)
    props.forEach(function(prop) {
      if (allProps.indexOf(prop) === -1)
        allProps.push(prop);
    });
  } while (curr = Object.getPrototypeOf(curr))
  return allProps;
}
