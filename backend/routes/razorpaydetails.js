const Razorpay = require("razorpay");
require("dotenv").config();

let razorpay = null;

// Only initialize Razorpay if credentials are provided
if (process.env.razorpaykeyid && process.env.razorpaykey) {
  razorpay = new Razorpay({
    key_id: process.env.razorpaykeyid,
    key_secret: process.env.razorpaykey,
  });
  console.log("Razorpay initialized successfully");
} else {
  console.warn("Razorpay credentials not found. Payment functionality will be disabled.");
}

module.exports = { Razorpay, razorpay };