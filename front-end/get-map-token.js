const fs = require('fs'),
  jwt = require('jsonwebtoken')
;

const key = fs.readFileSync(`${process.env.HOME}/.ssh/mapkit-wings-3scale.p8`).toString();

const header = {
  kid: 'HPL2RN4LY6',
  alg: 'ES256',
  typ: 'JWT',
};

const payload = {
  iss: 'M67D45U5Y3',
  iat: Date.now() / 1000,
  exp: Date.now() / 1000 + 30*24*60*60, // 30 day expiration
  origin: 'http://localhost:3000',
};

let token = jwt.sign(payload, key, { header });

console.log(JSON.stringify({ token }));