var app = new Test();
document.getElementById("play").addEventListener("click", function () {
    app.play();
});
document.getElementById("encdecplay").addEventListener("click", function () {
    app.encode_decode_play();
});
