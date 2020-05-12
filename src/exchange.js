'use strict';

const {istex, nodejs, app}                                        = require('config-component').get(module),
      hl                                                          = require('highland'),
      _                                                           = require('lodash'),
      path                                                        = require('path'),
      {logWarning, logError, logInfo}                             = require('../helpers/logger'),
      buildCoverages                                              = require('./buildCoverages'),
      profile                                                     = require('../helpers/profile'),
      {model, SERIAL, MONOGRAPH, issnModel, syndicationFromModel} = require('./dataModel'),
      {findDocumentsBy}                                           = require('./apiManager')
;

Error.stackTraceLimit = nodejs.stackTraceLimit || Error.stackTraceLimit;


module.exports.exchange = exchange;

/**
 *
 * @returns {{pipeline: hl.pipeline, done: done}} Return Object with 2 entries, pipeline is a highland pipeline
 * with the core application, done is a Function that can be call at the end of the stream to get info and stats.
 *
 */
function exchange () {

  let startDate,
      generatedExchangeObject = 0,
      expectedExchangeObject  = 0
  ;

  const _buildCoverages = profile(buildCoverages, app.doProfile);

  const pipeline =
          hl.pipeline(
            hl.tap(() => {startDate = new Date();}),
            hl.map(reviewData => {
              let apiQuery;
              expectedExchangeObject++;

              if (!(apiQuery = reviewData[model.istexQuery])) {
                logWarning(`Invalid Summary review data object _id: ${reviewData._id.warning}, missing Istex query.`);
                return;
              }

              apiQuery += ` AND publicationDate:[${reviewData[model.startDate] || '*'} TO ${reviewData[model.endDate] || '*'}]`;

              reviewData._query = apiQuery;

              const apiSearch = findDocumentsBy({
                                                  apiQuery,
                                                  size  : 1,
                                                  output: 'host,publicationDate,author',
                                                  facet : buildCoverages.issueByVolume
                                                });


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


              return hl([apiSearch,
                         apiSearchHostPublicationDateByVolumeAndIssue,
                         apiSearchPublicationDateByVolumeAndIssue,
                         hl([reviewData])])
                .parallel(4)
                .batch(4)
                .stopOnError(logWarning)
                ;
            }),
            hl.compact(),
            hl.parallel(5),
            hl.map(([apiResult, apiResultHostPublicationDateByVolumeAndIssue, apiResultPublicationDateByVolumeAndIssue, reviewData]) => {

              if (apiResult.total === 0) {
                logWarning(
                  `No Istex API result for LODEX data object _id: `
                  + `${_.get(reviewData, '_id', 'UNSET').warning}, `
                  + `ark: ${_.get(reviewData, 'uri', 'UNSET').warning}, query: ${_.get(reviewData,
                                                                                       '_query',
                                                                                       'UNSET').muted}`);

                return;
              }

              if (reviewData[model.type] === 'monograph'
                  && _.get(apiResult.hits, '0.host.genre') === 'book'
                  && _.get(apiResult.aggregations, ['host.volume', 'buckets'], []).length > 1
              ) {
                logWarning(`Multiple volume ref. for monograph,  _id: ${_.get(reviewData,
                                                                              '_id',
                                                                              'UNSET').warning}, ark: ${_.get(
                  reviewData,
                  'uri',
                  'UNSET').warning}, query: ${_.get(reviewData, '_query', 'UNSET').muted}`);
                return;
              }

              if (!reviewData.uri) {
                logWarning(`Missing Uri in lodexData object id:${reviewData._id}\n`, reviewData);
              }
              const coverages = reviewData[model.type] === 'serial'
                ? _buildCoverages(apiResult.aggregations,
                                  apiResultHostPublicationDateByVolumeAndIssue.aggregations,
                                  apiResultPublicationDateByVolumeAndIssue.aggregations)
                : [];

              const titleUrl = reviewData.uri && path.join(istex.review.url, reviewData.uri) || '';
              generatedExchangeObject += 1;

              return {
                coverages,
                publication_title              : reviewData[model.title],
                publication_type               : reviewData[model.type],
                coverage_depth                 : 'fulltext',
                print_identifier               : reviewData[model.type] === SERIAL ? reviewData[model.issn] : reviewData[model.isbn],
                online_identifier              : reviewData[model.type] === SERIAL ? reviewData[model.eIssn] : reviewData[model.eIsbn],
                title_url                      : titleUrl,
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

  function done () {
    logInfo(_buildCoverages.report());
    logInfo(`Generated exchange object: ${generatedExchangeObject}/${expectedExchangeObject}`);
    logInfo('start date: ', startDate);
    logInfo('end date: ', new Date());
  }

  return {pipeline, done};
}

/* private helpers */
function _tagFollowedBy (value) {
  let titleId;
  if (!(titleId = _findTitleId(value))) return '';
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


