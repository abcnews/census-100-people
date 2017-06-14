const placeholder = document.querySelector('[data-census-100-people-root]');
const dataUrl = placeholder.dataset.data;
const container = placeholder.parentNode;
const html = require('bel');
const d3 = require('d3-selection');
const request = require('d3-request');
const force = require('d3-force');
const ranger = require('power-ranger')
const root = html`<div class="Census-100"></div>`;
const Promise = Promise || require('promise-polyfill');

container.replaceChild(root, placeholder);
const margin = 10;
const rootSelection = d3.select(root);
const svgSelection = rootSelection.append('svg');

let currentMeasure = 'none';
let currentComparison = 'none';
let circles = svgSelection.selectAll('circle');
let rects = svgSelection.selectAll('rect');
let width = parseInt(svgSelection.style('width'));
let height = parseInt(svgSelection.style('height'));

// let nodes = ranger(100, i => {
//     return {idx: i, x: width/2, y: height/2};
// });

// let groups = [{}];

const tick = function() {
    circles
        .attr("cx", d => Math.max(margin, Math.min(width - margin, d.x)))
        .attr("cy", d => Math.max(margin, Math.min(height - margin, d.y)));
}

let simulationGroups = force.forceSimulation()
    .force('gravity', force.forceCenter(width/2, height/2))
    .force('attract', force.forceManyBody().strength(1000).distanceMin(50))
    // TODO: Possibly make repel force accessor contingent on minimum dimention of screen?
    .force('repel', force.forceManyBody().strength(-1000).distanceMax(Math.min(width, height) - margin))
    .stop();

let simulationNodes = force.forceSimulation()
    .force('x', force.forceX(d => (d.group && d.group.x) ? d.group.x : width/2))
    .force('y', force.forceY(d => (d.group && d.group.y) ? d.group.y : height/2))
    // .force('attract', force.forceManyBody().strength(50).distanceMax(50).distanceMin(10))
    // .force('repel', force.forceManyBody().strength(-100).distanceMax(50).distanceMin(10))
    .force('collide', force.forceCollide(10).strength(0.2))
    .on('tick', tick);

const data = new Promise((resolve, reject) => {
    request.csv(dataUrl, (err, json) => {
        if (err) return reject(err);
        resolve(json);
    });
});

// console.log('container', container);
container.addEventListener('mark', update);
update();

function update(e) {

    console.time('event');

    currentMeasure = (e) ? e.detail.closestMark.el.dataset.measure : currentMeasure;
    currentComparison = (e) ? e.detail.closestMark.el.dataset.comparison : currentComparison;

    // Wait until data exists before we actually reaqct to anything here
    data.then((data) => {

        console.timeEnd('event');

        // New data
        groups = data.filter(d => d.measure === currentMeasure && d.comparison === currentComparison);
        nodes = groups.reduce((g,d) => g.concat(ranger(d.value, i => {
            let idx = g.length + i;
            if (typeof nodes !== 'undefined' && nodes[g.length]) {
                nodes[idx].group = d;
                return nodes[idx];
            }
            return {group: d};
        })),[]);

        // Calculate group positions
        simulationGroups.nodes(groups).alpha(1);
        resolveGroupPositions();

        // console.log('groups', groups.map(g => [g.x,g.y]));

        // rects = rects.data(groups);
        // rects.exit().remove();
        // rects = rects.enter().append('rect')
        //     .attr('fill', 'red')
        //     .attr('stroke', 'none')
        //     .attr('width', 5)
        //     .attr('height', 5)
        // .merge(rects)
        //     .attr('x', d => d.x)
        //     .attr('y', d => d.y);

        circles = circles.data(nodes)
            .enter().append('circle')
                .attr('r', 5)
                .attr('cx', d => d.x || d.group.x)
                .attr('cy', d => d.y || d.group.y)
            .merge(circles)
                // .each(d => console.log('d.x', d.x || d.group.x));

        simulationNodes.nodes(nodes).alpha(1).restart();

    });
}

function resolveGroupPositions() {
    let i = 0;
    while (simulationGroups.alpha() > simulationGroups.alphaMin()) {
        simulationGroups.tick();
        i++;
    }
}
