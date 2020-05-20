'use strict';

const {istex, nodejs, app}                                        = require('config-component').get(module),
      hl                                                          = require('highland'),
      _                                                           = require('lodash'),
      {logWarning, logError, logInfo}                             = require('../helpers/logger'),
      buildCoverages                                              = require('./buildCoverages'),
      profile                                                     = require('../helpers/profile'),
      {model, SERIAL, MONOGRAPH, issnShape, syndicationFromModel} = require('./dataModel'),
      {findDocumentsBy}                                           = require('./apiManager'),
      {URL}                                                       = require('url')
;

Error.stackTraceLimit = nodejs.stackTraceLimit || Error.stackTraceLimit;


module.exports.exchange = exchange;

/**
 * @param reviewUrl String the base url of Summary review
 * @param parallel Number nb of parallel stream
 * @param doProfile Boolean wrap some function with a profiler to get performance info
 * @param doWarn Boolean log warnings
 * @returns {{pipeline: hl.pipeline, info: Function}} Return Object with 2 entries, pipeline is a highland stream pipeline
 * with the core application, logInfo is a Function that can be call at the end of the stream to get info and stats.
 *
 */
function exchange ({reviewUrl = istex.review.url, parallel = app.parallel, doProfile = app.doProfile, doWarn} = {}) {
  let startDate,
      generatedExchangeObject = 0,
      expectedExchangeObject  = 0
  ;
  const _buildCoverages = profile(buildCoverages, doProfile);
  logWarning.doWarn = doWarn;

  const pipeline =
          hl.pipeline(
            hl.map(reviewData => {
              let apiQuery;
              expectedExchangeObject++;

              if (!reviewData._id) {
                logWarning(`Invalid Summary review data object, missing _Id.`);
                return;
              }

              if (!(apiQuery = reviewData[model.istexQuery])) {
                logWarning(`Invalid Summary review data object _id: ${reviewData._id.warning}, missing Istex query.`);
                return;
              }

              apiQuery += ` AND publicationDate:[${reviewData[model.startDate] || '*'} TO ${reviewData[model.endDate] || '*'}]`;

              reviewData._query = apiQuery;

              const apiSearchIssueByVolume = findDocumentsBy({
                                                               apiQuery,
                                                               size  : 1,
                                                               output: 'host,publicationDate,author',
                                                               facet : buildCoverages.issueByVolume
                                                             });


              const apiSearch = [apiSearchIssueByVolume,
                                 hl([reviewData])
              ];

              if (reviewData[model.type] === SERIAL) {

                // we needs a second and third request for multiple aggregations
                // @todo add hadoc route in the api
                const apiSearchHostPublicationDateByVolumeAndIssue = findDocumentsBy({
                                                                                       apiQuery,
                                                                                       size  : 0,
                                                                                       output: '',
                                                                                       facet : buildCoverages.hostPublicationDateByVolumeAndIssue
                                                                                     });


                const apiSearchPublicationDateByVolumeAndIssue = findDocumentsBy({
                                                                                   apiQuery,
                                                                                   size  : 0,
                                                                                   output: '',
                                                                                   facet : buildCoverages.publicationDateByVolumeAndIssue
                                                                                 });
                apiSearch.push(apiSearchHostPublicationDateByVolumeAndIssue, apiSearchPublicationDateByVolumeAndIssue);

              }

              return hl(apiSearch)
                .parallel(apiSearch.length)
                .batch(apiSearch.length)
                .stopOnError(logWarning)
                ;
            }),
            hl.compact(),
            hl.parallel(parallel),
            hl.map(([apiResult, reviewData, apiResultHostPublicationDateByVolumeAndIssue, apiResultPublicationDateByVolumeAndIssue]) => {

              if (apiResult.total === 0) {
                logWarning(
                  `No Istex API result for Summary review data object _id: `
                  + `${_.get(reviewData, '_id', 'UNSET').warning}, `
                  + `ark: ${_.get(reviewData, 'uri', 'UNSET').warning}, `
                  + `query: ${_.get(reviewData, '_query', 'UNSET').muted}`
                );

                return;
              }

              if (reviewData[model.type] === 'monograph'
                  && _.get(apiResult.hits, '0.host.genre') === 'book'
                  && _.get(apiResult.aggregations, ['host.volume', 'buckets'], []).length > 1
              ) {
                logWarning(
                  `Multiple volume ref. for monograph, `
                  + `_id: ${_.get(reviewData, '_id', 'UNSET').warning}, `
                  + `ark: ${_.get(reviewData, 'uri', 'UNSET').warning}, `
                  + `query: ${_.get(reviewData, '_query', 'UNSET').muted}`
                );

                return;
              }

              if (!reviewData.uri) {
                logWarning(`Missing Uri in Summary review data object id:${reviewData._id}\n`, reviewData);
              }
              const coverages = reviewData[model.type] === 'serial'
                ? _buildCoverages(apiResult.aggregations,
                                  apiResultHostPublicationDateByVolumeAndIssue.aggregations,
                                  apiResultPublicationDateByVolumeAndIssue.aggregations)
                : [];

              let titleUrl = new URL(reviewUrl);
              titleUrl.pathname = reviewData.uri;

              generatedExchangeObject += 1;

              return {
                coverages,
                publication_title              : reviewData[model.title],
                publication_type               : reviewData[model.type],
                coverage_depth                 : 'fulltext',
                print_identifier               : reviewData[model.type] === SERIAL ? reviewData[model.issn] : reviewData[model.isbn],
                online_identifier              : reviewData[model.type] === SERIAL ? reviewData[model.eIssn] : reviewData[model.eIsbn],
                title_url                      : titleUrl.toString(),
                first_author                   : reviewData[model.type] === MONOGRAPH && reviewData[model.contributor] || null,
                title_id                       : reviewData[model.titleId],
                notes                          : _tagFollowedBy(reviewData[model.followedBy]),
                parent_publication_title_id    : _findTitleId(reviewData[model.parentPublicationTitleId]),
                preceding_publication_title_id : _findTitleId(reviewData[model.precededBy]),
                access_type                    : reviewData[model.rights],
                publisher_name                 : reviewData[model.publisher],
                monograph_volume               : _getMonographVolume(reviewData, apiResult),
                date_monograph_published_print : _getDateMonographPublishedPrint(reviewData, apiResult),
                date_monograph_published_online: _getDateMonographPublishedOnline(reviewData, apiResult)
              };
            }),
            hl.stopOnError(logError),
            hl.compact()
          );

  /**
   *
   * @param doTagEndDate Date tag the end date of the process
   */
  function info (doTagEndDate = true) {
    logInfo(_buildCoverages.report());
    logInfo(`Generated exchange object: ${generatedExchangeObject}/${expectedExchangeObject}`);
    logInfo('start date: ', startDate);
    doTagEndDate && logInfo('end date: ', new Date());
  }

  pipeline.once('data', () => {startDate = new Date();});

  return {pipeline, info};
}

/* private helpers */
function _tagFollowedBy (value) {
  let titleId;
  if (!(titleId = _findTitleId(value))) return '';
  return `followed by: ${titleId}`;
}

function _findTitleId (value) {
  if (typeof value !== 'string' || value === '' || !value.startsWith(syndicationFromModel)) return null;
  return value.slice(-issnShape.length);
}

function _getMonographVolume (reviewData, apiResult) {
  if (reviewData[model.type] !== MONOGRAPH) return null;
  // we try to get volume number even if the initial data is not mere number
  const volume = parseInt(_.get(apiResult, 'hits.0.host.volume', null));
  if (isNaN(volume)) return null;

  return volume;
}

function _getDateMonographPublishedPrint (reviewData, apiResult) {
  if (reviewData[model.type] !== MONOGRAPH || !reviewData[model.isbn]) return null;
  let monographDate = _.get(apiResult, 'hits.0.publicationDate', null);

  if (!monographDate && !reviewData[model.eisbn]) {
    monographDate = _.get(apiResult, 'hits.0.host.publicationDate', null);
  }

  return monographDate;
}

function _getDateMonographPublishedOnline (reviewData, apiResult) {
  if (reviewData[model.type] !== MONOGRAPH || !reviewData[model.eIsbn]) return null;
  const monographDate = _.get(apiResult,
                              'hits.0.host.publicationDate',
                              _.get(apiResult, 'hits.0.publicationDate', null)
  );

  if (!monographDate.startsWith('20') && !monographDate.startsWith('21')) return null;

  return monographDate;
}


