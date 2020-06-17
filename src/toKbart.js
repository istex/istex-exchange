'use strict';
const _                   = require('lodash'),
      stringify           = require('csv-stringify'),
      hl                  = require('highland'),
      {fields}            = require('./kbartModel'),
      {MONOGRAPH, SERIAL} = require('./reviewModel')
;


const stringifier = stringify({header: true, delimiter: '\t', columns: fields});

module.exports.toKbart = hl.pipeline(
  hl.map(unfoldExchangeData),
  hl.flatten(),
  stringifier,
  hl.map((buffer)=> buffer.toString())
);

function unfoldExchangeData (exchangeData) {
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

