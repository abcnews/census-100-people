const cn = require("classnames");
const ns = require("util-news-selectors");
const html = require("bel");
const { start, subscribe, enqueue } = require("odyssey/src/app/scheduler");
const isNaN = Number.isNaN || (x => x !== x);

start();

function Scrollyteller({ marks, graphicEl, alignment, contentEls = [] }) {
  let previousMark;

  const className = cn(
    "Scrollyteller",
    "is-richtext",
    "is-piecemeal",
    {
      [`is-${alignment}`]: alignment
    },
    "u-full"
  );

  const graphicClassName = cn("Scrollyteller-graphic");

  const contentClassName = cn(
    "Scrollyteller-content",
    "u-layout",
    "u-richtext-invert"
  );

  const graphicContainerEl = graphicEl
    ? html`
        <div class="${graphicClassName}">${graphicEl}</div>
      `
    : null;

  const scrollyEl = html`
    <div class="${className}">
      ${graphicContainerEl}
      ${contentEls.map(
        contentEl => html`
          <div class="${contentClassName}">${contentEl}</div>
        `
      )}
    </div>
  `;

  let previousState = {};

  subscribe(measure);

  function measure(viewport) {
    const rect = scrollyEl.getBoundingClientRect();
    const isBeyond = viewport.height >= rect.bottom;
    const isFixed = !isBeyond && rect.top <= 0;

    // TODO: This might need to be done differently for performance.
    // Default to the first mark.
    let closestMark = { el: marks[0].target };

    // Make a list of all the marks we've seen (marks that are visible above
    // the fold)
    const seenMarks = marks.filter(m => {
      const theFold = viewport.height;
      const distanceBelowFold = m.target.getBoundingClientRect().top - theFold;
      return distanceBelowFold < -viewport.height / 5;
    });

    // If we've seen marks, the last one we've seen is the one we want to show.
    if (seenMarks.length) {
      closestMark = { el: seenMarks.pop().target };
    }

    if (!previousMark || previousMark.el !== closestMark.el) {
      previousMark = closestMark;

      // create and dispatch the event
      let event = new CustomEvent("mark", {
        detail: { closestMark },
        bubbles: true
      });
      graphicEl.dispatchEvent(event);
    }

    mutate({
      isFixed,
      isBeyond
    });
  }

  function mutate(state) {
    if (state.isFixed !== previousState.isFixed) {
      enqueue(() => {
        graphicContainerEl.classList[state.isFixed ? "add" : "remove"](
          "is-fixed"
        );
      });
    }

    if (state.isBeyond !== previousState.isBeyond) {
      enqueue(() => {
        graphicContainerEl.classList[state.isBeyond ? "add" : "remove"](
          "is-beyond"
        );
      });
    }

    previousState = state;
  }

  return scrollyEl;
}

// Move marks to next element and remove nodes
function parseMarks(els, prefix) {
  let idx = 0;
  let match = new RegExp(`^${prefix}`);

  return els.reduce((collection, el) => {
    if (el.nodeName === "A" && el.name.match(match)) {
      let next = el.nextSibling;

      idx++;

      if (next) {
        next.dataset.idx = idx;
        let data = el.name.match(/[A-Z]+[0-9a-z]+/g);
        if (data && data.length) {
          data.forEach(d => {
            let value = d.match(/[0-9a-z]+/)[0];
            next.dataset[d.match(/[A-Z]+/)[0].toLowerCase()] = isNaN(+value)
              ? value
              : +value;
          });
        }
      } else {
        console.warn("Scrollyteller: mark found without a next sibling");
      }
      collection.push({
        anchor: el,
        target: next
      });
    }
    return collection;
  }, []);
}

function transformSection(section) {
  const marks = parseMarks(section.betweenNodes, "mark");
  const nodes = [].concat(section.betweenNodes);

  const config = nodes
    .filter(el => !(el.nodeName === "A" && el.name.match(/^mark/)))
    .reduce(
      function(config, node) {
        if (node.nodeName === "#text") return config;

        // Filter out all the mark nodes
        if (marks.map(m => m.anchor).indexOf(node) > -1) {
          return config;
        }

        // Define the graphic embed element
        if (!config.graphicEl && node.matches(ns("embed:fragment"))) {
          config.graphicEl = node;
          return config;
        }

        // Exclude empty elements
        if (node.textContent.trim().length < 1) {
          return config;
        }

        // Assume if it hasn't been excluded above, this node is destined for display
        config.contentEls.push(node);
        return config;
      },
      {
        marks,
        undefined,
        contentEls: []
      }
    );

  section.betweenNodes = [];

  section.substituteWith(Scrollyteller(config));
}

module.exports = Scrollyteller;
module.exports.transformSection = transformSection;

// TODO: move polyfills somewhere separate

(function() {
  if (typeof window.CustomEvent === "function") return false;

  function CustomEvent(event, params) {
    params = params || { bubbles: false, cancelable: false, detail: undefined };
    var evt = document.createEvent("CustomEvent");
    evt.initCustomEvent(
      event,
      params.bubbles,
      params.cancelable,
      params.detail
    );
    return evt;
  }

  CustomEvent.prototype = window.Event.prototype;

  window.CustomEvent = CustomEvent;
})();

if (!Element.prototype.matches) {
  Element.prototype.matches =
    Element.prototype.matchesSelector ||
    Element.prototype.mozMatchesSelector ||
    Element.prototype.msMatchesSelector ||
    Element.prototype.oMatchesSelector ||
    Element.prototype.webkitMatchesSelector ||
    function(s) {
      var matches = (this.document || this.ownerDocument).querySelectorAll(s),
        i = matches.length;
      while (--i >= 0 && matches.item(i) !== this) {}
      return i > -1;
    };
}
