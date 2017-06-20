const html = require('bel');
const d3 = require('d3-selection');
const request = require('d3-request');
const force = require('d3-force');
const ranger = require('power-ranger')
const Promise = window.Promise || require('promise-polyfill');
const label = require('./lib/labeler');
const path = require('d3-path').path;
const scale = require('d3-scale');

const placeholder = document.querySelector('[data-census-100-people-root]');
const dataUrl = placeholder.dataset.data;
const container = placeholder.parentNode;
const root = html`<div class="Census-100"></div>`;

container.replaceChild(root, placeholder);

const margin = 10;
const markRadius = 5; // Circle radius
const markMargin = 7;
const rootSelection = d3.select(root);
const svgSelection = rootSelection.append('svg');

let groups;
let nodes;
let currentMeasure = 'none';
let currentComparison = 'none';
let circles = svgSelection.selectAll('circle.population');
let groupCircles = svgSelection.selectAll('path.group');
let groupLabels = svgSelection.selectAll('g.group-label');
let width = parseInt(svgSelection.style('width'));
let height = parseInt(svgSelection.style('height'));

const tick = function() {
    circles
        .attr("cx", d => Math.max(margin, Math.min(width - margin, d.x)))
        .attr("cy", d => Math.max(margin, Math.min(height - margin, d.y)));
}

let simulationNodes;
let simulationGroups;

const color = scale.scaleOrdinal(scale.schemeCategory10); // Predefined D3 colour set
currentColor = 0;




function initSimulations() {
    simulationGroups = force.forceSimulation()
        .force('gravity', force.forceCenter(width/2, height/2))
        .force('attract', force.forceManyBody().strength(1000).distanceMin(50))
        // TODO: Possibly make repel force accessor contingent on minimum dimention of screen?
        .force('repel', force.forceManyBody().strength(-1000).distanceMax(Math.min(width, height) - margin * 2))
        .stop();

    simulationNodes = force.forceSimulation()
        .force('x', force.forceX(d => (d.group && d.group.x) ? d.group.x : width/2).strength(0.05))
        .force('y', force.forceY(d => (d.group && d.group.y) ? d.group.y : height/2).strength(0.05))
        // .force('attract', force.forceManyBody().strength(50).distanceMax(50).distanceMin(10))
        // .force('repel', force.forceManyBody().strength(-100).distanceMax(50).distanceMin(10))
        .force('collide', force.forceCollide(markMargin).strength(0.9))
        .on('tick', tick);
}

initSimulations();


const data = new Promise((resolve, reject) => {
    request.csv(dataUrl, (err, json) => {
        console.log('request');
        if (err) return reject(err);
        resolve(json);
    });
});

// console.log('container', container);
container.addEventListener('mark', update);

window.addEventListener('resize', function() {
    width = parseInt(svgSelection.style('width'));
    height = parseInt(svgSelection.style('height'));
    initSimulations();
    update();
});
update();

function update(e) {

    rootSelection.style('background-color', color(currentColor));
    currentColor++;

    currentMeasure = (e) ? e.detail.closestMark.el.dataset.measure : currentMeasure;
    currentComparison = (e) ? e.detail.closestMark.el.dataset.comparison : currentComparison;

    console.time('event');

    // Wait until data exists before we actually react to anything here
    data
    .catch(error => {
      console.error('Could not load data', error);
    })
    .then((data) => {

        console.timeEnd('event');

        // New data
        groups = data.filter(d => d.measure === currentMeasure && d.comparison === currentComparison);

        groups.forEach(d => {
            // This is a super rough approximation of circle packing algorithm for which there doesn't appear to be a universal formula for all n between 1 and 100.
            d.r = Math.sqrt((+d.value*(markRadius+markMargin)*35)/Math.PI);
        });

        nodes = groups.reduce((newNodes, group) => newNodes.concat(ranger(+group.value, i => {
            let idx = newNodes.length + i;

            if (typeof nodes !== 'undefined' && nodes[idx]) {
                nodes[idx].group = group;
                return nodes[idx];
            }
            return {
                // Add random entry point to this or something
                x: 500, //group.x,
                y: 500, //group.y,
                group: group
            };
        })),[]);

        // Calculate group positions
        simulationGroups.nodes(groups).alpha(1);
        resolveGroupPositions();

        // Labels

        // groups.forEach(d => {
        //     console.log('JSON.parse(JSON.stringify(d))', JSON.parse(JSON.stringify(d)));
        // });

        groupLabels = groupLabels.data(groups);
        groupLabels.exit().remove();

        let groupLabelsEnter = groupLabels.enter().append('g').attr('class', 'group-label');
        groupLabelsEnter.append('text');
        groupLabelsEnter.append('path');

        groupLabels = groupLabelsEnter.merge(groupLabels);

        // Add the text
        groupLabels.select('text')
            .text(d => d.group);

        // Setup objects for the label positioner to use
        groups.forEach(d => {
            d.label = {x: d.x, y: d.y-d.r-20};
            d.anchor = {x: d.x, y: d.y, r: d.r + 20};
        });

        // Measure the text
        groupLabels.select('text').each(function(d) {
            let bbox = this.getBBox();
            d.label.width = bbox.width;
            d.label.height = bbox.height;
        });

        // Calculate label positions
        label()
            .label(groups.map(d => d.label))
            .anchor(groups.map(d => d.anchor))
            .width(width-margin*2)
            .height(height-margin*2)
            .start(1000);

        // Position the text
        groupLabels.select('text')
            .attr('dy', '0.5em')
            .attr('transform', d => `translate(${d.label.x}, ${d.label.y})`);

        // Draw the arc
        groupLabels.select('path')
            .attr('d', d => {
                let ctx = path();
                let rad = Math.atan2(d.label.y-d.y, d.label.x-d.x);
                ctx.arc(d.anchor.x, d.anchor.y, d.r, rad - deg2rad(30), rad + deg2rad(30));
                ctx.moveTo((d.r + 10) * Math.cos(rad) + d.x, (d.r + 10) * Math.sin(rad) + d.y);
                ctx.lineTo((d.r) * Math.cos(rad) + d.x, (d.r) * Math.sin(rad) + d.y)
                return ctx.toString();
            });

        // Add all the 'people'
        circles = circles.data(nodes)
            .enter().append('circle')
                .attr('class', 'population')
                .attr('r', markRadius)
                .attr('cx', d => d.x || d.group.x)
                .attr('cy', d => d.y || d.group.y)
            .merge(circles)
                // .each(d => console.log('d.x', d.x || d.group.x));

        // Position them
        simulationNodes.nodes(nodes).alpha(1).restart();

    });
}

function deg2rad(deg) {
    return deg * Math.PI / 180;
}

function resolveGroupPositions() {
    let i = 0;
    while (simulationGroups.alpha() > simulationGroups.alphaMin()) {
        simulationGroups.tick();
        // Keep it in the bounds.
        groups.forEach(d => {
            d.x = Math.min(width-margin*2-d.r, Math.max(margin+d.r, d.x));
            d.y = Math.min(height-margin*2-d.r, Math.max(margin+d.r, d.y));
        });
        i++;
    }
}
