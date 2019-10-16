const express = require('express');
const cors = require('cors');
const _ = require('lodash');
const geolib = require('geolib');
const { VoyagerServer, gql } = require('@aerogear/voyager-server');
const app = express();
const port = 8080;

app.use(cors());

// Charger data comes from data.ca.gov open dataset for public DC chargers
const CHARGERS_DATA = require('./chargers.json');

// Transform the data into a slightly more usable format
const Chargers = _.fromPairs(CHARGERS_DATA.features.map(charger => ([
  charger.properties.OBJECTID,
  _.mapKeys(charger.properties, (val, key) => key === 'OBJECTID' ? 'id' : key.toLowerCase())
])));

const typeDefs = gql`
  type Charger {
    id: ID
    station_name: String
    street_address: String
    intersection_directions: String
    city: String
    state: String
    zip: String
    station_phone: String
    groups_with_access_code: String
    access_days_time: String
    cards_accepted: String
    ev_level_2_evse_num: String
    ev_dc_fast_count: String
    ev_network: String
    ev_network_web: String
    latitude: Float
    longitude: Float
    afdc_id: String
    owner_type_code: String
    ev_connector_types: String
    title: String
    author: String
  }

  input GeoSearchInput {
    latitude: Float
    longitude: Float
  }

  type Query {
    chargers: [Charger]
    charger(id: ID!): Charger
    chargersNear(location: GeoSearchInput!): [Charger]
  }
`;

const resolvers = {
  Query: {
    chargers: () => Object.values(Chargers),

    charger: (parent, args) => Chargers[args.id],
    
    chargersNear: (parent, args) => geolib.findNearest(
      {latitude: args.location.latitude, longitude: args.location.longitude},
      Chargers, 0, 20
    )
  },
};

const server = new VoyagerServer({ typeDefs, resolvers });

server.applyMiddleware({ app });

app.listen(port, () => {
  console.log(`🚀  Server ready`);
});