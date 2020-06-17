'use strict';

const should                 = require('should'),
      {exchange}             = require('../src/exchange'),
      {toKbart}              = require('../src/toKbart'),
      {findDocumentsBy}      = require('../src/reviewManager'),
      {MONOGRAPH, SERIAL}    = require('../src/reviewModel'),
      {app, testSuit, istex} = require('config-component').get(module),
      expectedResult         = require('./expectedResult'),
_ = require('lodash')
;

describe('Exchange', function() {
  it('Should compute exchange data with no error', function(done) {

    const maxSize  = 100,
          parallel = 20
    ;

    const expectedTimeout = getExpectedTimeout({maxSize, parallel});

    this.timeout(expectedTimeout);
    console.info('Expected timeout: ', expectedTimeout);

    const exchanger = exchange({parallel, doProfile: true, doWarn: true, doLogEndInfo: true});
    const onceFinished = onceDone(done);

    findDocumentsBy({type: SERIAL, maxSize})
      .through(exchanger)
      .stopOnError(onceFinished)
      .done(function() {
        onceFinished();
      })
    ;


  });


  it('Should stream headers and kbart lines', function(done) {


    const expectedTimeout = getExpectedTimeout();
    this.timeout(expectedTimeout);
    console.info('Expected timeout: ', expectedTimeout);

    const exchanger = exchange({doProfile: true, doWarn: true});
    const onceFinished = onceDone(done);
    let result = '';


    findDocumentsBy({
                      uri: 'ark:/67375/8Q1-32DSDVT8-D'
                    })
      .through(exchanger)
      .through(toKbart)
      .each((kbartLine) => result += kbartLine)
      .stopOnError(onceFinished)
      .done(() => {
        result.should.equal(expectedResult.toKbart);
        onceFinished();
      })
    ;

  });
});

// Helpers
function getExpectedTimeout ({maxSize = 1, parallel = app.parallel} = {}) {
  return Math.round(
    Math.max(
      1.5 * (maxSize * testSuit.expectedAvgTimeByIteration + istex.api.timeout.response),
      1.5 * (testSuit.minTimeout + istex.api.timeout.response))
  );
}

function onceDone (cb) {
  let called = false;
  return (err) => {
    if (called) return;
    called = true;
    cb(err);
  };
}

// useful to see passing flow
function _logRandomDot () {
  console.info('.'.padEnd(Math.floor(Math.random() * Math.floor(4)), '.'));
}
