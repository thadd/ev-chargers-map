import React, { Component } from 'react';
import ReactDOMServer from "react-dom/server";

import L from 'leaflet';
import { OpenStreetMapProvider } from 'leaflet-geosearch';
import _ from 'lodash';
import gql from 'graphql-tag';
import { OfflineClient } from '@aerogear/voyager-client';
import { Auth } from '@aerogear/auth';

import { Map, Marker, Popup, TileLayer } from 'react-leaflet'

import 'font-awesome/css/font-awesome.css';
import 'leaflet.awesome-markers';
import 'leaflet/dist/leaflet.css';
import 'leaflet.awesome-markers/dist/leaflet.awesome-markers.css';

import './App.css';

import { init } from "@aerogear/app";

const MOBILE_SERVICES = require('./mobile-services.json');
const app = init(MOBILE_SERVICES);

const authService = new Auth(app.config);

const dataSyncConfig = _.find(app.config.configurations, {type: 'sync-app'});
const dataSyncService = new OfflineClient({
  httpUrl: dataSyncConfig.url,
  wsUrl: dataSyncConfig.config.websocketUrl,
});

const CHARGERS_NEAR = gql`
  query ChargersNear($latitude:Float!, $longitude:Float!) {
    chargersNear(location:{
      latitude:$latitude
      longitude:$longitude
    }) {
      id
      station_name
      latitude
      longitude
      access_days_time
      ev_network
    }
  }
`;

const MARKER_ICON = L.AwesomeMarkers.icon({
  icon: 'bolt',
  markerColor: 'red',
  prefix: 'fa',
});

const geocoder = new OpenStreetMapProvider();

const ChargerPopup = props => (
  <div className='station-popup'>
    {props.isAuthenticated && (
      <div className='favorite pull-left' onClick={() => props.toggleFavorite(props.id)}>
        {!props.isFavorite ? (
          <div className='fa-stack'>
            <i className='far fa-star fa-stack-2x'></i>
          </div>
        ) : (
          <div className='fa-stack'>
            <i className='fas fa-star fa-stack-2x'></i>
            <i className='far fa-star fa-stack-2x'></i>
          </div>
        )}
      </div>
     )}
    <strong>{props.station_name}</strong>
    <br />
    <em>{props.access_days_time}</em>
    <br />{props.ev_network}
  </div>
);

class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      map: null,
      mapCenter: null,
      mapBounds: null,
      location: '',
      searchedLocation: [],
      chargers: [],
      favoriteChargers: [],
      isAuthLoading: true,
      isAuthenticated: false,
    };

    this.initializeMap = this.initializeMap.bind(this);
    this.handleLocationUpdate = this.handleLocationUpdate.bind(this);
    this.handleSearch = this.handleSearch.bind(this);
    this.handleLogin = this.handleLogin.bind(this);
    this.handleLogout = this.handleLogout.bind(this);
    this.handleToggleFavorites = this.handleToggleFavorites.bind(this);
  }

  componentDidMount() {
    // Initialize the data sync service
    dataSyncService.init()
    .then(dataClient => {
      console.log('data sync service initialized', dataClient);

      // Capture the sync client for use later
      this.setState({dataClient});
    }, err => console.error('data sync initialization rejection', err))
    // Initialize the auth service
    .then(() => authService.init({}))
    .then(() => {
      if (authService.isAuthenticated()) {
        // Load the user profile if we're logged in
        return authService.loadUserProfile();
      } else {
        this.setState({
          userProfile: null,
          isAuthLoading: false,
          isAuthenticated: false,
        });
      }
    })
    .then(profile => {
      this.setState({
        userProfile: profile,
        isAuthLoading: false,
        isAuthenticated: authService.isAuthenticated(),
      })
    })
    .catch(err => console.error('initialization error', err));
  }

  initializeMap() {
    console.log('hi');
    // Default to map of CA
    geocoder.search({ query: 'California' })
    .then(results => {
      this.setState({
        mapCenter: [Number(results[0].raw.lat), Number(results[0].raw.lon)],
        mapBounds: results[0].bounds,
      })
    })
    // If we're coming back from login, restore the search
    .then(() => {
      let savedSearch = localStorage.getItem('savedSearch');

      if (savedSearch) {
        localStorage.removeItem('savedSearch');

        this.setState({
          location: JSON.parse(savedSearch)
        }, () => {
          // Execute the search
          this.handleSearch(new Event('dummy'));
        });
      }
    })
  }

  handleLocationUpdate(event) {
    this.setState({
      location: event.target.value,
    });
  }

  handleSearch(event) {
    event.preventDefault();

    geocoder.search({query: this.state.location})
    .then(results => {
      // Ensure we got a resulting location
      if (results.length >= 1) {
        this.setState({
          searchedLocation: results
        }, () => {
          // Recenter the map
          this.setState({mapBounds: results[0].bounds});

          let center = {
            latitude: Number(results[0].raw.lat),
            longitude: Number(results[0].raw.lon),
          };

          this.state.dataClient.query({query: CHARGERS_NEAR, variables: center, fetchPolicy: 'network-only'}).then(({data}) => {
            let chargers = data.chargersNear;

            // Zoom the map to the markers
            let chargerBounds = [
              [
                Math.min(...chargers.map(c => c.latitude)),
                Math.min(...chargers.map(c => c.longitude)),
              ],
              [
                Math.max(...chargers.map(c => c.latitude)),
                Math.max(...chargers.map(c => c.longitude)),
              ],
            ];

            this.setState({
              chargers,
              mapBounds: chargerBounds,
            });
          });
        })
      }
    })
  }

  handleLogin(event) {
    this.setState({
      isAuthLoading: true,
    });

    // Store the current search field so we can be more seamless when we get back from login
    if (this.state.location && this.state.location.length > 0) {
      localStorage.setItem('savedSearch', JSON.stringify(this.state.location));
    }

    // Send the user to login via auth
    authService.login().then(() => {
      this.setState({
        isAuthLoading: false,
      })
    }, err => {
      this.setState({
        isAuthLoading: false,
      });

      console.error('authService error', err);
    })
    .catch(err => {
      this.setState({
        isAuthLoading: false,
      });

      console.error('authService error', err);
    });
  }

  handleLogout(event) {
    this.setState({
      isAuthLoading: true,
    });

    authService.logout().then(() => {
      this.setState({
        isAuthenticated: false,
        isAuthLoading: false,
      })
    }, err => {
      this.setState({
        isAuthLoading: false,
      });

      console.error('authService error', err);
    })
    .catch(err => {
      this.setState({
        isAuthLoading: false,
      });

      console.error('authService error', err);
    });
  }

  handleToggleFavorites(chargerId) {
    console.log('handle favorite', chargerId);
    if (this.state.favoriteChargers.includes(chargerId)) {
      this.setState({
        favoriteChargers: _.without(this.state.favoriteChargers, chargerId),
      });
    } else {
      this.setState({
        favoriteChargers: [...(this.state.favoriteChargers), chargerId],
      });
    }
  }

  render() {

    let mapCenter = this.state.mapCenter ? this.state.mapCenter : [36.7014631, -118.7559974];

    let mapOptions = {
      zoom: this.state.mapBounds ? null : 13,
      bounds: this.state.mapBounds,
    };

    return (
      <div className='root'>
        <div id='actions'>
          <div className='profile'>
            {this.state.isAuthLoading ? (
              <div className='text-center'>
                <i className='fas fa-circle-notch fa-spin'></i>
              </div>
            ) : (
              this.state.isAuthenticated ? (
                <React.Fragment>
                  <span>Welcome, {this.state.userProfile.firstName} {this.state.userProfile.lastName}!</span>
                  <button className='btn btn-secondary btn-sm pull-right' onClick={() => this.handleLogout()}><i className='fa fa-user' /> Log out</button>
                </React.Fragment>
              ) : (
                <div className='text-right'>
                  <button className='btn btn-secondary btn-sm' onClick={() => this.handleLogin()}><i className='fa fa-user' /> Log in</button>
                </div>
              )
            )}
          </div>

          <form onSubmit={this.handleSearch}>
            <div className='form-group'>
              <div className='input-group'>
                <input className='form-control' type='text' value={this.state.location} onChange={this.handleLocationUpdate} />
                <div className='input-group-append'>
                  <button className='btn btn-primary' type='submit'><i className='fa fa-search' /></button>
                </div>
              </div>
            </div>
          </form>

          <div className='charger-list'>
            {this.state.chargers.map(charger => (
              <div key={charger.id} className='card charger'>
                <div className='card-body'>
                  <h5 className='card-title'>{charger.station_name}</h5>
                  <p className='card-text'>
                    {charger.access_days_time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div id='map-container'>
          <div id='map'>
            <Map id='map' center={mapCenter} {...mapOptions} whenReady={this.initializeMap}>
              <TileLayer
                url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                attribution='&copy; <a href=&quot;http://osm.org/copyright&quot;>OpenStreetMap</a> contributors'
              />

              {this.state.chargers.map(charger => (
                <Marker key={charger.id} position={[charger.latitude, charger.longitude]} icon={MARKER_ICON}>
                  <Popup>
                    <ChargerPopup
                      {...charger}
                      isAuthenticated={this.state.isAuthenticated}
                      isFavorite={this.state.favoriteChargers.includes(charger.id)}
                      toggleFavorite={this.handleToggleFavorites}
                      />
                  </Popup>
                </Marker>
              ))}
            </Map>
          </div>
        </div>
      </div>
    );
  }
}

export default App;
