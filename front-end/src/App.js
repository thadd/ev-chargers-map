import React, { Component } from 'react';
import L from 'leaflet';
import { OpenStreetMapProvider } from 'leaflet-geosearch';
import 'leaflet.awesome-markers';

import 'font-awesome/css/font-awesome.css';
import 'leaflet/dist/leaflet.css';
import 'leaflet.awesome-markers/dist/leaflet.awesome-markers.css';
import './App.css';

const geocoder = new OpenStreetMapProvider();

// Uncomment these lines to use local endpoint
// const API_ROOT = 'http://ev-chargers-backend-ev-chargers.apps.cluster-aws-0fd2.aws-0fd2.example.opentlc.com';
// const FETCH_OPTIONS = {};

// // Uncomment these lines to use OpenShift endpoint
// const API_ROOT = 'http://ev-chargers-app-wings-3scale-demo.e8ca.engint.openshiftapps.com';
// const FETCH_OPTIONS = {};

// // Uncomment these lines to use 3scale endpoint
// const API_ROOT = 'https://api-2445582727862.staging.gw.apicast.io:443';
// const FETCH_OPTIONS = {headers: {'user-key': '9be4f9757ce91e4a4cd6f3d0a0cfaf60'}};

// Uncomment these lines to use environment
const API_ROOT = window._env_.CONFIG_BACKEND_URL
const FETCH_OPTIONS = {headers: {'user-key': window._env_.CONFIG_USER_KEY}};

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
    geocoder.search({ query: 'California' })
    .then(results => {
      let map =  L.map('map', { center: [Number(results[0].raw.lat), Number(results[0].raw.lon)] });
      map.fitBounds(results[0].bounds);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      this.setState({ map });
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
    this.state.annotations.forEach(annotation => annotation.remove());

    geocoder.search({query: this.state.location})
    .then(results => {
      // Ensure we got a resulting location
      if (results.length >= 1) {
        this.setState({
          searchedLocation: results
        }, () => {
          // Recenter the map
          this.state.map.fitBounds(results[0].bounds);

          let center = {
            latitude: Number(results[0].raw.lat),
            longitude: Number(results[0].raw.lon),
          };

          let url = new URL(`${API_ROOT}/near`);
          url.searchParams.append('latitude', center.latitude);
          url.searchParams.append('longitude', center.longitude);

          // Call the API to get chargers near the center of our map
          fetch(url, FETCH_OPTIONS).then(data => data.json()).then(data => {
            let chargers = data.map(({charger}) => charger);

            const marker = L.AwesomeMarkers.icon({
              icon: 'bolt',
              markerColor: 'red',
              prefix: 'fa',
            });
                  
            // Create markers on the map for each charger
            let annotations = chargers.map(charger => L.marker(
              [charger.latitude, charger.longitude],
              {
                title: charger.station_name,
                icon: marker,
              }
            ).bindPopup(`<strong>${charger.station_name}</strong><br /><em>${charger.access_days_time}</em><br />${charger.ev_network}`));

            annotations.forEach(annontation => annontation.addTo(this.state.map));

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
