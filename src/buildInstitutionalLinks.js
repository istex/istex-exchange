'use strict';

const convert    = require('xml-js'),
      {xmlLinks} = require('@istex/config-component').get(module),
      {URL}      = require('url')
;

module.exports.buildInstitutionalLinks = function({dtd, contacts, holdingsFiles, baseUrl} = {}) {
  return _getXmlLinksProlog(dtd)
         + rootStartTag
         + institution
         + keywords
         + _buildContactsTags(contacts)
         + electronicLinkLabel
         + otherLinkLabel
         + openUrlBase
         + openUrlOption
         + patronIpRequired
         + _buildElectronicHoldingsTags(holdingsFiles, {baseUrl})
         + rootEndTag
    ;

};


const rootStartTag = '<institutional_links>';
const rootEndTag = '</institutional_links>';
const institution = '<institution lang="en">ISTEX</institution>';
const keywords = '<keywords>ISTEX France</keywords>';
const electronicLinkLabel = '<electronic_link_label lang="en">[PDF] ISTEX</electronic_link_label>';
const otherLinkLabel = '<other_link_label lang="en">[PDF] ISTEX</other_link_label>';
const openUrlBase = '<openurl_base>https://view.istex.fr/document/openurl?auth=ip,fede&amp;</openurl_base>';
const openUrlOption = '<openurl_option>pmid</openurl_option>'
                      + '<openurl_option>doi</openurl_option>'
                      + '<openurl_option>book-title</openurl_option>'
                      + '<openurl_option>journal-title</openurl_option>';
const patronIpRequired = '<patron_ip_required>no</patron_ip_required>';

function _getXmlLinksProlog (dtd = xmlLinks.dtd) {
  const prolog = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                 + `<!DOCTYPE institutional_links PUBLIC "-//GOOGLE//Institutional Links 1.0//EN" "${dtd}">`;

  return prolog;
}

function _buildElectronicHoldingsTags (holdingsFiles, {baseUrl = xmlLinks.baseUrl} = {}) {
  const root               = {
          elements: []
        },
        electronicHoldings = {
          name    : 'electronic_holdings',
          type    : 'element',
          elements: []
        }
  ;
  root.elements.push(electronicHoldings);

  holdingsFiles.forEach((holdingsFile) => {
    electronicHoldings.elements.push(_buildTextElement('url', new URL(holdingsFile, baseUrl)));
  });

  return convert.js2xml(root);
}

function _buildContactsTags (contacts = []) {
  const root = {
    elements: []
  };
  contacts.forEach((contact) => {
    root.elements.push(_buildTextElement('contact', contact));
  });

  return convert.js2xml(root);
}


function _buildTextElement (name, text) {
  return {
    type    : 'element',
    name,
    elements: [
      {
        type: 'text',
        text
      }
    ]
  };
}
