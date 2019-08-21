const express = require('express');
const cors = require('cors');
const _ = require('lodash');
const geolib = require('geolib');
const app = express();
const port = 8080;

// app.use(cors());

// Charger data comes from data.ca.gov open dataset for public DC chargers
const CHARGERS_DATA = require('./chargers.json');

// Transform the data into a slightly more usable format
const Chargers = _.fromPairs(CHARGERS_DATA.features.map(charger => ([
  charger.properties.OBJECTID,
  _.mapKeys(charger.properties, (val, key) => key.toLowerCase())
])));

app.get('/near', (req, res) => {
  // Lookup the closest chargers
  const nearest = geolib.findNearest(
    _.mapValues(req.query, val => Number(val)), // Map querystring lat/lon params from string to numeric
    Chargers,
    0,
    20                                          // 20 results 
  );

  let response = nearest.map(hit => ({
    charger: Chargers[hit.key],
    distance: hit.distance,
  }));

  res.json(response);
});

app.get('/charger/:id', (req, res) => {
  res.json(Chargers[req.params.id]);
});

app.get('/ping', (req, res) => {
  res.send('OK');
});

app.listen(port, () => console.log(`Listening on port ${port}`));