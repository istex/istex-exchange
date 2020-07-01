'use strict';

const should                     = require('should'),
      {exchange}                 = require('../src/exchange'),
      {toKbart}                  = require('../src/toKbart'),
      {findDocumentsBy}          = require('../src/reviewManager'),
      {MONOGRAPH, SERIAL, model} = require('../src/reviewModel'),
      {app, testSuit, istex}     = require('config-component').get(module),
      expectedResult             = require('./expectedResult')
;

describe('Exchange', function() {
  it('Should compute exchange data with no error', function(done) {

    const maxSize  = 50,
          parallel = 20
    ;

    const expectedTimeout = getExpectedTimeout({maxSize, parallel});

    this.timeout(expectedTimeout);
    console.info('Expected timeout: ', expectedTimeout);

    const onceFinished = onceDone(done);
    const exchanger = exchange({parallel, doProfile: true, doWarn: true, doLogEndInfo: true, doLogError: false});

   return  findDocumentsBy({type: SERIAL, maxSize})
      .through(exchanger)
      .stopOnError(onceFinished)
      .done(onceFinished)
    ;

  });


  it('Should stream headers and kbart lines', function(done) {


    const expectedTimeout = getExpectedTimeout();
    this.timeout(expectedTimeout);
    console.info('Expected timeout: ', expectedTimeout);

    const exchanger = exchange({doProfile: true, doWarn: true, doLogError: false, doLogEndInfo: true});
    const onceFinished = onceDone(done);
    let result = '';


    findDocumentsBy({
                      [model.uri]: 'ark:/67375/8Q1-32DSDVT8-D'
                    })
      .through(exchanger)
      .through(toKbart())
      .doto((kbartLine) => {result += kbartLine;})
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
