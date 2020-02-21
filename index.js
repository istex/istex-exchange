'use strict';

const {istex, nodejs, app}   = require('config-component').get(module),
      hl                     = require('highland'),
      got                    = require('got'),
      _                      = require('lodash'),
      path                   = require('path'),
      {parser}               = require('stream-json'),
      {streamValues}         = require('stream-json/streamers/StreamValues'),
      {streamArray}          = require('stream-json/streamers/StreamArray'),
      {pick}                 = require('stream-json/filters/Pick'),
      {URL, URLSearchParams} = require('url'),
      {logWarning, logError} = require('./helpers/logger')
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
const startDate = new Date();
const dataUrl = new URL('api/run/all-documents', istex.data.url);

//dataUrl.searchParams.set(model.type, 'serial');
//dataUrl.searchParams.set(model.corpus, 'brepols-ebooks');
dataUrl.searchParams.set('maxSize', 100000);
dataUrl.searchParams.set('sid', app.sid);

hl(got.stream(dataUrl))
.tap((chunk) => console.log('chunk:' + chunk.toString()))
  .through(parser())
  .through(pick({filter: 'data'}))
  .through(streamArray())
  .map(hl.get('value'))
  .map(lodexData => {
    let apiQuery;
    if (!(apiQuery = lodexData[model.istexQuery])) {
      logWarning(`LODEX data object ${lodexData._id} has missing Istex query`);
      return;
    }

    if (lodexData[model.type] === 'serial') {
      apiQuery += ` AND publicationDate:[${lodexData[model.startDate] || '*'} TO ${lodexData[model.endDate] || '*'}]`;
    }
    lodexData._query = apiQuery;

    const apiUrlFirst = new URL('document', istex.api.url);

    apiUrlFirst.searchParams.set('q', apiQuery);
    apiUrlFirst.searchParams.set('size', 1);
    apiUrlFirst.searchParams.set('sortBy', 'host.volume[asc],host.issue[asc]');
    apiUrlFirst.searchParams.set('output', 'host,publicationDate,author');
    apiUrlFirst.searchParams.set('sid', app.sid);

    let stream = hl(got.stream(apiUrlFirst));

    if (lodexData[model.type] === 'serial') {
      const apiUrlLast = new URL('docgument', istex.api.url);
      apiUrlLast.search = new URLSearchParams(apiUrlFirst.search);
      apiUrlLast.searchParams.set('sortBy', 'host.volume[desc],host.issue[desc]');

      stream = stream
        .fork()
        .concat(
          hl(
            got.stream(apiUrlLast))
        )    .errors(
          (err, push) => {
            logError(`Error requesting ${apiUrlLast.toString()}`);
            logError(err);

            push(err);
          });
    } else {
      // Default behavior which means monograph type
      stream = stream
        .fork()
        .append('{}');
    }

    return stream
      .tap((s)=>{console.log(s.toString())})
      .through(parser({jsonStreaming: true}))
      .through(streamValues())
      .tap((s)=>{console.log(s)})
      .map(hl.get('value'))
      .append(lodexData)
      .stopOnError((err) => {
        logError(`Error requesting ${apiUrlFirst.toString()}`);
        logError(err);
      });
  })
  .compact()
  .parallel(1)
  .batch(3)
  .stopOnError((err) => {
    logError(err);
  })
  .map(([apiResponseFirst, apiResponseLast, lodexData]) => {
    if (apiResponseFirst.total === 0) {
      logWarning(`No Istex API result for LODEX data object _id: ${_.get(lodexData,
                                                                         '_id',
                                                                         '').bold.warning}, ark: ${_.get(lodexData,
                                                                                                         'uri',
                                                                                                         '').bold.warning}, query: ${_.get(
        lodexData,
        '_query').bold.warning}`);
      return;
    }
    //console.dir(apiResponseFirst, {depth: 10});
    //console.dir(apiResponseLast, {depth: 10});
    //console.dir(lodexData);
    //console.log('---------------------------------------------------');

    if (!lodexData.uri) {
      logError(`Missing Uri in lodexData object ${lodexData._id}`, lodexData);
    }

    const titleUrl = lodexData.uri && path.join(istex.data.url, lodexData.uri) || '';

    return {
      publication_title             : lodexData[model.title],
      publication_type              : lodexData[model.type],
      coverage_depth                : 'fulltext',
      print_identifier              : lodexData[model.issn] || lodexData[model.isbn],
      online_identifier             : lodexData[model.eIssn] || lodexData[model.eIsbn],
      date_first_issue_online       : lodexData[model.startDate],
      num_first_vol_online          : _.get(apiResponseFirst, 'hits.0.host.volume'),
      num_first_issue_online        : _.get(apiResponseFirst, 'hits.0.host.issue'),
      date_last_issue_online        : lodexData[model.endDate],
      num_last_vol_online           : _.get(apiResponseLast, 'hits.0.host.volume'),
      num_last_issue_online         : _.get(apiResponseLast, 'hits.0.host.issue'),
      title_url                     : titleUrl,
      first_author                  : lodexData[model.type] === 'monograph' && lodexData[model.contributor] || null,
      title_id                      : lodexData[model.titleId],
      notes                         : lodexData[model.followedBy],
      parent_publication_title_id   : lodexData[model.parentPublicationTitleId],
      preceding_publication_title_id: lodexData[model.precededBy],
      access_type                   : lodexData[model.rights],
      publisher_name                : lodexData[model.publisher],
      date_monograph_published_print: lodexData[model.type] === 'monograph' && _.get(apiResponseFirst,
                                                                                     'hits.0.publicationDate') || null
    };
  })
  .done(() => {
    console.log('start date: ', startDate);
    console.log('end date: ', new Date());
  })
//.each(hl.log)

;
