import App from "./app.js";

const app = new App();

document.getElementById("play").addEventListener("click", () => {
  app.play();
});

document.getElementById("encdecplay").addEventListener("click", () => {
  app.encode_decode_play();
});
