const API_BASE_URL =
  window.API_BASE_URL ||
  (window.location && window.location.origin && window.location.origin !== "null"
    ? window.location.origin
    : "http://localhost:5000");

function api(path) {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function save(event) {
  event.preventDefault();
  const mobile = document.getElementById("signin-email").value.trim();
  const password = document.getElementById("signin-password").value;

  if (!mobile || !password) {
    (Toast && Toast.warn) ? Toast.warn("Please enter mobile number and password") : alert("Please enter mobile number and password");
    return;
  }

  const payload = {
    mobilenumber: mobile.toLowerCase(),
    password: password,
  };

  if (typeof Loader !== 'undefined') Loader.show();
  axios
    .post(api("/userlogin"), payload)
    .then((response) => {
      const status = response?.data?.data;
      if (status === "notexist") {
        (Toast && Toast.error) ? Toast.error("User not exist, check mobile number again") : alert("User not exist, check mobile number again");
      } else if (status === "wrongpassword") {
        (Toast && Toast.error) ? Toast.error("Password entered wrongly! Please check again.") : alert("Password entered wrongly! Please check again.");
      } else if (status === "success") {
        try{ var remember=document.getElementById('rememberme'); if(remember&&remember.checked){ localStorage.setItem('remember_phone', mobile);} else { localStorage.removeItem('remember_phone'); } }catch(e){}
        (Toast && Toast.success) ? Toast.success("Login successful") : alert("Login successful");
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("name", response.data.Name);
        window.location.href = "/userhomepage/campuscove.html";
      } else {
        (Toast && Toast.error) ? Toast.error("Internal server error") : alert("Internal server error");
      }
    })
    .catch((err) => {
      console.error("Login error:", err);
      (Toast && Toast.error) ? Toast.error("Unable to login. Please try again later.") : alert("Unable to login. Please try again later.");
    })
    .finally(()=>{
      if (typeof Loader !== 'undefined') Loader.hide();
    });
}