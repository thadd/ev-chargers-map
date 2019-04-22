const express = require('express');
const cors = require('cors');
const _ = require('lodash');
const geolib = require('geolib');
const app = express();
const port = 8080;

app.use(cors());

const CHARGERS_DATA = require('./chargers.json');
const Chargers = _.fromPairs(CHARGERS_DATA.features.map(charger => ([
  charger.properties.OBJECTID,
  _.mapKeys(charger.properties, (v, k) => k.toLowerCase())
])));

app.get('/near', (req, res) => {
  const nearest = geolib.findNearest(_.mapValues(req.query, v => Number(v)), Chargers, 0, 20);
  res.json(nearest.map(hit => ({
    charger: Chargers[hit.key],
    distance: hit.distance,
  })));
});

app.get('/charger/:id', (req, res) => {
  res.json(Chargers[req.params.id]);
});

app.listen(port, () => console.log(`Listening on port ${port}`));