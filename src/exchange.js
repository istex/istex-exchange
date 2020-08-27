'use strict';

const {istex, nodejs, app}   = require('config-component').get(module),
      hl                     = require('highland'),
      _                      = require('lodash'),
      {logWarning, logError} = require('../helpers/logger'),
      buildCoverages         = require('./buildCoverages'),
      {
        model,
        duckTyping: reviewDuckTyping,
        SERIAL,
        MONOGRAPH,
        issnShape,
        syndicationFromModel
      }                      = require('./reviewModel'),
      {findDocumentsBy}      = require('./apiManager'),
      {URL}                  = require('url'),
      VError                 = require('verror')
;

Error.stackTraceLimit = nodejs.stackTraceLimit || Error.stackTraceLimit;


module.exports.exchange = exchange;


/**
 * @param reviewUrl String the base url of Summary review usefull to build kbart title url
 * @param apiUrl String the base url of Istex api, used for querying data for kbart building
 * @param parallel Number nb of parallel stream
 * @ param doFrameByPublicationDate Boolean Frame queries to Istex API with start Date and end Date
 * @param doWarn Boolean log warnings
 * @params doLogError Boolean log errors
 *
 * @returns through function
 *
 */
function exchange ({
                     reviewUrl = istex.review.url,
                     apiUrl = istex.api.url,
                     parallel = app.parallel,
                     doFrameByPublicationDate = app.doFrameByPublicationDate,
                     doWarn = app.doWarn,
                     doLogError = app.doLogError
                   } = {}) {

  logWarning.doWarn = doWarn;

  return function(s) {
    return s
      .map(
        reviewData => {
          if (!duckTypeReviewData.once) duckTypeReviewData(reviewData);

          let apiQuery;
          if (!reviewData._id) {
            logWarning(_formatReviewDataWarning(`Invalid Summary review data object, missing _id. `, reviewData));
            return;
          }

          if (!(apiQuery = reviewData[model.istexQuery])) {
            logWarning(_formatReviewDataWarning(`Invalid Summary review data object, missing istexQuery. `,
                                                reviewData));

            return;
          }

          if (!~reviewData[model.istexQuery].indexOf('publicationDate')
              && doFrameByPublicationDate
              && reviewData[model.startDate]
              && reviewData[model.endDate]
          ) {
            apiQuery += ` AND publicationDate:[${reviewData[model.startDate] || '*'} TO ${reviewData[model.endDate] || '*'}]`;
          }

          reviewData._query = apiQuery;

          const apiSearchIssueByVolume = findDocumentsBy({
                                                           apiUrl,
                                                           apiQuery,
                                                           size  : 1,
                                                           output: 'host,publicationDate,author',
                                                           facet : buildCoverages.issueByVolume
                                                         });


          const apiSearch = [
            apiSearchIssueByVolume,
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
            apiSearch.push(apiSearchHostPublicationDateByVolumeAndIssue,
                           apiSearchPublicationDateByVolumeAndIssue);

          }
          return hl(apiSearch)
            .parallel(apiSearch.length)
            .batch(apiSearch.length)
            .stopOnError(logWarning)
            ;
        })
      .compact()
      .parallel(parallel)
      .map(
        ([apiResult, reviewData, apiResultHostPublicationDateByVolumeAndIssue, apiResultPublicationDateByVolumeAndIssue]) => {
          if (apiResult.total === 0) {
            logWarning(_formatReviewDataWarning(`No Istex API result for Summary review data object, `, reviewData));

            return;
          }

          if (reviewData[model.type] === 'monograph'
              && _.get(apiResult.hits, '0.host.genre') === 'book'
              && _.get(apiResult.aggregations, ['host.volume', 'buckets'], []).length > 1
          ) {
            logWarning(_formatReviewDataWarning(`Multiple volume ref. for monograph, `, reviewData));

            return;
          }
          if (!reviewData.uri) {
            logWarning(_formatReviewDataWarning(`Missing Uri in Summary review data object id, `, reviewData));
          }
          const coverages = reviewData[model.type] === 'serial'
            ? buildCoverages(apiResult.aggregations,
                             apiResultHostPublicationDateByVolumeAndIssue.aggregations,
                             apiResultPublicationDateByVolumeAndIssue.aggregations)
            : [];

          let titleUrl = new URL(reviewUrl);
          titleUrl.pathname = reviewData.uri;


          return {
            _coverages                     : coverages,
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
        })
      .errors((err, push) => {
        doLogError && logError(err);
        push(err);
      })
      .compact()
      ;


    function duckTypeReviewData (data) {
      // we ducktype the first Data upstream to check if its a reviewData Object
      const dataKeys     = _.keys(data),
            expectedKeys = reviewDuckTyping.map(key => model[key]),
            keysDiff     = _.difference(expectedKeys, dataKeys)
      ;

      duckTypeReviewData.once = true;

      if (keysDiff.length !== 0) throw new VError(
        'Wrong data type, expecting that: %s, to includes this keys: %s, missing: %s',
        JSON.stringify(data),
        JSON.stringify(expectedKeys),
        JSON.stringify(keysDiff)
      );
    }
  };
}

/* private helpers */
function _formatReviewDataWarning (message, reviewData) {
  return `${message}`
         + `_id: ${_.get(reviewData, '_id', 'UNSET').toString().warning}, `
         + `ark: ${_.get(reviewData, 'uri', 'UNSET').warning}, `
         + `query: ${_.get(reviewData, '_query', 'UNSET').muted}`
    ;
}

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

  // a bit of guessing, probably not the best way
  if (!monographDate.startsWith('20') && !monographDate.startsWith('21')) return null;

  return monographDate;
}


