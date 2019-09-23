import React, { Component } from 'react';
import L from 'leaflet';
import { OpenStreetMapProvider } from 'leaflet-geosearch';
import 'leaflet.awesome-markers';

import 'font-awesome/css/font-awesome.css';
import 'leaflet/dist/leaflet.css';
import 'leaflet.awesome-markers/dist/leaflet.awesome-markers.css';
import './App.css';

import ApolloClient from 'apollo-boost';
import gql from 'graphql-tag';

const GraphQLClient = new ApolloClient({
  uri: 'http://localhost:8080'
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

const geocoder = new OpenStreetMapProvider();

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

          GraphQLClient.query({query: CHARGERS_NEAR, variables: center}).then(({data}) => {
            let chargers = data.chargersNear;

            // Define the marker style
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

            // Add the markers to the map
            annotations.forEach(annontation => annontation.addTo(this.state.map));

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
            this.state.map.fitBounds(chargerBounds);

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
        <div id='map-container'><div id='map' /></div>
      </div>
    );
  }
}

export default App;
