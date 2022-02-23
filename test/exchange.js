'use strict';

const should = require('should');
const { validateXMLWithDTD } = require('validate-with-xmllint');
const { testSuit, istex, xmlHoldings } = require('@istex/config-component').get(module);
const fs = require('fs-extra');
const path = require('path');
const _ = require('lodash');
const { exchange } = require('../src/exchange');
const { toKbart } = require('../src/toKbart');
const { toXmlHoldings } = require('../src/toXmlHoldings');
const { writeXmlHoldings } = require('../src/writeXmlHoldings');
const { buildInstitutionalLinks } = require('../src/buildInstitutionalLinks');
const { findDocumentsBy } = require('../src/reviewManager');
const { MONOGRAPH } = require('../src/reviewModel');
const expectedResult = require('./expectedResult')
;

describe('Exchange', function () {
  it('Should compute exchange data with no error', function (done) {
    const maxSize = 50;
    const parallel = 20
    ;

    const expectedTimeout = getExpectedTimeout({ maxSize, parallel });

    this.timeout(expectedTimeout);
    console.info(`\tExpected timeout: ${expectedTimeout}`.muted);

    const onceFinished = onceDone(done);
    const exchanger = exchange({ parallel, doWarn: true, doLogError: false });
    let resultCount = 0;

    return findDocumentsBy({ type: MONOGRAPH, maxSize })
      .through(exchanger)
      .stopOnError(onceFinished)
      .doto(() => ++resultCount)
      .done(() => {
        resultCount.should.be.aboveOrEqual(1);
        onceFinished();
      })
    ;
  });

  it('Should compute exchange for ark:/67375/8Q1-5TR7LXKC-1', function (done) {
    const maxSize = 50;
    const parallel = 20
    ;

    const expectedTimeout = getExpectedTimeout({ maxSize, parallel });

    this.timeout(expectedTimeout);
    console.info(`\tExpected timeout: ${expectedTimeout}`.muted);

    const onceFinished = onceDone(done);
    const exchanger = exchange({ parallel, doWarn: true, doLogError: false });
    let resultCount = 0;
    return findDocumentsBy({ uri: 'ark:/67375/8Q1-5TR7LXKC-1', maxSize })
      .through(exchanger)
      .stopOnError(onceFinished)
      .doto(() => ++resultCount)
      .done(() => {
        resultCount.should.equal(1);
        onceFinished();
      })
    ;
  });

  it(
    'Should compute exchange for ark:/67375/8Q1-WLNVPD2M-D while ignoring missmatch doc count between volume and sum of issues',
    function (done) {
      const maxSize = 50;
      const parallel = 20
      ;

      const expectedTimeout = getExpectedTimeout({ maxSize, parallel });

      this.timeout(expectedTimeout);
      console.info(`\tExpected timeout: ${expectedTimeout}`.muted);

      const onceFinished = onceDone(done);
      const exchanger = exchange({ parallel, doWarn: true, doLogError: false });
      const results = [];
      return findDocumentsBy({ uri: 'ark:/67375/8Q1-WLNVPD2M-D', maxSize })
        .through(exchanger)
        .through(toKbart())
        .stopOnError(onceFinished)
        .doto((kbartLine) => { results.push(kbartLine); })
        .stopOnError(onceFinished)
        .done(() => {
          results.join('').should.equal(expectedResult.exchangeIgnoreMissmatch);
          onceFinished();
        })
      ;
    });

  it(
    'Should compute kbart with only the first authors',
    function (done) {
      const maxSize = 50;
      const parallel = 20
      ;

      const expectedTimeout = getExpectedTimeout({ maxSize, parallel });

      this.timeout(expectedTimeout);
      console.info(`\tExpected timeout: ${expectedTimeout}`.muted);

      const onceFinished = onceDone(done);
      const exchanger = exchange({ parallel, doWarn: true, doLogError: false });
      const results = [];
      return findDocumentsBy({ uri: 'ark:/67375/8Q1-Z3L6FBTB-K', maxSize })
        .through(exchanger)
        .through(toKbart())
        .stopOnError(onceFinished)
        .doto((kbartLine) => { results.push(kbartLine); })
        .stopOnError(onceFinished)
        .done(() => {
          results.join('').should.equal(expectedResult.toKbartTakeOnlyFirstAuthor);
          onceFinished();
        })
      ;
    });

  it('Should compute basics Kbart frame even with no results, for ark:/67375/8Q1-Q29MRC5R-R', function (done) {
    const maxSize = 50;
    const parallel = 20
    ;

    const expectedTimeout = getExpectedTimeout({ maxSize, parallel });

    this.timeout(expectedTimeout);
    console.info(`\tExpected timeout: ${expectedTimeout}`.muted);

    const onceFinished = onceDone(done);
    const exchanger = exchange({ parallel, doWarn: true, doLogError: false });
    let result = '';

    return findDocumentsBy({ uri: 'ark:/67375/8Q1-Q29MRC5R-R', maxSize })
      .through(exchanger)
      .through(toKbart())
      .stopOnError(onceFinished)
      .doto((kbartLine) => { result += kbartLine; })
      .done(() => {
        result.should.equal(expectedResult.emptyKbart);
        onceFinished();
      })
    ;
  });

  it('Should stream headers and kbart lines and expose missing head issue coverage ', function (done) {
    const expectedTimeout = getExpectedTimeout();
    this.timeout(expectedTimeout);
    console.info(`\tExpected timeout: ${expectedTimeout}`.muted);

    const exchanger = exchange({ doWarn: true, reviewUrl: 'https://revue-sommaire.data.istex.fr' });
    const onceFinished = onceDone(done);
    const results = [];

    findDocumentsBy({
      uri: 'ark:/67375/8Q1-C8X9G1TH-L',
    })
      .through(exchanger)
      .through(toKbart())
      .doto((kbartLine) => { results.push(kbartLine); })
      .stopOnError(onceFinished)
      .done(() => {
        results.join('').should.equal(expectedResult.toKbartMissingHeadIssue);
        onceFinished();
      })
    ;
  });

  it('Should handle end of volumes iteration properly', function (done) {
    const expectedTimeout = getExpectedTimeout();
    this.timeout(expectedTimeout);
    console.info(`\tExpected timeout: ${expectedTimeout}`.muted);

    const exchanger = exchange({ doWarn: true, reviewUrl: 'https://revue-sommaire.data.istex.fr' });
    const onceFinished = onceDone(done);
    const results = [];

    findDocumentsBy({
      uri: 'ark:/67375/8Q1-306BGSMB-X',
    })
      .through(exchanger)
      .through(toKbart())
      .doto((kbartLine) => { results.push(kbartLine); })
      .stopOnError(onceFinished)
      .done(() => {
        results.join('').should.equal(expectedResult.toKbartEndOfVolumesIteration);
        onceFinished();
      })
    ;
  });

  it('Should handle end of issues iteration properly', function (done) {
    const expectedTimeout = getExpectedTimeout();
    this.timeout(expectedTimeout);
    console.info(`\tExpected timeout: ${expectedTimeout}`.muted);

    const exchanger = exchange({ doWarn: true, reviewUrl: 'https://revue-sommaire.data.istex.fr' });
    const onceFinished = onceDone(done);
    const results = [];

    findDocumentsBy({
      uri: 'ark:/67375/8Q1-959X46LT-G',
    })
      .through(exchanger)
      .through(toKbart())
      .doto((kbartLine) => { results.push(kbartLine); })
      .stopOnError(onceFinished)
      .done(() => {
        results.join('').should.equal(expectedResult.toKbartEndOfIssuesIteration);
        onceFinished();
      })
    ;
  });

  it('Should stream headers and kbart lines', function (done) {
    const expectedTimeout = getExpectedTimeout();
    this.timeout(expectedTimeout);
    console.info(`\tExpected timeout: ${expectedTimeout}`.muted);

    const exchanger = exchange({ doWarn: true, reviewUrl: 'https://revue-sommaire.data.istex.fr' });
    const onceFinished = onceDone(done);
    const results = [];

    findDocumentsBy({
      uri: 'ark:/67375/8Q1-32DSDVT8-D',
    })
      .through(exchanger)
      .through(toKbart())
      .doto((kbartLine) => { results.push(kbartLine); })
      .stopOnError(onceFinished)
      .done(() => {
        results.join('').should.equal(expectedResult.toKbart);
        onceFinished();
      })
    ;
  });

  it('Should have monograph with publicationDate', function (done) {
    const expectedTimeout = getExpectedTimeout();
    this.timeout(expectedTimeout);
    console.info(`\tExpected timeout: ${expectedTimeout}`.muted);

    const exchanger = exchange({ doWarn: true, reviewUrl: 'https://revue-sommaire.data.istex.fr' });
    const onceFinished = onceDone(done);
    const results = [];

    findDocumentsBy({
      uri: 'ark:/67375/8Q1-01FBR9BW-D',
    })
      .through(exchanger)
      .through(toKbart())
      .doto((kbartLine) => { results.push(kbartLine); })
      .stopOnError(onceFinished)
      .done(() => {
        results.join('').should.equal(expectedResult.kbartMonographPublicationDate);
        onceFinished();
      })
    ;
  });

  describe('toXmlHoldings', function () {
    it('Should stream xmlHoldings', function (done) {
      const expectedTimeout = getExpectedTimeout();
      this.timeout(expectedTimeout);
      console.info(`\tExpected timeout: ${expectedTimeout}`.muted);

      const exchanger = exchange({ doWarn: true, reviewUrl: 'https://revue-sommaire.data.istex.fr' });
      const onceFinished = onceDone(done);
      const results = [];

      findDocumentsBy({
        uri: 'ark:/67375/8Q1-32DSDVT8-D',
      })
        .through(exchanger)
        .through(toXmlHoldings())
        .doto((xmlHolding) => { results.push(xmlHolding); })
        .stopOnError(onceFinished)
        .done(() => {
          results.join('').should.equal(expectedResult.toXmlHoldings);
          onceFinished();
        })
      ;
    });

    it('Should produce valid xmlHoldings', function (done) {
      const expectedTimeout = getExpectedTimeout();
      this.timeout(expectedTimeout);
      console.info(`\tExpected timeout: ${expectedTimeout}`.muted);

      const exchanger = exchange({ doWarn: true, reviewUrl: 'https://revue-sommaire.data.istex.fr' });
      const onceFinished = onceDone(done);
      let result = '';

      findDocumentsBy({
        corpus: 'rsl',
        maxSize: 20,
      })
        .through(exchanger)
        .through(toXmlHoldings())
        .doto((xmlHolding) => { result += xmlHolding; })
        .stopOnError(onceFinished)
        .done(() => {
          validateXMLWithDTD(result)
            .then(onceFinished)
            .catch(onceFinished)
          ;
        });
    });
  });

  describe('writeXmlHoldings', function () {
    it('Should write xmlHoldings files', function (done) {
      const corpus = {
        name: 'rsl',
        size: 20,
      };

      const expectedTimeout = getExpectedTimeout({ maxSize: corpus.size });
      this.timeout(expectedTimeout);
      console.info(`\tExpected timeout: ${expectedTimeout}`.muted);

      const exchanger = exchange({ doWarn: true, reviewUrl: 'https://revue-sommaire.data.istex.fr' });
      const onceFinished = onceDone(done);

      findDocumentsBy({
        corpus: corpus.name,
        maxSize: corpus.size,
      })
        .through(exchanger)
        .through(toXmlHoldings())
        .through(writeXmlHoldings({ corpusName: corpus.name, type: corpus.type }))
        .stopOnError(onceFinished)
        .done(() => {
          fs.stat('./test/output/google-scholar/institutional_holdings_RSL_FRANCE_ISTEXJOURNALS-0.xml',
            (err) => {
              return onceFinished(err);
            });
        })
      ;
    });
  });

  describe('buildInstitutionalLinks', function () {
    it('Should return valid InstitutionalLinks XML', function (done) {
      const contacts = ['Bob Geldof <bob.geldof@inist.fr>', 'John Doe <john.doe@inist.fr>'];
      const dtd = './test/resources/institutional_links.dtd'
      ;

      fs.readdir(xmlHoldings.outputPath, (err, files) => {
        if (err) { return done(err); }
        const holdingsFiles = _.chain(files)
          .filter((file) => file.startsWith('institutional_holdings'))
          .value()
        ;
        const xml = buildInstitutionalLinks({ contacts, holdingsFiles, dtd });
        validateXMLWithDTD(xml)
          .then(() => {
            fs.outputFile(path.join(xmlHoldings.outputPath,
              'institutional_links.xml'),
            xml,
            { flag: 'w', encoding: 'utf-8' },
            (err) => {
              if (err) throw err;
            });
          })
          .then(done)
          .catch(done)
        ;
      });
    });
  });
});

// Helpers
function getExpectedTimeout ({ maxSize = 1 } = {}) {
  return Math.round(
    Math.max(
      1.5 * (maxSize * testSuit.expectedAvgTimeByIteration + istex.api.timeout.response),
      1.5 * (testSuit.minTimeout + istex.api.timeout.response)),
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
