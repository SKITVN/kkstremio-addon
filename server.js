const { serveHTTP } = require("stremio-addon-sdk");
const addonInterface = require("./addon");

const port = Number(process.env.PORT || 7000);
const host = process.env.HOST || "0.0.0.0";

serveHTTP(addonInterface, {
  port,
  host,
  cache: "1d"
});

console.log(`KKPhim Stremio addon listening on http://${host}:${port}`);
console.log(`Manifest: http://localhost:${port}/manifest.json`);
