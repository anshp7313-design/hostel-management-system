(function () {
  const API_BASE_URL =
    window.API_BASE_URL ||
    (window.location &&
    window.location.origin &&
    window.location.origin !== "null"
      ? window.location.origin
      : "http://localhost:5000");

  function api(path) {
    return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  }

  // DOM elements
  const tabStudent = document.getElementById("tab-student");
  const tabAdmin = document.getElementById("tab-admin");
  const panelTitle = document.getElementById("panel-title");
  const panelSubtitle = document.getElementById("panel-subtitle");
  const statusBanner = document.getElementById("status-banner");

  const studentLoginForm = document.getElementById("student-login-form");
  const studentSignupForm = document.getElementById("student-signup-form");
  const adminLoginForm = document.getElementById("admin-login-form");

  const studentPhoneInput = document.getElementById("student-phone");
  const studentPasswordInput = document.getElementById("student-password");
  const studentRememberInput = document.getElementById("student-remember");

  const signupPhoneInput = document.getElementById("signup-phone");
  const signupPasswordInput = document.getElementById("signup-password");
  const signupConfirmInput = document.getElementById("signup-confirm");
  const signupMismatchEl = document.getElementById("signup-mismatch");

  const adminEmailInput = document.getElementById("admin-email");
  const adminPasswordInput = document.getElementById("admin-password");
  const adminRememberInput = document.getElementById("admin-remember");

  const openSignupBtn = document.getElementById("open-signup-btn");
  const backToSigninBtn = document.getElementById("back-to-signin-btn");

  let activeRole = "student"; // "student" | "admin"
  let studentMode = "signin"; // "signin" | "signup"

  function showStatus(message, type) {
    statusBanner.textContent = message;
    statusBanner.className = `status-banner visible ${type || "info"}`;
  }

  function clearStatus() {
    statusBanner.textContent = "";
    statusBanner.className = "status-banner";
  }

  function setButtonLoading(button, isLoading, loadingText, defaultText) {
    if (!button) return;
    button.disabled = isLoading;
    button.textContent = isLoading ? loadingText : defaultText;
  }

  function updateUrlParams(role, mode) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", role);
      if (role === "student" && mode === "signup") {
        url.searchParams.set("mode", "signup");
      } else {
        url.searchParams.delete("mode");
      }
      window.history.replaceState({}, "", url.toString());
    } catch (e) {
      // Ignore history errors in restricted contexts
    }
  }

  function renderView(opts) {
    const keepBanner = opts && opts.keepBanner;
    if (!keepBanner) clearStatus();

    const isStudent = activeRole === "student";
    tabStudent.classList.toggle("active", isStudent);
    tabStudent.setAttribute("aria-selected", String(isStudent));
    tabAdmin.classList.toggle("active", !isStudent);
    tabAdmin.setAttribute("aria-selected", String(!isStudent));

    studentLoginForm.classList.add("hidden");
    studentSignupForm.classList.add("hidden");
    adminLoginForm.classList.add("hidden");

    if (isStudent && studentMode === "signin") {
      panelTitle.textContent = "Student Sign In";
      panelSubtitle.textContent = "Access your room details, stay summary, and payment history.";
      studentLoginForm.classList.remove("hidden");
      studentPhoneInput.focus();
    } else if (isStudent && studentMode === "signup") {
      panelTitle.textContent = "Create Student Account";
      panelSubtitle.textContent = "Use the mobile number registered with the hostel office.";
      studentSignupForm.classList.remove("hidden");
      signupPhoneInput.focus();
    } else {
      panelTitle.textContent = "Admin Sign In";
      panelSubtitle.textContent = "Manage hostel residents, rooms, payments, and analytics.";
      adminLoginForm.classList.remove("hidden");
      adminEmailInput.focus();
    }

    updateUrlParams(activeRole, studentMode);
  }

  // Tab & mode switches
  tabStudent.addEventListener("click", () => {
    activeRole = "student";
    studentMode = "signin";
    renderView();
  });

  tabAdmin.addEventListener("click", () => {
    activeRole = "admin";
    renderView();
  });

  openSignupBtn.addEventListener("click", () => {
    activeRole = "student";
    studentMode = "signup";
    signupMismatchEl.textContent = "";
    renderView();
  });

  backToSigninBtn.addEventListener("click", () => {
    activeRole = "student";
    studentMode = "signin";
    renderView();
  });

  // Password visibility toggles
  document.querySelectorAll(".toggle-password").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const input = document.getElementById(targetId);
      if (!input) return;
      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      btn.textContent = isHidden ? "Hide" : "Show";
      btn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
    });
  });

  // Live password match check on signup
  function clearMismatch() {
    signupMismatchEl.textContent = "";
  }
  signupPasswordInput.addEventListener("input", clearMismatch);
  signupConfirmInput.addEventListener("input", clearMismatch);

  // Restore remembered identifiers
  try {
    const savedPhone = localStorage.getItem("remember_phone");
    if (savedPhone) {
      studentPhoneInput.value = savedPhone;
      studentRememberInput.checked = true;
    }
    const savedAdminEmail = localStorage.getItem("remember_admin_email");
    if (savedAdminEmail) {
      adminEmailInput.value = savedAdminEmail;
      adminRememberInput.checked = true;
    }
  } catch (e) {}

  // Student Sign In submit
  studentLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearStatus();

    const mobile = studentPhoneInput.value.trim();
    const password = studentPasswordInput.value;
    if (!mobile || !password) {
      showStatus("Please enter your mobile number and password.", "error");
      return;
    }

    const submitBtn = document.getElementById("student-login-btn");
    setButtonLoading(submitBtn, true, "Signing in...", "Sign In");

    try {
      const response = await axios.post(api("/userlogin"), {
        mobilenumber: mobile,
        password: password,
      });

      const status = response?.data?.data;
      if (status === "success") {
        try {
          if (studentRememberInput.checked) {
            localStorage.setItem("remember_phone", mobile);
          } else {
            localStorage.removeItem("remember_phone");
          }
          localStorage.setItem("token", response.data.token);
          localStorage.setItem("name", response.data.Name || "Student");
        } catch (e) {}

        showStatus("Login successful! Redirecting to your dashboard...", "success");
        window.location.href = "/userhomepage/campuscove.html";
        return;
      } else if (status === "notexist") {
        showStatus("No account found for this mobile number. Try creating an account first.", "error");
      } else if (status === "wrongpassword") {
        showStatus("Incorrect password. Please try again.", "error");
      } else {
        showStatus(response?.data?.message || "Unable to sign in. Please try again.", "error");
      }
    } catch (err) {
      console.error("Student login error:", err);
      showStatus("Could not reach the server. Please check that the backend is running.", "error");
    } finally {
      setButtonLoading(submitBtn, false, "Signing in...", "Sign In");
    }
  });

  // Student Create Account submit
  studentSignupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearStatus();
    signupMismatchEl.textContent = "";

    const mobile = signupPhoneInput.value.trim();
    const pass1 = signupPasswordInput.value;
    const pass2 = signupConfirmInput.value;

    if (!mobile || !pass1 || !pass2) {
      showStatus("Please fill in all fields.", "error");
      return;
    }

    if (pass1.length < 6) {
      signupMismatchEl.textContent = "Password must be at least 6 characters.";
      return;
    }

    if (pass1 !== pass2) {
      signupMismatchEl.textContent = "Passwords do not match.";
      return;
    }

    const submitBtn = document.getElementById("student-signup-btn");
    setButtonLoading(submitBtn, true, "Creating account...", "Create Account");

    try {
      const response = await axios.post(api("/usersignup"), {
        mobilenumber: mobile,
        password: pass1,
      });

      const status = response?.data?.data;
      if (status === "success") {
        studentSignupForm.reset();
        studentPhoneInput.value = mobile;
        studentPasswordInput.value = "";
        activeRole = "student";
        studentMode = "signin";
        showStatus("Account created! You can now sign in with your password.", "success");
        renderView({ keepBanner: true });
        studentPasswordInput.focus();
      } else if (status === "noaccess") {
        showStatus(
          "This mobile number is not registered yet. Ask your hostel admin to onboard you first.",
          "error"
        );
      } else if (status === "exist") {
        studentPhoneInput.value = mobile;
        activeRole = "student";
        studentMode = "signin";
        showStatus("An account already exists for this number. Please sign in.", "info");
        renderView({ keepBanner: true });
        studentPasswordInput.focus();
      } else {
        showStatus("Something went wrong during signup. Please try again.", "error");
      }
    } catch (err) {
      console.error("Student signup error:", err);
      showStatus("Could not reach the server. Please try again.", "error");
    } finally {
      setButtonLoading(submitBtn, false, "Creating account...", "Create Account");
    }
  });

  // Admin Sign In submit
  adminLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearStatus();

    const email = adminEmailInput.value.trim();
    const password = adminPasswordInput.value;

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      showStatus("Please enter a valid admin email address.", "error");
      return;
    }

    if (!password) {
      showStatus("Please enter your password.", "error");
      return;
    }

    const submitBtn = document.getElementById("admin-login-btn");
    setButtonLoading(submitBtn, true, "Signing in...", "Sign In as Admin");

    try {
      const response = await axios.post(api("/adminlogin"), {
        email: email,
        password: password,
      });

      const data = response?.data || {};
      if (data.data === "success") {
        try {
          if (adminRememberInput.checked) {
            localStorage.setItem("remember_admin_email", email);
          } else {
            localStorage.removeItem("remember_admin_email");
          }
          if (data.token) localStorage.setItem("token", data.token);
          if (data.Name) localStorage.setItem("Name", data.Name);
          if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
        } catch (e) {}

        showStatus("Welcome back! Opening Admin Dashboard...", "success");
        window.location.href = "/Homepage/home1.html";
        return;
      } else if (data.data === "notexist") {
        showStatus(data.message || "No admin account found with this email.", "error");
      } else if (data.data === "notactive") {
        showStatus(data.message || "This admin account is inactive.", "error");
      } else if (data.data === "wrongpassword") {
        showStatus(data.message || "Incorrect password. Please try again.", "error");
      } else {
        showStatus(data.message || "Unable to sign in. Please try again.", "error");
      }
    } catch (err) {
      console.error("Admin login error:", err);
      const msg =
        err?.response?.data?.message ||
        "Could not reach the server. Please check that the backend is running.";
      showStatus(msg, "error");
    } finally {
      setButtonLoading(submitBtn, false, "Signing in...", "Sign In as Admin");
    }
  });

  // Initial tab & mode from URL query params
  const params = new URLSearchParams(window.location.search);
  const initialTab = (params.get("tab") || "").toLowerCase();
  const initialMode = (params.get("mode") || "").toLowerCase();

  if (initialTab === "admin") {
    activeRole = "admin";
  } else {
    activeRole = "student";
    studentMode = initialMode === "signup" ? "signup" : "signin";
  }

  renderView();
})();
