// months
var monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// state
var allMembers = [];
var allPayments = [];
var currentYear = new Date().getFullYear();
var HOME_PAGE_RELATIVE = "../Homepage/home1.html";
var HOME_PAGE_ABSOLUTE = "/frontend/Homepage/home1.html";

/**
 * Build the best possible URL for the dashboard regardless of how
 * the analysis page was opened (file://, http(s)://, new tab etc).
 */
function buildDashboardUrl() {
    // 1. If we arrived from the dashboard, reuse that exact URL.
    if (document.referrer) {
        try {
            var ref = new URL(document.referrer);
            if (
                (!window.location.origin || ref.origin === window.location.origin) &&
                ref.pathname.toLowerCase().includes("/homepage/")
            ) {
                return ref.href;
            }
        } catch (err) {
            console.warn("Could not parse referrer:", err);
        }
    }

    // 2. Derive the path by swapping /hostelanalysis/... with /Homepage/home1.html
    try {
        var current = new URL(window.location.href);
        var lowerPath = current.pathname.toLowerCase();
        var marker = "/hostelanalysis/";
        if (lowerPath.includes(marker)) {
            current.pathname =
                current.pathname.substring(0, lowerPath.indexOf(marker)) +
                "/Homepage/home1.html";
            return current.href;
        }
    } catch (err) {
        console.warn("Could not derive dashboard path from location:", err);
    }

    // 3. Fall back to origin + absolute path (works for http servers)
    if (window.location.origin && window.location.origin !== "null") {
        return window.location.origin + HOME_PAGE_ABSOLUTE;
    }

    // 4. Last resort: relative path resolution (covers file:// usage)
    try {
        return new URL(HOME_PAGE_RELATIVE, window.location.href).href;
    } catch (err) {
        console.warn("Could not resolve relative dashboard URL:", err);
    }

    return HOME_PAGE_ABSOLUTE;
}

/**
 * Wire up the Back button so it always returns to the dashboard.
 */
function setupBackButton() {
    var backBtn = document.getElementById("backBtn");
    if (!backBtn) {
        console.error("Back button not found!");
        return;
    }

    backBtn.style.position = "relative";
    backBtn.style.zIndex = "1000";
    backBtn.style.cursor = "pointer";

    backBtn.onclick = function (event) {
        event.preventDefault();
        var dashboardUrl = buildDashboardUrl();
        console.log("Back button ->", dashboardUrl);
        window.location.href = dashboardUrl;
    };

    console.log("Back button setup complete");
}

// Run when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupBackButton);
} else {
    // DOMContentLoaded has already fired
    setupBackButton();
}

// API base URL provided by shared config (fallback to current origin)
const API_BASE_URL =
  window.API_BASE_URL ||
  (window.location && window.location.origin && window.location.origin !== "null"
    ? window.location.origin
    : "http://localhost:5000");

function asArray(x) {
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.data)) return x.data;
  if (x && Array.isArray(x.items)) return x.items;
  if (x && Array.isArray(x.results)) return x.results;
  if (x && Array.isArray(x.payments)) return x.payments;
  if (x && Array.isArray(x.members)) return x.members;
  return [];
}

// just to see what came back if still empty
function debugDump(what, obj) {
  if (obj.length === 0) {
    console.log(what + " looked empty. raw=", obj);
  }
}

// load and draw
window.onload = function () {
  var token = localStorage.getItem("token") || "";

  axios
    .get(`${API_BASE_URL}/memberslist`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    .then(function (res) {
      allMembers = asArray(res.data);
      debugDump("members", allMembers);

      return axios
        .get(`${API_BASE_URL}/paymentslist`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
    })
    .then(function (res) {
      allPayments = asArray(res.data);
      debugDump("payments", allPayments);
      drawPage();
    })
    .catch(function (err) {
      console.log("load error:", err && (err.message || err));
      allPayments = [];
      drawPage();
    });
};

function drawPage() {
  setKpis();
  drawJoinsChart();
  drawOntimeChart();
  drawRevenueChart();
}


function setKpis() {
  // total
  var total = allMembers.length;
  document.getElementById("kpiTotal").innerText = total;

  // joins this month
  var now = new Date();
  var y = now.getFullYear();
  var m = now.getMonth();
  var joins = 0;

  for (var i = 0; i < allMembers.length; i++) {
    var d = new Date(allMembers[i].JoinDate);
    if (d.getFullYear() === y && d.getMonth() === m) {
      joins = joins + 1;
    }
  }
  document.getElementById("kpiJoins").innerText = joins;

  // revenue this month
  var rev = getRevenueForMonth(y, m);
  document.getElementById("kpiRevenue").innerText = "₹" + rev;

  // on-time % this month
  var pct = getOntimePercentForMonth(y, m);
  document.getElementById("kpiOntime").innerText =
    pct === null ? "-" : pct + "%";
}


function getRevenueForMonth(y, m) {
  var sum = 0;
  var monthLabel = monthNames[m];

  for (var i = 0; i < allPayments.length; i++) {
    var pay = allPayments[i];

    // prefer Date
    if (pay.Date) {
      var pd = new Date(pay.Date);
      if (pd.getFullYear() === y && pd.getMonth() === m) {
        sum = sum + Number(pay.Amount || 0);
        continue;
      }
    }
   
    if (pay.Month === monthLabel) {
      sum = sum + Number(pay.Amount || 0);
    }
  }
  return sum;
}


function getOntimePercentForMonth(y, m) {
  var active = 0;
  var ontime = 0;

  var monthStart = new Date(y, m, 1);
  var monthEnd = new Date(y, m + 1, 0);

  for (var i = 0; i < allMembers.length; i++) {
    var member = allMembers[i];
    var jd = new Date(member.JoinDate);

    if (jd > monthEnd) continue; // not active yet

    active = active + 1;

    var joinDay = jd.getDate();
    var dueDay = Math.min(joinDay, daysInMonth(y, m));
    var dueDate = new Date(y, m, dueDay);
    var graceEnd = addDays(dueDate, 5);

    var paidOnTime = false;

    for (var p = 0; p < allPayments.length; p++) {
      var pay = allPayments[p];
      if (pay.PhoneNumber !== member.PhoneNumber) continue;
      if (!pay.Date) continue;

      var payDate = new Date(pay.Date);
      if (payDate >= monthStart && payDate <= graceEnd) {
        paidOnTime = true;
        break;
      }
    }

    if (paidOnTime) ontime = ontime + 1;
  }

  if (active === 0) return null;
  return Math.round((ontime / active) * 100);
}

function daysInMonth(y, m) {
  return new Date(y, m + 1, 0).getDate();
}

function addDays(d, days) {
  var n = new Date(d.getTime());
  n.setDate(n.getDate() + days);
  return n;
}


function getJoinsByMonth() {
  var arr = new Array(12).fill(0);
  for (var i = 0; i < allMembers.length; i++) {
    var d = new Date(allMembers[i].JoinDate);
    if (d.getFullYear() === currentYear) {
      arr[d.getMonth()] = arr[d.getMonth()] + 1;
    }
  }
  return arr;
}

function getOntimePercentByMonth() {
  var arr = [];
  for (var m = 0; m < 12; m++) {
    var pct = getOntimePercentForMonth(currentYear, m);
    arr.push(pct === null ? 0 : pct);
  }
  return arr;
}

function getRevenueByMonth() {
  var arr = new Array(12).fill(0);
  for (var i = 0; i < allPayments.length; i++) {
    var pay = allPayments[i];
    if (pay.Date) {
      var d = new Date(pay.Date);
      if (d.getFullYear() === currentYear) {
        arr[d.getMonth()] = arr[d.getMonth()] + Number(pay.Amount || 0);
        continue;
      }
    }
    if (pay.Month) {
      var idx = monthNames.indexOf(pay.Month);
      if (idx > -1) arr[idx] = arr[idx] + Number(pay.Amount || 0);
    }
  }
  return arr;
}


function drawJoinsChart() {
  var ctx = document.getElementById("joinsChart").getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: monthNames,
      datasets: [
        {
          label: "Joins",
          data: getJoinsByMonth(),
          backgroundColor: [
            "#36a2eb",
            "#ff6384",
            "#ffcd56",
            "#4bc0c0",
            "#9966ff",
            "#ff9f40",
            "#26c6da",
            "#ab47bc",
            "#66bb6a",
            "#ef5350",
            "#5c6bc0",
            "#26a69a",
          ],
        },
      ],
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } },
    },
  });
}

function drawOntimeChart() {
  var ctx = document.getElementById("ontimeChart").getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: monthNames,
      datasets: [
        {
          label: "On-Time %",
          data: getOntimePercentByMonth(),
          backgroundColor: new Array(12).fill("#4bc0c0"),
        },
      ],
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, max: 100 } },
    },
  });
}

function drawRevenueChart() {
  var ctx = document.getElementById("revenueChart").getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: monthNames,
      datasets: [
        {
          label: "Revenue (₹)",
          data: getRevenueByMonth(),
          backgroundColor: new Array(12).fill("#ffcd56"),
        },
      ],
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } },
    },
  });
}
