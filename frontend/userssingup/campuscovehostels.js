const API_BASE_URL =
  window.API_BASE_URL ||
  (window.location && window.location.origin && window.location.origin !== "null"
    ? window.location.origin
    : "http://localhost:5000");

function api(path) {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function resetPasswordWarning() {
  document.getElementById("passwordwrong").innerHTML = "";
}

document
  .getElementById("signup-password")
  .addEventListener("focus", resetPasswordWarning);
document
  .getElementById("signup-repassword")
  .addEventListener("focus", resetPasswordWarning);

function save(event) {
  event.preventDefault();
  const pass1 = document.getElementById("signup-password").value;
  const pass2 = document.getElementById("signup-repassword").value;
  const mobile = document.getElementById("signup-mobile").value.trim();

  if (!mobile || !pass1 || !pass2) {
    (Toast && Toast.warn) ? Toast.warn("All fields are required") : alert("All fields are required");
    return;
  }

  if (pass1 !== pass2) {
    document.getElementById("passwordwrong").innerHTML =
      "* Both password should be same";
    return;
  }

  const payload = {
    mobilenumber: mobile.toLowerCase(),
    password: pass1,
  };

  if (typeof Loader !== 'undefined') Loader.show();
  axios
    .post(api("/usersignup"), payload)
    .then((result) => {
      const status = result?.data?.data;
      if (status === "noaccess") {
        (Toast && Toast.error) ? Toast.error("Given mobile number has no access. Contact admin.") : alert("Given mobile number has no access, kindly signup with the provided number");
      } else if (status === "exist") {
        (Toast && Toast.info) ? Toast.info("User already has an account. Please login.") : alert("User already has an account. Please login.");
        window.location.href = "/userslogin/campuscovehostels.html";
      } else if (status === "success") {
        (Toast && Toast.success) ? Toast.success("Signup successful. You can login now.") : alert("Signup successful. You can login now.");
      } else {
        (Toast && Toast.error) ? Toast.error("Something went wrong. Please try again.") : alert("Something went wrong. Please try again.");
      }
    })
    .catch((err) => {
      console.error("Signup error:", err);
      (Toast && Toast.error) ? Toast.error("Unable to signup. Please try again later.") : alert("Unable to signup. Please try again later.");
    })
    .finally(()=>{
      if (typeof Loader !== 'undefined') Loader.hide();
    });
}