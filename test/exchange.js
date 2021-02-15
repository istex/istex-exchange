'use strict';

const should                         = require('should'),
      {validateXMLWithDTD}           = require('validate-with-xmllint'),
      {testSuit, istex, xmlHoldings} = require('config-component').get(module),
      fs                             = require('fs-extra'),
      path                           = require('path'),
      _                              = require('lodash'),
      {exchange}                     = require('../src/exchange'),
      {toKbart}                      = require('../src/toKbart'),
      {toXmlHoldings}                = require('../src/toXmlHoldings'),
      {writeXmlHoldings}             = require('../src/writeXmlHoldings'),
      {buildInstitutionalLinks}      = require('../src/buildInstitutionalLinks'),
      {findDocumentsBy}              = require('../src/reviewManager'),
      {MONOGRAPH, corpusType}        = require('../src/reviewModel'),
      expectedResult                 = require('./expectedResult')
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

  it('Should stream headers and kbart lines and expose missing head issue coverage ', function(done) {


    const expectedTimeout = getExpectedTimeout();
    this.timeout(expectedTimeout);
    console.info('Expected timeout: ', expectedTimeout);

    const exchanger = exchange({doWarn: true, reviewUrl: 'https://revue-sommaire.data.istex.fr'});
    const onceFinished = onceDone(done);
    let result = '';

    findDocumentsBy({
                      uri: 'ark:/67375/8Q1-C8X9G1TH-L' //'ark:/67375/8Q1-SVH028SG-5'
                    })
      .through(exchanger)
      .through(toKbart())
      .doto((kbartLine) => {result += kbartLine;})
      .stopOnError(onceFinished)
      .done(() => {
        result.should.equal(expectedResult.toKbartMissingHeadIssue);
        onceFinished();
      })
    ;
  });

  it('Should stream headers and kbart lines and expose missing middle issue coverage ', function(done) {


    const expectedTimeout = getExpectedTimeout();
    this.timeout(expectedTimeout);
    console.info('Expected timeout: ', expectedTimeout);

    const exchanger = exchange({doWarn: true, reviewUrl: 'https://revue-sommaire.data.istex.fr'});
    const onceFinished = onceDone(done);
    let result = '';

    findDocumentsBy({
                      uri: 'ark:/67375/8Q1-WLNVPD2M-D' //'ark:/67375/8Q1-SVH028SG-5'
                    })
      .through(exchanger)
      .through(toKbart())
      .doto((kbartLine) => {result += kbartLine;})
      .stopOnError(onceFinished)
      .done(() => {
        result.should.equal(expectedResult.toKbartMissingMiddleIssue);
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
                      uri: 'ark:/67375/8Q1-32DSDVT8-D'
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

  describe('toXmlHoldings', function() {
    it('Should stream xmlHoldings', function(done) {

      const expectedTimeout = getExpectedTimeout();
      this.timeout(expectedTimeout);
      console.info('Expected timeout: ', expectedTimeout);

      const exchanger = exchange({doWarn: true, reviewUrl: 'https://revue-sommaire.data.istex.fr'});
      const onceFinished = onceDone(done);
      let result = '';

      findDocumentsBy({
                        uri: 'ark:/67375/8Q1-32DSDVT8-D'
                      })
        .through(exchanger)
        .through(toXmlHoldings())
        .doto((xmlHolding) => {result += xmlHolding;})
        .stopOnError(onceFinished)
        .done(() => {
          result.should.equal(expectedResult.toXmlHoldings);
          onceFinished();
        })
      ;

    });

    it('Should produce valid xmlHoldings', function(done) {

      const expectedTimeout = getExpectedTimeout();
      this.timeout(expectedTimeout);
      console.info('Expected timeout: ', expectedTimeout);

      const exchanger = exchange({doWarn: true, reviewUrl: 'https://revue-sommaire.data.istex.fr'});
      const onceFinished = onceDone(done);
      let result = '';

      findDocumentsBy({
                        corpus : 'rsl',
                        maxSize: 20
                      })
        .through(exchanger)
        .through(toXmlHoldings())
        .doto((xmlHolding) => {result += xmlHolding;})
        .stopOnError(onceFinished)
        .done(() => {
          validateXMLWithDTD(result)
            .then(onceFinished)
            .catch(onceFinished)
          ;
        });
    });
  });
  // holdings generator one-shot
  describe.skip('writeXmlHoldings', function() {
    it('Should write xmlHoldings files', function(done) {
      let n = 30;
      let corpusName = 'ecco';//Object.keys(corpusType)[n];
      const corpus = {
        name: corpusName,
        type: corpusType[corpusName],
        size: 400000
      };

      console.dir(corpus);

      const expectedTimeout = getExpectedTimeout({maxSize: corpus.size});
      this.timeout(expectedTimeout);
      console.info('Expected timeout: ', expectedTimeout);

      const exchanger = exchange({doWarn: true, reviewUrl: 'https://revue-sommaire.data.istex.fr'});
      const onceFinished = onceDone(done);

      let result = '';
      let count = 0;
      findDocumentsBy({
                        corpus : corpus.name,
                        maxSize: corpus.size
                      })
        .through(exchanger)
        .tap(() => {console.log(++count);})
        .through(toXmlHoldings())
        .through(writeXmlHoldings({corpusName: corpus.name, type: corpus.type}))
        .doto((xmlHolding) => {result += xmlHolding;})
        .stopOnError(onceFinished)
        .done(() => {
          fs.stat(`./test/output/google-scholar/institutional_holdings_RSL_FRANCE_ISTEXJOURNALS-0.xml`,
                  (err) => {
                    return onceFinished(err);
                  });
        })
      ;

    });
  });

  describe('writeXmlHoldings', function() {
    it('Should write xmlHoldings files', function(done) {
      const corpus = {
        name: 'rsl',
        size: 20
      };

      const expectedTimeout = getExpectedTimeout({maxSize: corpus.size});
      this.timeout(expectedTimeout);
      console.info('Expected timeout: ', expectedTimeout);

      const exchanger = exchange({doWarn: true, reviewUrl: 'https://revue-sommaire.data.istex.fr'});
      const onceFinished = onceDone(done);

      let result = '';
      findDocumentsBy({
                        corpus : corpus.name,
                        maxSize: corpus.size
                      })
        .through(exchanger)
        .through(toXmlHoldings())
        .through(writeXmlHoldings({corpusName: corpus.name, type: corpus.type}))
        .doto((xmlHolding) => {result += xmlHolding;})
        .stopOnError(onceFinished)
        .done(() => {
          fs.stat(`./test/output/google-scholar/institutional_holdings_RSL_FRANCE_ISTEXJOURNALS-0.xml`,
                  (err) => {
                    return onceFinished(err);
                  });
        })
      ;

    });
  });

  // one shot
  describe.skip('buildInstitutionalLinks', function() {
    it('Should return valid InstitutionalLinks XML', function(done) {
      const contacts = ['Claude NIEDERLENDER <claude.niederlender@inist.fr>',
                        'Jean-Joffrey PARENTIN <jean-joffrey.parentin@inist.fr>']
      ;

      fs.readdir(xmlHoldings.outputPath, (err, files) => {
        if (err) return done(err);

        const holdingsFiles = _.chain(files)
                               .filter((file) => file.startsWith('institutional_holdings'))
                               .map((file) => path.join('google-scholar', file))
                               .value()
        ;
        const xml = buildInstitutionalLinks({contacts, holdingsFiles});
        validateXMLWithDTD(xml)
          .then(() => {
            fs.outputFile(path.join(xmlHoldings.outputPath,
                                    `institutional_links_istex.xml`),
                          xml,
                          {flag: 'w', encoding: 'utf-8'},
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

  describe('buildInstitutionalLinks', function() {
    it('Should return valid InstitutionalLinks XML', function(done) {
      const contacts = ['Bob Geldof <bob.geldof@inist.fr>', 'John Doe <john.doe@inist.fr>'],
            dtd      = './test/resources/institutional_links.dtd'
      ;

      fs.readdir(xmlHoldings.outputPath, (err, files) => {
        if (err) return done(err);

        const holdingsFiles = _.chain(files)
                               .filter((file) => file.startsWith('institutional_holdings'))
                               .map((file) => path.join('google-scholar', file))
                               .value()
        ;
        const xml = buildInstitutionalLinks({contacts, holdingsFiles, dtd});
        validateXMLWithDTD(xml)
          .then(() => {
            fs.outputFile(path.join(xmlHoldings.outputPath,
                                    `institutional_links.xml`),
                          xml,
                          {flag: 'w', encoding: 'utf-8'},
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
