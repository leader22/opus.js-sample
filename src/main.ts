import { Test } from "./app.js";

const app = new Test();

// Inputをそのまま
document.getElementById("play").addEventListener("click", () => {
  app.play();
});

// OPUSでEncode/Decodeする
document.getElementById("encdecplay").addEventListener("click", () => {
  app.encode_decode_play();
});
