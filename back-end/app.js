const express = require('express');
const cors = require('cors');
const _ = require('lodash');
const geolib = require('geolib');
const { VoyagerServer, gql } = require('@aerogear/voyager-server');
const { KeycloakSecurityService } = require('@aerogear/voyager-keycloak')
const mongoose = require('mongoose');

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

const MONGODB_USER = _.defaultTo(process.env.MONGODB_USER, undefined);
const MONGODB_PASSWORD = _.defaultTo(process.env.MONGODB_PASSWORD, undefined);
const MONGODB_SERVICE_HOST = _.defaultTo(process.env.MONGODB_SERVICE_HOST, 'localhost');
const MONGODB_SERVICE_PORT = _.defaultTo(process.env.MONGODB_SERVICE_PORT, '27017');
const MONGODB_DATABASE = _.defaultTo(process.env.MONGODB_DATABASE, 'admin');

const MONGO_URL = `mongodb://${MONGODB_USER ? `${MONGODB_USER}:${MONGODB_PASSWORD}@` : ''}${MONGODB_SERVICE_HOST}:${MONGODB_SERVICE_PORT}/${MONGODB_DATABASE}`

console.log('Connecting to', MONGO_URL)

mongoose.connect(MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => console.log('Connected to MongoDB'));

const FavoritesSchema = new mongoose.Schema({
  username: String,
  chargers: [String],
});
const Favorites = mongoose.model('Favorites', FavoritesSchema);

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
    favorites: (parent, args, context) => {
      return Favorites.find({ username: context.auth.accessToken.content.preferred_username})
      .then(data => data.length > 0 ? data[0].chargers : [])
      .then(data => _.map(data, item => ({id: item})))
    }
  },

  Mutation: {
    setFavorite: (parent, args, context, info) => {
      return Favorites.find({ username: context.auth.accessToken.content.preferred_username})
      .then(data => {
        let newFavoritesList = data.length > 0 ? data[0].chargers : [];

        if (args.isFavorite) {
          newFavoritesList = [...newFavoritesList, args.id];
        } else {
          newFavoritesList = _.without(newFavoritesList, args.id);
        }

        return Favorites.findOneAndUpdate(
          { username: context.auth.accessToken.content.preferred_username },
          { chargers: _.uniq(newFavoritesList) },
          { upsert: true },
        );
      })
      .then(({chargers}) => chargers)
      .catch(console.error);
    }
  }
};

const keycloakService = new KeycloakSecurityService(_.find(MOBILE_SERVICES.services, {type: 'keycloak'}).config);

const server = new VoyagerServer({ typeDefs, resolvers: _.merge(unauthenticatedResolvers, authenticatedResolvers) }, { securityService: keycloakService });
keycloakService.applyAuthMiddleware(app, { apiPath: '/graphql-auth' });
server.applyMiddleware({app, cors: true, path: '/graphql-auth'});

openServer = new VoyagerServer({ typeDefs, resolvers: unauthenticatedResolvers });
openServer.applyMiddleware({app, cors: true});

app.listen(port, () => {
  console.log(`🚀  Server ready`);
});