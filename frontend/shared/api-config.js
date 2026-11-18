(function () {
  if (window.API_BASE_URL) {
    return;
  }

  var protocol =
    window.API_PROTOCOL ||
    (window.location && (window.location.protocol === "http:" || window.location.protocol === "https:")
      ? window.location.protocol
      : "http:");

  var hostname =
    window.API_HOSTNAME ||
    (window.location && window.location.hostname ? window.location.hostname : "localhost");

    var defaultPort = "5000";
    var inferredPort = window.API_PORT || defaultPort;

  var portSegment = inferredPort ? ":" + inferredPort : "";

  window.API_BASE_URL = protocol + "//" + hostname + portSegment;
})();

