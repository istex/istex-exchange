const { istex, nodejs, app } = require('@istex/config-component').get(module);
const hl = require('highland');
const _ = require('lodash');
const { logWarning, logError } = require('../helpers/logger');
const buildCoverages = require('./buildCoverages');
const {
  model,
  duckTyping: reviewDuckTyping,
  SERIAL,
} = require('./reviewModel');
const { findDocumentsBy } = require('./apiManager');
const VError = require('verror');

Error.stackTraceLimit = nodejs.stackTraceLimit || Error.stackTraceLimit;

module.exports.exchange = exchange;

/**
 * @param reviewUrl String the base url of Summary review usefull to build kbart title url
 * @param apiUrl String the base url of Istex api, used for querying data for kbart building
 * @param parallel Number nb of parallel stream
 * @param doFrameByPublicationDate Boolean Frame queries to Istex API with start Date and end Date
 * @param doWarn Boolean log warnings
 * @param doLogError Boolean log errors
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
  doLogError = app.doLogError,
} = {}) {
  logWarning.doWarn = doWarn;

  function exchanger (s) {
    return s.map(
      reviewData => {
        if (!duckTypeReviewData.once) { duckTypeReviewData(reviewData); }

        let apiQuery;
        if (!reviewData._id) {
          logWarning(_formatReviewDataWarning(
            'Invalid Review data object, missing _id. ', reviewData));
          return;
        }

        if (!(apiQuery = reviewData[model.istexQuery])) {
          logWarning(_formatReviewDataWarning(
            'Invalid Review data object, missing istexQuery. ',
            reviewData));

          return;
        }

        if (reviewData[model.istexQuery].indexOf('publicationDate') > 0 &&
              doFrameByPublicationDate &&
              reviewData[model.startDate] &&
              reviewData[model.endDate]
        ) {
          apiQuery += ` AND publicationDate:[${reviewData[model.startDate] || '*'}` +
                        `TO ${reviewData[model.endDate] || '*'}]`;
        }

        reviewData._query = apiQuery;

        const apiSearchIssueByVolume = findDocumentsBy({
          apiUrl,
          apiQuery,
          size: 1,
          output: 'host,publicationDate,author',
          facet: buildCoverages.issueByVolume,
        });

        const apiSearch = [
          apiSearchIssueByVolume,
          hl([reviewData]),
        ];

        if (reviewData[model.type] === SERIAL) {
          // we needs a second and third request for multiple aggregations
          // @todo add hadoc route in the api
          const apiSearchHostPublicationDateByVolumeAndIssue = findDocumentsBy({
            apiUrl,
            apiQuery,
            size: 0,
            output: '',
            facet: buildCoverages.hostPublicationDateByVolumeAndIssue,
          });

          const apiSearchPublicationDateByVolumeAndIssue = findDocumentsBy({
            apiUrl,
            apiQuery,
            size: 0,
            output: '',
            facet: buildCoverages.publicationDateByVolumeAndIssue,
          });
          apiSearch.push(apiSearchHostPublicationDateByVolumeAndIssue,
            apiSearchPublicationDateByVolumeAndIssue);
        }
        return hl(apiSearch)
          .parallel(apiSearch.length)
          .batch(apiSearch.length)
          .stopOnError(logWarning);
      })
      .compact()
      .parallel(parallel)
      .map(
        _try(
          ([apiResult, reviewData, apiResultHostPublicationDateByVolumeAndIssue, apiResultPublicationDateByVolumeAndIssue]) => {
            if (apiResult.total === 0) {
              logWarning(_formatReviewDataWarning(
                'No Istex API result for the Review data object, ',
                reviewData));

              return;
            }

            if (reviewData[model.type] === 'serial' && (
              apiResult.total !== apiResultHostPublicationDateByVolumeAndIssue.total ||
              apiResult.total !== apiResultPublicationDateByVolumeAndIssue.total)) {
              logWarning(_formatReviewDataWarning(
                `There a difference between the total result of the Istex api [${apiResult.total}] and the aggregation total, for the Review data object, `,
                reviewData,
                JSON.stringify([
                  apiResult,
                  reviewData,
                  apiResultHostPublicationDateByVolumeAndIssue,
                  apiResultPublicationDateByVolumeAndIssue])));

              return;
            }

            if (reviewData[model.type] === 'monograph' &&
                _.get(apiResult.hits, '0.host.genre') === 'book' &&
                _.get(apiResult.aggregations, ['host.volume', 'buckets'],
                  []).length > 1
            ) {
              logWarning(
                _formatReviewDataWarning('Multiple volume ref. for monograph, ',
                  reviewData));

              return;
            }
            if (!reviewData[model.uri]) {
              logWarning(_formatReviewDataWarning(
                'Missing Uri in the Review data object id, ', reviewData));
            }
            const coverages = reviewData[model.type] === 'serial'
              ? buildCoverages(apiResult.aggregations,
                apiResultHostPublicationDateByVolumeAndIssue.aggregations,
                apiResultPublicationDateByVolumeAndIssue.aggregations)
              : [];

            return {
              coverages,
              reviewData,
              apiResult,
              reviewUrl,
            };
          })).errors((err, push) => {
        if (doLogError) { logError(err); }
        push(err);
      }).compact();

    function duckTypeReviewData (data) {
      // we ducktype the first Data upstream to check if its a reviewData Object
      const dataKeys = _.keys(data);
      const expectedKeys = reviewDuckTyping.map(key => model[key]);
      const keysDiff = _.difference(expectedKeys, dataKeys);

      duckTypeReviewData.once = true;

      if (keysDiff.length !== 0) {
        throw new VError(
          'Wrong data type, expecting that: %s, to includes this keys: %s, missing: %s',
          JSON.stringify(data),
          JSON.stringify(expectedKeys),
          JSON.stringify(keysDiff),
        );
      }
    }
  }

  return exchanger;
}

/* private helpers */
function _try (fn) {
  return function (args) {
    try {
      return fn(args);
    } catch (error) {
      error.info = JSON.stringify(args);
      throw error;
    }
  };
}

function _formatReviewDataWarning (message, reviewData, info = '') {
  return `${message}` +
         `_id: ${_.get(reviewData, '_id', 'UNSET').toString().warning}, ` +
         `ark: ${_.get(reviewData, 'uri', 'UNSET').warning}, ` +
         `query: ${_.get(reviewData, '_query', 'UNSET').muted}` +
         info;
}
