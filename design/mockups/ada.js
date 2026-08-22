/* ADA mockups — inyecta avatares de agente ("blobs con ojos") e íconos.
   Uso: <i class="blob" data-shape="square|bean|drop|star|cat" data-color="mint|lavender|peach|pink|sky|yellow"></i>
        <i class="ico" data-ico="thread|page|clock|eye|lock|plus|search|send|bell|more|check|chev|arrow|dots|at|upload|history|copy|edit|share|x|users|bolt"></i>
*/
(function () {
  var COLORS = {
    mint:    ["#bdebd3", "#8fd9b6"],
    lavender:["#d8d3ff", "#b3aaff"],
    peach:   ["#ffd5bd", "#ffb891"],
    pink:    ["#ffcfe1", "#ffa9c9"],
    sky:     ["#cbe2ff", "#a3c8ff"],
    yellow:  ["#ffe27a", "#ffd84d"],
    multi:   ["#d8d3ff", "#bdebd3"]
  };
  var SHAPES = {
    // all in a 40x40 box
    square: "M9 4 h22 a6 6 0 0 1 6 6 v22 a6 6 0 0 1 -6 6 h-22 a6 6 0 0 1 -6 -6 v-22 a6 6 0 0 1 6 -6 z",
    bean:   "M10 6 C22 0 40 8 37 22 C35 34 22 40 11 36 C0 32 -1 12 10 6 z",
    drop:   "M20 2 C27 12 36 18 36 26 A16 16 0 0 1 4 26 C4 18 13 12 20 2 z",
    star:   "M20 2 L25 13 L37 14 L28 22 L31 34 L20 28 L9 34 L12 22 L3 14 L15 13 z",
    cat:    "M6 10 L13 4 L17 9 L23 9 L27 4 L34 10 C38 18 38 30 30 36 C22 39 18 39 10 36 C2 30 2 18 6 10 z",
    cloud:  "M12 14 A8 8 0 0 1 27 11 A7 7 0 0 1 36 22 A7 7 0 0 1 30 34 L10 34 A7 7 0 0 1 6 20 A7 7 0 0 1 12 14 z"
  };
  function blobSVG(shape, color, eyes) {
    var c = COLORS[color] || COLORS.mint;
    var d = SHAPES[shape] || SHAPES.square;
    var id = "g" + Math.random().toString(36).slice(2, 8);
    var eyeY = shape === "drop" ? 24 : shape === "cat" ? 22 : 19;
    var look = eyes === "left" ? -1.2 : eyes === "right" ? 1.2 : 0;
    var eyesSvg = eyes === "closed"
      ? '<path d="M11 ' + eyeY + ' q4 3 8 0 M21 ' + eyeY + ' q4 3 8 0" stroke="#1c1b18" stroke-width="2" fill="none" stroke-linecap="round"/>'
      : '<ellipse cx="15" cy="' + eyeY + '" rx="5.2" ry="5.6" fill="#fff"/>' +
        '<ellipse cx="25" cy="' + eyeY + '" rx="5.2" ry="5.6" fill="#fff"/>' +
        '<circle cx="' + (15.8 + look) + '" cy="' + (eyeY + 0.8) + '" r="2.6" fill="#1c1b18"/>' +
        '<circle cx="' + (25.8 + look) + '" cy="' + (eyeY + 0.8) + '" r="2.6" fill="#1c1b18"/>' +
        '<circle cx="' + (16.8 + look) + '" cy="' + (eyeY - 0.4) + '" r="0.8" fill="#fff"/>' +
        '<circle cx="' + (26.8 + look) + '" cy="' + (eyeY - 0.4) + '" r="0.8" fill="#fff"/>';
    return '<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + c[0] + '"/><stop offset="1" stop-color="' + c[1] + '"/></linearGradient></defs>' +
      '<path d="' + d + '" fill="url(#' + id + ')"/>' +
      '<path d="' + d + '" fill="none" stroke="rgba(28,27,24,.10)" stroke-width="1"/>' +
      eyesSvg + '</svg>';
  }

  var ICONS = {
    thread: '<path d="M3 4h10v7H7l-3 3V4z"/><path d="M9 11h4v3"/>',
    page:   '<path d="M4 2h6l3 3v9H4z"/><path d="M10 2v3h3"/><path d="M6 8h5M6 11h5"/>',
    clock:  '<circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 1.5"/>',
    eye:    '<path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/>',
    lock:   '<rect x="3.5" y="7" width="9" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>',
    plus:   '<path d="M8 3v10M3 8h10"/>',
    search: '<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/>',
    send:   '<path d="M8 13V3M4 7l4-4 4 4"/>',
    bell:   '<path d="M4 11V7a4 4 0 0 1 8 0v4l1 1H3l1-1z"/><path d="M6.5 13.5a1.5 1.5 0 0 0 3 0"/>',
    more:   '<circle cx="3.5" cy="8" r="1.2"/><circle cx="8" cy="8" r="1.2"/><circle cx="12.5" cy="8" r="1.2"/>',
    check:  '<path d="M3 8.5l3 3 7-7"/>',
    chev:   '<path d="M6 4l4 4-4 4"/>',
    chevd:  '<path d="M4 6l4 4 4-4"/>',
    arrow:  '<path d="M3 8h10M9 4l4 4-4 4"/>',
    at:     '<circle cx="8" cy="8" r="3"/><path d="M11 8v1.5a1.5 1.5 0 0 0 3 0V8a6 6 0 1 0-2.5 4.9"/>',
    upload: '<path d="M8 11V3M4.5 6.5L8 3l3.5 3.5"/><path d="M3 13h10"/>',
    history:'<path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9"/><path d="M2 3v3h3"/><path d="M8 5.5V8l2 1.2"/>',
    copy:   '<rect x="5" y="5" width="8" height="8" rx="1.5"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5"/>',
    edit:   '<path d="M3 13l1-3.5L11 2.5l2.5 2.5L6.5 12 3 13z"/>',
    share:  '<path d="M6 4H3.5A1.5 1.5 0 0 0 2 5.5v7A1.5 1.5 0 0 0 3.5 14h7a1.5 1.5 0 0 0 1.5-1.5V10"/><path d="M9 2h5v5M14 2L7 9"/>',
    x:      '<path d="M4 4l8 8M12 4l-8 8"/>',
    users:  '<circle cx="6" cy="5.5" r="2.5"/><path d="M1.5 13a4.5 4.5 0 0 1 9 0"/><path d="M11 3.5a2.5 2.5 0 0 1 0 4.6M14.5 13a4.5 4.5 0 0 0-3.5-4.3"/>',
    bolt:   '<path d="M9 1.5L3 9h4l-1 5.5L13 7H9l1-5.5z"/>',
    link:   '<path d="M6.5 9.5l3-3"/><path d="M7 11l-1 1a2.5 2.5 0 0 1-3.5-3.5l2-2A2.5 2.5 0 0 1 8 6.5"/><path d="M9 5l1-1a2.5 2.5 0 0 1 3.5 3.5l-2 2A2.5 2.5 0 0 1 8 9.5"/>',
    key:    '<circle cx="5.5" cy="10.5" r="3"/><path d="M7.5 8.5L13 3M11 5l2 2M9.5 6.5L11 8"/>',
    hash:   '<path d="M6 2L4.5 14M11.5 2L10 14M2.5 6h11M2 10h11"/>',
    file:   '<path d="M4 2h6l3 3v9H4z"/><path d="M10 2v3h3"/>',
    spark:  '<path d="M8 2l1.5 4.5L14 8l-4.5 1.5L8 14l-1.5-4.5L2 8l4.5-1.5z"/>',
    replace:'<path d="M3 6.5A5 5 0 0 1 12.5 5"/><path d="M13 2v3.5H9.5"/><path d="M13 9.5A5 5 0 0 1 3.5 11"/><path d="M3 14v-3.5h3.5"/>',
    archive:'<rect x="2" y="3" width="12" height="3" rx="1"/><path d="M3 6v7h10V6"/><path d="M6.5 9h3"/>',
    calendar:'<rect x="2" y="3.5" width="12" height="10.5" rx="1.5"/><path d="M2 7h12M5 2v3M11 2v3"/>',
    sort:   '<path d="M3 4h10M5 8h6M7 12h2"/>',
    filter: '<path d="M2 3h12l-4.5 5.5V13l-3-1.5V8.5z"/>',
    grid:   '<rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/>',
    home:   '<path d="M2 8l6-5.5L14 8"/><path d="M4 7v6h8V7"/>',
    layers: '<path d="M8 2l6 3-6 3-6-3 6-3z"/><path d="M2 8l6 3 6-3M2 11l6 3 6-3"/>'
  };
  function icoSVG(name) {
    return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || ICONS.page) + '</svg>';
  }

  function run() {
    var blobs = document.querySelectorAll(".blob");
    for (var i = 0; i < blobs.length; i++) {
      var b = blobs[i];
      if (b.querySelector("svg")) continue;
      var pres = b.getAttribute("data-pres");
      b.insertAdjacentHTML("afterbegin", blobSVG(b.getAttribute("data-shape") || "square", b.getAttribute("data-color") || "mint", b.getAttribute("data-eyes") || ""));
      if (pres) { var p = document.createElement("span"); p.className = "pres " + pres; b.appendChild(p); }
    }
    var icos = document.querySelectorAll(".ico");
    for (var j = 0; j < icos.length; j++) {
      var el = icos[j];
      if (el.querySelector("svg")) continue;
      el.innerHTML = icoSVG(el.getAttribute("data-ico"));
      el.style.display = "inline-grid"; el.style.placeItems = "center";
      if (!el.style.width) { el.style.width = el.style.height = (el.getAttribute("data-size") || "15") + "px"; }
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();
})();
