// Base URL for API requests
const API_BASE_URL =
  window.API_BASE_URL ||
  (window.location && window.location.origin && window.location.origin !== "null"
    ? window.location.origin
    : "http://localhost:5000");

const FRONTEND_BASE_URL = `${window.location.origin}${window.location.pathname.split('/').slice(0, -2).join('/')}`;

const emailBtn = document.getElementById('email-btn');
const emailInput = document.getElementById('email');
const emailSection = document.getElementById('email-section');
const otpSection = document.getElementById('otp-section');
const infoText = document.getElementById('info-text');
const errorMsg = document.getElementById('error-msg');

if (!navigator.onLine) {
  document.body.innerHTML = "<p style='color: white;'>Please check your internet connection</p>";
}

document.getElementById("back").addEventListener("click", () => {
  window.location.href = `${FRONTEND_BASE_URL}/login/userlogin.html`;
});

function validateEmail(email) {
  return /\S+@\S+\.\S+/.test(email);
}

emailBtn.addEventListener('click', () => {
  const email = emailInput.value.trim();
  if (!validateEmail(email)) {
    errorMsg.classList.remove('hidden');
    return;
  }
  errorMsg.classList.add('hidden');
  emailSection.classList.add('hidden');
  otpSection.classList.remove('hidden');
  infoText.innerText = `Please enter the OTP sent to ${email}`;
});

async function emailotp(event) {
  event.preventDefault();
  const email = emailInput.value.trim();
  if (!email) {
    Toast && Toast.warn ? Toast.warn("Please enter your email") : alert("Please enter your email");
    return;
  }
  
  const obj = { Email: email };
  
  try {
    if (typeof Loader !== 'undefined') Loader.show();
    console.log("Sending OTP request to:", `${API_BASE_URL}/userverifylogin`);
    const response = await axios.post(`${API_BASE_URL}/userverifylogin`, obj, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });
    
    console.log("OTP Response:", response.data);
    
    if (response.data === "notexist") {
      (Toast && Toast.error) ? Toast.error("Your Email doesn't have admin access") : alert("Your Email id doesn't have admin access, please check your email");
    } else if (response.data === "success") {
      (Toast && Toast.success) ? Toast.success("OTP sent to your email") : alert("OTP sent successfully to your email");
      // Show OTP input section
      emailSection.classList.add('hidden');
      otpSection.classList.remove('hidden');
    } else if (response.data === "notactive") {
      (Toast && Toast.error) ? Toast.error("Account blocked due to multiple wrong OTPs") : alert("Due to multiple wrong OTPs, your account has been blocked. Please contact admin.");
    } else {
      (Toast && Toast.error) ? Toast.error("Unexpected response from server") : alert("Unexpected response from server. Please try again.");
    }
  } catch (error) {
    console.error("OTP Request Error:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        data: error.config?.data
      }
    });
    
    let errorMessage = "Failed to send OTP. ";
    if (error.code === 'ECONNABORTED') {
      errorMessage += "Request timed out. Please check your internet connection.";
    } else if (error.response) {
      // Server responded with error status
      errorMessage += `Server responded with status ${error.response.status}`;
    } else if (error.request) {
      // Request was made but no response received
      errorMessage += "No response from server. Please check if the backend is running.";
    } else {
      // Other errors
      errorMessage += error.message;
    }
    
    (Toast && Toast.error) ? Toast.error(errorMessage) : alert(errorMessage);
  } finally {
    if (typeof Loader !== 'undefined') Loader.hide();
  }
}

async function resendotp() {
  const email = emailInput.value;
  const obj = { Email: email };
  
  try {
    if (typeof Loader !== 'undefined') Loader.show();
    const response = await axios.post(`${API_BASE_URL}/userverifylogin`, obj, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data === "success") {
      (Toast && Toast.success) ? Toast.success("OTP resent successfully") : alert("OTP resent successfully");
    } else if (response.data === "notactive") {
      (Toast && Toast.error) ? Toast.error("Account is blocked. Please contact admin.") : alert("For security reasons, your account has been blocked. Please contact admin.");
    } else {
      (Toast && Toast.error) ? Toast.error("Something went wrong while sending OTP") : alert("Something went wrong while sending OTP");
    }
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error.response?.data?.message || error.message || "Failed to resend OTP";
    (Toast && Toast.error) ? Toast.error(`Error: ${errorMessage}`) : alert(`Error: ${errorMessage}`);
  } finally {
    if (typeof Loader !== 'undefined') Loader.hide();
  }
}

// Initialize OTP input handling when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Add event listener for OTP input fields
  const otpInputs = document.querySelectorAll('.otp-inputs input');
  const form = document.getElementById('otp-form');
  
  // Only proceed if we have OTP inputs
  if (otpInputs.length > 0) {
    otpInputs[0].focus(); // Focus first input field
    
    otpInputs.forEach((input, index) => {
      // Handle paste event for OTP
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const paste = (e.clipboardData || window.clipboardData).getData('text');
        const digits = paste.replace(/\D/g, '').split('').slice(0, 4);
        
        digits.forEach((digit, i) => {
          if (otpInputs[i]) {
            otpInputs[i].value = digit;
          }
        });
        
        // Focus the last input with a value or the last input
        const lastInput = Array.from(otpInputs).reverse().find(input => input.value) || otpInputs[otpInputs.length - 1];
        lastInput.focus();
      });
      
      // Handle input to move to next field
      input.addEventListener('input', (e) => {
        // Only allow numbers
        input.value = input.value.replace(/[^0-9]/g, '');
        
        // Move to next input on number input
        if (input.value && index < otpInputs.length - 1) {
          otpInputs[index + 1].focus();
        }
      });
      
      // Handle backspace to move to previous field
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
          if (!input.value && index > 0) {
            otpInputs[index - 1].focus();
          }
        }
      });
    });
  }
  
  // Form submission is handled by the onsubmit attribute
});

async function handleLogin(event) {
  if (event) event.preventDefault();
  
  const email = emailInput.value.trim();
  const otp = Array.from(document.querySelectorAll('.otp-inputs input'))
    .map(input => input.value.trim())
    .join('');

  // Validate OTP
  if (!otp || otp.length !== 4 || !/^\d{4}$/.test(otp)) {
    (Toast && Toast.warn) ? Toast.warn("Please enter a valid 4-digit OTP") : alert("Please enter a valid 4-digit OTP");
    return;
  }
  
  // Disable button and show loading state
  const verifyBtn = document.getElementById('verify-otp-btn');
  const originalText = verifyBtn.textContent;
  verifyBtn.disabled = true;
  verifyBtn.textContent = 'Verifying...';
  
  try {
    console.log('Sending OTP verification request:', { Email: email, Otp: otp });
    const response = await axios.post(`${API_BASE_URL}/loginaccount`, 
      { 
        Email: email, 
        Otp: otp,
        timestamp: new Date().toISOString()
      },
      {
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 15000, // 15 seconds timeout
        validateStatus: (status) => status < 500 // Reject only if status is 500 or higher
      }
    );
    
    // Handle different response statuses
    switch (response.data.data) {
      case "notactive":
        (Toast && Toast.error) ? Toast.error("Account blocked. Contact admin.") : alert("For security reasons, your account has been blocked. Please contact admin.");
        break;
      case "wrongotp":
        (Toast && Toast.error) ? Toast.error(response.data.message || "Incorrect OTP. Please try again.") : alert(response.data.message || "Incorrect OTP. Please try again.");
        // Clear OTP fields and focus first input
        document.querySelectorAll('.otp-inputs input').forEach(input => input.value = '');
        document.querySelector('.otp-inputs input')?.focus();
        break;
      case "noattempts":
        (Toast && Toast.error) ? Toast.error("Too many attempts. Account blocked.") : alert("For security purposes, we have blocked your account. Please contact admin.");
        break;
      case "success":
        // Store the token and user data
        console.log('Login successful, response data:', response.data);
        
        if (response.data.token) {
          localStorage.setItem("token", response.data.token);
        } else {
          console.warn('No token received in response');
        }
        
        if (response.data.Name) {
          localStorage.setItem("Name", response.data.Name);
        }

        if (response.data.user) {
          localStorage.setItem("user", JSON.stringify(response.data.user));
        }
        // Build redirect URL relative to the current page (more reliable across hosts/paths)
        const redirectUrl = new URL('../Homepage/home1.html', window.location.href).href;

        console.log('Attempting to redirect to:', redirectUrl);
        console.log('Current location:', window.location.href);

        try {
          // Try to use replace first
          window.location.replace(redirectUrl);

          // If we're still here after 500ms, try href as fallback
          setTimeout(() => {
            if (window.location.href !== redirectUrl) {
              console.log('Fallback redirect triggered');
              window.location.href = redirectUrl;
            }
          }, 500);
        } catch (e) {
          console.error('Redirect error:', e);
          // Last resort - try opening in new tab
          window.open(redirectUrl, '_self');
        }

        return; // Exit early on success
      default:
        throw new Error("Unexpected response from server");
    }
  } catch (error) {
    console.error("Login error:", error);
    let errorMessage = "Failed to verify OTP. ";

    if (error.code === 'ECONNABORTED') {
      errorMessage += "Request timed out. Please check your internet connection.";
    } else if (error.response) {
      // Server responded with error status
      errorMessage = error.response.data?.message || `Server responded with status ${error.response.status}`;
    } else if (error.request) {
      // Request was made but no response received
      errorMessage = "No response from server. Please try again later.";
    } else {
      // Other errors
      errorMessage = error.message || "An unknown error occurred";
    }

    (Toast && Toast.error) ? Toast.error(errorMessage) : alert(errorMessage);
  } finally {
    // Re-enable button and restore text
    if (verifyBtn) {
      verifyBtn.disabled = false;
      verifyBtn.textContent = originalText;
    }
    if (typeof Loader !== 'undefined') Loader.hide();
  }
}

// Keep the original login function for backward compatibility
async function login(event) {
  return handleLogin(event);
}