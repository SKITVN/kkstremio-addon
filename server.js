const { serveHTTP } = require("stremio-addon-sdk");
const { builder } = require("./addon");

const port = Number(process.env.PORT || 7000);
serveHTTP(builder.getInterface(), { port, cache: "1h" });
console.log(`KKPhim Stremio addon listening on ${port}`);
