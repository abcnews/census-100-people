// Scrollyteller

// This, along with the code in /lib/Scrollyteller should eventually be ported
// into Narricle. That will provide the events specific interactives like this
// require to create a scrollytelling interface.
require("./scrollyteller.scss");
const Scrollyteller = require("./lib/Scrollyteller");
const { getSections } = require("odyssey/src/app/utils/anchors");
getSections(["scrollyteller"]).forEach(section => {
  Scrollyteller.transformSection(section);
});
