import React, { Component } from 'react';

import './App.css';

const TOKEN = require('./token.json');

const mapkit = window.mapkit;

mapkit.init({
  authorizationCallback: done => done(TOKEN.token)
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
    geocoder.lookup('California', (err, data) => {
      this.setState({
        map: new mapkit.Map('map', {region: data.results[0].region})
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

    this.state.map.removeAnnotations(this.state.annotations);

    geocoder.lookup(this.state.location, (err, data) => {
      if (data.results.length >= 1) {
        this.setState({
          searchedLocation: data.results
        }, () => {
          this.state.map.setRegionAnimated(data.results[0].region, true);

          let {center} = data.results[0].region;

          let url = new URL('http://localhost:8080/near');
          url.searchParams.append('latitude', center.latitude);
          url.searchParams.append('longitude', center.longitude);

          fetch(url).then(data => data.json()).then(data => {
            let chargers = data.map(({charger}) => charger);

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
