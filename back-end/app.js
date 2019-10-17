const express = require('express');
const cors = require('cors');
const _ = require('lodash');
const geolib = require('geolib');
const { VoyagerServer, gql } = require('@aerogear/voyager-server');
const { KeycloakSecurityService } = require('@aerogear/voyager-keycloak')

const MOBILE_SERVICES = require('./mobile-services.json');

const app = express();
app.use(cors());
const port = 8080;

// Charger data comes from data.ca.gov open dataset for public DC chargers
const CHARGERS_DATA = require('./chargers.json');

// Transform the data into a slightly more usable format
const Chargers = _.fromPairs(CHARGERS_DATA.features.map(charger => ([
  charger.properties.OBJECTID,
  _.mapKeys(charger.properties, (val, key) => key === 'OBJECTID' ? 'id' : key.toLowerCase())
])));

let favorites = [];

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

  type Favorite {
    id: ID
  }

  input GeoSearchInput {
    latitude: Float
    longitude: Float
  }

  type Query {
    chargers: [Charger]
    charger(id: ID!): Charger
    chargersNear(location: GeoSearchInput!): [Charger]
    favorites: [Favorite]
  }

  type Mutation {
    setFavorite(id: ID!, isFavorite: Boolean!): [Favorite]
  }
`;

const unauthenticatedResolvers = {
  Query: {
    chargers: () => Object.values(Chargers),

    charger: (parent, args) => Chargers[args.id],
    
    chargersNear: (parent, args, context) => geolib.findNearest(
      {latitude: args.location.latitude, longitude: args.location.longitude},
      Chargers, 0, 20
    ),
  }
}

const authenticatedResolvers = {
  Query: {
    favorites: () => favorites.map(favorite => ({id: favorite}))
  },

  Mutation: {
    setFavorite: (parent, args, context, info) => {
      if (args.isFavorite) {
        favorites = [...favorites, args.id];
      } else {
        favorites = _.without(favorites, args.id);
      }

      return favorites.map(favorite => ({id: favorite}));
    }
  }
};

const keycloakService = new KeycloakSecurityService(_.find(MOBILE_SERVICES.services, {type: 'keycloak'}).config);

const server = new VoyagerServer({ typeDefs, resolvers: _.merge(unauthenticatedResolvers, authenticatedResolvers) }, { securityService: keycloakService });
keycloakService.applyAuthMiddleware(app, { apiPath: '/auth-graphql' });
server.applyMiddleware({app, cors: true, path: '/auth-graphql'});

openServer = new VoyagerServer({ typeDefs, resolvers: unauthenticatedResolvers });
openServer.applyMiddleware({app, cors: true});

app.listen(port, () => {
  console.log(`🚀  Server ready`);
});