const app = require("./api/index");
const PORT = process.env.PORT || 7000;

app.listen(PORT, () => {
  console.log(`Nuvio PhimAPI addon running at http://localhost:${PORT}`);
});
