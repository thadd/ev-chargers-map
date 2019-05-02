# EV Chargers App

Simple app to show nearby electric vehicle chargers from California public data set.

This app uses Apple MapKit.js which requires a token to load the map. Scripts assume the private key for MapKit from your Apple Developer Account is saved in `~/.ssh/mapkit-wings-3scale.p8`. Running `npm run update-token` will refresh the token saved in `map-token.js` with a new 30-day JWT.

To run the app for local development, first run the CSS builder:

    npm run watch-css

In another terminal run

    npm run start

You can then access the app at http://localhost:3000 (by default, this app assumes you are running the back-end Node.js app locally at http://localhost:8080).