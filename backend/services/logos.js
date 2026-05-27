'use strict';

// Logo resolution via third-party CDN was removed — placeholder images are
// served locally from assets/ and are always used on the generated card.
async function getOrgLogo(_name, _domain) {
  return { logoUrl: null };
}

module.exports = { getOrgLogo };
