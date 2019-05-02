import React, { Component } from 'react';

import './App.css';

// NOTE: This token is generated using a signing key from Apple, you will need your
// own key if you need a longer lived token
const MAP_TOKEN = require('./map-token.json');

// Uncomment these lines to use local endpoint
const API_ROOT = 'http://localhost:8080';
const FETCH_OPTIONS = {};

// Uncomment these lines to use OpenShift endpoint
// const API_ROOT = 'http://ev-chargers-app-wings-3scale-demo.e8ca.engint.openshiftapps.com';
// const FETCH_OPTIONS = {};

// Uncomment these lines to use 3scale endpoint
// const API_ROOT = 'https://api-2445582727862.staging.gw.apicast.io:443';
// const FETCH_OPTIONS = {headers: {'user-key': '9be4f9757ce91e4a4cd6f3d0a0cfaf60'}};

// Initialize MapKit
const mapkit = window.mapkit;

mapkit.init({
  authorizationCallback: done => done(MAP_TOKEN.token)
});

const geocoder = new mapkit.Geocoder();


class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      map: null,
      location: '',
      searchedLocation: [],
      chargers: [],
      annotations: [],
    };

    this.handleLocationUpdate = this.handleLocationUpdate.bind(this);
    this.handleSearch = this.handleSearch.bind(this);
  }

  componentDidMount() {
    // Default to map of CA
    geocoder.lookup('California', (err, data) => {
      this.setState({
        map: new mapkit.Map('map', {
          region: data.results[0].region
        })
      });
    });
  }

  handleLocationUpdate(event) {
    this.setState({
      location: event.target.value,
    });
  }

  handleSearch(event) {
    event.preventDefault();

    // Clear any markers from previous searches
    this.state.map.removeAnnotations(this.state.annotations);

    geocoder.lookup(this.state.location, (err, data) => {
      // Ensure we got a resulting location
      if (data.results.length >= 1) {
        this.setState({
          searchedLocation: data.results
        }, () => {
          // Recenter the map
          this.state.map.setRegionAnimated(data.results[0].region, true);

          let {center} = data.results[0].region;

          let url = new URL(`${API_ROOT}/near`);
          url.searchParams.append('latitude', center.latitude);
          url.searchParams.append('longitude', center.longitude);

          // Call the API to get chargers near the center of our map
          fetch(url, FETCH_OPTIONS).then(data => data.json()).then(data => {
            let chargers = data.map(({charger}) => charger);

            // Create markers on the map for each charger
            let annotations = chargers.map(charger => new mapkit.MarkerAnnotation(
              new mapkit.Coordinate(charger.latitude, charger.longitude),
              {
                title: charger.station_name,
                subtitle: charger.access_days_time,
                callout: {
                  calloutShouldAppearForAnnotation: () => true
                },
                data: {
                  ev_network: charger.ev_network
                },
              }
            ));

            // Add the markers to the map
            this.state.map.addAnnotations(annotations);

            this.setState({
              annotations,
              chargers,
            });
          });
        })
      }
    })
  }

  render() {
    return (
      <div className='root'>
        <div id='actions'>
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
              <div key={charger.objectid} className='card charger'>
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
        <div id='map' />
      </div>
    );
  }
}

export default App;
