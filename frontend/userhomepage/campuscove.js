const API_BASE_URL =
  window.API_BASE_URL ||
  (window.location && window.location.origin && window.location.origin !== "null"
    ? window.location.origin
    : "http://localhost:5000");

function api(path) {
  return path.startsWith("http")
    ? path
    : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function redirectToLogin() {
  window.location.href = "/userslogin/campuscovehostels.html";
}

function ensureLoggedIn() {
  if (!localStorage.getItem("token")) {
    redirectToLogin();
    return false;
  }
  return true;
}

function setWelcomeName() {
  const adminName = localStorage.getItem("name") || "Guest";
  const el = document.getElementById("admin-name");
  if (el) {
    el.textContent = `Welcome ${adminName}`;
  }
}

async function loadStayDays() {
  try {
    const res = await axios.get(api("/mystaydays"), { headers: authHeaders() });
    document.getElementById("count").innerText = res.data || 0;
  } catch (err) {
    console.error("Failed to load stay days:", err);
    document.getElementById("count").innerText = "-";
    handleAuthError(err);
  }
}

async function loadPaymentStatus() {
  try {
    const res = await axios.get(api("/mypaymentstatus"), {
      headers: authHeaders(),
    });
    document.getElementById("isdue").innerText = res.data || "Paid";
  } catch (err) {
    console.error("Failed to load payment status:", err);
    document.getElementById("isdue").innerText = "Not Paid";
    handleAuthError(err);
  }
}

async function loadProfile() {
  try {
    const res = await axios.get(api("/myprofile"), { headers: authHeaders() });
    const user = res.data || {};
    document.getElementById("name").innerText = `Name : ${user.Name || "-"}`;
    document.getElementById("roomnumber").innerText = `Room Number : ${
      user.Room || "-"
    }`;
    document.getElementById("branch").innerText = `Branch : ${
      user.Branch || "-"
    }`;
    document.getElementById("college").innerText = `College : ${
      user.College || "-"
    }`;
    document.getElementById("joindate").innerText = `Join Date : ${
      user.JoinDate ? user.JoinDate.slice(0, 10) : "-"
    }`;
    document.getElementById("mobilenumber").innerText = `Mobile Number: ${
      user.PhoneNumber || "-"
    }`;
  } catch (err) {
    console.error("Failed to load profile:", err);
    handleAuthError(err);
  }
}

async function loadPaymentHistory() {
  try {
    const res = await axios.get(api("/mypayments"), { headers: authHeaders() });
    const list = Array.isArray(res.data) ? res.data : [];
    const tbody = document.querySelector("#paymenthistoryTable tbody");
    tbody.innerHTML = "";
    list.forEach((p) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.Amount ?? "-"}</td>
        <td>${p.TransactionId ?? "-"}</td>
        <td>${p.Mode ?? "-"}</td>
        <td>${p.Date ? p.Date.slice(0, 10) : "-"}</td>
        <td>${p.Month ?? "-"}</td>
      `;
      tbody.appendChild(tr);
    });
    if (list.length === 0) {
      tbody.innerHTML = "<tr><td colspan='5'>No Records</td></tr>";
    }
  } catch (err) {
    console.error("Failed to load payment history:", err);
    const tbody = document.querySelector("#paymenthistoryTable tbody");
    tbody.innerHTML = "<tr><td colspan='5'>Unable to load data</td></tr>";
    handleAuthError(err);
  }
}

async function lookupMemberName(phone) {
  if (!phone) {
    document.getElementById("verifyName").innerText = "";
    return;
  }
  try {
    const res = await axios.post(api("/namesearch"), { Phonenumber: phone });
    document.getElementById("verifyName").innerText = res.data || "";
  } catch (err) {
    console.error("Name lookup failed:", err);
    document.getElementById("verifyName").innerText = "Lookup failed";
  }
}

async function loadRoomMembers() {
  try {
    const res = await axios.get(api("/roommates"), { headers: authHeaders() });
    const data = res.data || {};
    document.getElementById(
      "roomCountResult"
    ).innerText = `Room No: ${data.room || "-"}`;
    const ul = document.getElementById("roomMemberList");
    ul.innerHTML = "";
    (data.members || []).forEach((m) => {
      const li = document.createElement("li");
      li.innerText = `${m.Name} (${m.PhoneNumber})`;
      ul.appendChild(li);
    });
  } catch (err) {
    console.error("Failed to load room members:", err);
    handleAuthError(err);
  }
}

function handleAuthError(err) {
  if (err?.response?.status === 401) {
    (Toast && Toast.warn) ? Toast.warn("Session expired. Please login again.") : alert("Session expired. Please login again.");
    localStorage.removeItem("token");
    redirectToLogin();
  }
}

function setupDownloadButton() {
  const btn = document.getElementById("download");
  if (btn) {
    btn.addEventListener("click", () => {
      window.location.href = api("/download");
    });
  }
}

function setupPhoneLookup() {
  const input = document.getElementById("payPhone");
  if (!input) return;
  input.addEventListener("blur", () => lookupMemberName(input.value.trim()));
  input.addEventListener("input", () => {
    if (!input.value) {
      document.getElementById("verifyName").innerText = "";
    }
  });
}

function setupPaymentGateway() {
  const btn = document.getElementById("paymentsubmit-btn");
  if (!btn) return;

  btn.addEventListener("click", async (e) => {
    e.preventDefault();

    const phone = document.getElementById("payPhone").value.trim();
    const amountField = document.getElementById("amount");
    const month = document.getElementById("month").value;

    if (!phone || phone.length < 10) {
      (Toast && Toast.warn) ? Toast.warn("Please enter a valid mobile number.") : alert("Please enter a valid mobile number.");
      return;
    }

    if (!month) {
      (Toast && Toast.warn) ? Toast.warn("Please select a month.") : alert("Please select a month.");
      return;
    }

    const amountValue = parseInt(amountField.value, 10);
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      alert("Invalid amount");
      return;
    }

    const payload = {
      amount: amountValue * 100, // Razorpay expects paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      mobilenumber: phone,
    };

    try {
      const orderRes = await axios.post(api("/createorder"), payload);
      const orderData = orderRes.data;

      if (!orderData || !orderData.id) {
        (Toast && Toast.error) ? Toast.error("Failed to create payment order. Please try again later.") : alert("Failed to create payment order. Please try again later.");
        return;
      }

      const options = {
        key: "rzp_test_RCbunur8vK5qev",
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Hostel Fee",
        description: `Payment for ${month}`,
        order_id: orderData.id,
        handler: async function (response) {
          try {
            const verifyRes = await axios.post(
              api("/verify-payment"),
              response
            );
            if (verifyRes.data && verifyRes.data.success) {
              (Toast && Toast.success) ? Toast.success("Payment Successful!") : alert("Payment Successful!");
              loadPaymentStatus();
              loadPaymentHistory();
            } else {
              (Toast && Toast.error) ? Toast.error("Payment verification failed!") : alert("Payment verification failed!");
            }
          } catch (err) {
            console.error("Verification failed:", err);
            (Toast && Toast.error) ? Toast.error("Payment verification error") : alert("Payment verification error");
          }
        },
        prefill: {
          contact: phone,
        },
        theme: { color: "#3399cc" },
      };

      const rzp = new Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error("Error creating order:", err);
      (Toast && Toast.error) ? Toast.error("Error creating payment order") : alert("Error creating payment order");
    }
  });
}

function showSection(sectionId) {
  document.querySelectorAll(".content-section").forEach((section) => {
    section.classList.add("hidden");
  });
  const target = document.getElementById(sectionId);
  if (target) {
    target.classList.remove("hidden");
  }

  switch (sectionId) {
    case "dashboard":
      loadStayDays();
      loadPaymentStatus();
      break;
    case "myprofile":
      loadProfile();
      break;
    case "paymenthistory":
      loadPaymentHistory();
      break;
    case "roomCount":
      loadRoomMembers();
      break;
    default:
      break;
  }
}

window.showSection = showSection;

function init() {
  if (!ensureLoggedIn()) return;
  setWelcomeName();
  setupDownloadButton();
  setupPhoneLookup();
  setupPaymentGateway();
  showSection("dashboard");
}

window.logout = function () {
  if (confirm("Are you sure you want to logout?")) {
    localStorage.removeItem("token");
    localStorage.removeItem("name");
    redirectToLogin();
  }
};

document.addEventListener("DOMContentLoaded", init);