'use strict';
const _         = require('lodash'),
      stringify = require('csv-stringify'),
      {fields}  = require('./kbartModel')
;


module.exports.toKbart = function({header = true} = {}) {
  return function(s) {
    const stringifier = stringify({header, delimiter: '\t', columns: fields});
    return s.map(_unfoldExchangeData)
            .flatten()
            .through(stringifier)
            .map((buffer) => buffer.toString())
      ;
  };
};

// private helpers
function _unfoldExchangeData (exchangeData) {
  if (!exchangeData._coverages.length) return _.omit(exchangeData, ['_coverages']);
  return _.chain(exchangeData._coverages)
          .transform((result, coverage) => {
                       const unfoldCoverage = _.chain(exchangeData)
                                               .omit(['_coverages'])
                                               .assign(coverage)
                                               .value()
                       ;
                       result.push(unfoldCoverage);
                     },
                     [])
          .value();

}

