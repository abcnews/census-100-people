// Scrollyteller

// This, along with the code in /lib/Scrollyteller should eventually be ported
// into Narricle. That will provide the events specific interactives like this
// require to create a scrollytelling interface.

const Scrollyteller = require('./lib/Scrollyteller');
const {getSections} = require('narricle/src/utils');
getSections([
    'scrollyteller'
]).forEach(section => {
    Scrollyteller.transformSection(section);
});
