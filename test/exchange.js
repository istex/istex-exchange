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
    const exchanger = exchange({parallel, doWarn: true, doLogError: false});
    let resultCount = 0;

    return findDocumentsBy({type: MONOGRAPH, maxSize})
      .through(exchanger)
      .stopOnError(onceFinished)
      .doto(() => ++resultCount)
      .done(() => {
        resultCount.should.be.aboveOrEqual(1);
        onceFinished();
      })
      ;

  });

  it('Should compute exchange for ark:/67375/8Q1-5TR7LXKC-1', function(done) {

    const maxSize  = 50,
          parallel = 20
    ;

    const expectedTimeout = getExpectedTimeout({maxSize, parallel});

    this.timeout(expectedTimeout);
    console.info('Expected timeout: ', expectedTimeout);

    const onceFinished = onceDone(done);
    const exchanger = exchange({parallel, doWarn: true, doLogError: false});
    let resultCount = 0;
    return findDocumentsBy({uri: 'ark:/67375/8Q1-5TR7LXKC-1', maxSize})
      .through(exchanger)
      .stopOnError(onceFinished)
      .doto(() => ++resultCount)
      .done(() => {
        resultCount.should.equal(1);
        onceFinished();
      })
      ;

  });

  it('Should compute basics Kbart frame even with no results, for ark:/67375/8Q1-Q29MRC5R-R', function(done) {

    const maxSize  = 50,
          parallel = 20
    ;

    const expectedTimeout = getExpectedTimeout({maxSize, parallel});

    this.timeout(expectedTimeout);
    console.info('Expected timeout: ', expectedTimeout);

    const onceFinished = onceDone(done);
    const exchanger = exchange({parallel, doWarn: true, doLogError: false});
    let result = '';

    return findDocumentsBy({uri: 'ark:/67375/8Q1-Q29MRC5R-R', maxSize})
      .through(exchanger)
      .through(toKbart())
      .stopOnError(onceFinished)
      .doto((kbartLine) => {result += kbartLine;})
      .done(() => {
        result.should.equal(expectedResult.emptyKbart);
        onceFinished();
      })
      ;

  });

  it('Should stream headers and kbart lines', function(done) {


    const expectedTimeout = getExpectedTimeout();
    this.timeout(expectedTimeout);
    console.info('Expected timeout: ', expectedTimeout);

    const exchanger = exchange({doWarn: true, reviewUrl: 'https://revue-sommaire.data.istex.fr'});
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
function getExpectedTimeout ({maxSize = 1} = {}) {
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
