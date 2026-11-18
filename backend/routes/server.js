
const express = require('express');
const app = express();
// Load env as early as possible so downstream modules can read vars
require('dotenv').config();
const { adminuser, otpverify, user, payment, vacate, signupuser, onlinepayment } = require("../models/mongoSchema");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const axios = require("axios");
// Avoid requiring `node-fetch` (v3 is ESM-only and can crash on require()).
// Use axios for HTTP requests or the global fetch in newer Node versions.
// const fetch = require("node-fetch");
const crypto = require('crypto');
const bcrypt = require("bcrypt");
const mongoose = require('mongoose');
const { Razorpay, razorpay } = require("./razorpaydetails");
const path = require("path");

// In-memory debugging storage for last generated OTP (development only)
let __lastOtp = null;
let __lastOtpEmail = null;
let __lastOtpTimestamp = null;

// Configure CORS to allow requests from any origin during development
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from frontend directory
const fs = require('fs');
const frontendPath = path.resolve(__dirname, '../../frontend');
const homepagePath = path.join(frontendPath, 'Homepage');

if (fs.existsSync(frontendPath)) {
  // Serve all static files from frontend directory (including index.html)
  app.use(express.static(frontendPath));
  console.log('Serving static files from:', frontendPath);
  
  // Explicit route for home page
  app.get('/Homepage/home1.html', (req, res) => {
    const homePage = path.join(homepagePath, 'home1.html');
    if (fs.existsSync(homePage)) {
      return res.sendFile(homePage);
    }
    console.error('Home page not found at:', homePage);
    return res.status(404).send('Home page not found');
  });
  
  // Serve analysis page and its assets
  const analysisPath = path.join(frontendPath, 'hostelanalysis');
  app.use('/hostelanalysis', express.static(analysisPath));
  
  // Explicit route for analysis page
  app.get('/hostelanalysis/analysispage.html', (req, res) => {
    const analysisPage = path.join(analysisPath, 'analysispage.html');
    if (fs.existsSync(analysisPage)) {
      return res.sendFile(analysisPage);
    }
    console.error('Analysis page not found at:', analysisPage);
    return res.status(404).send('Analysis page not found');
  });
  
  // Serve other analysis assets
  app.get('/hostelanalysis/:file', (req, res) => {
    const filePath = path.join(analysisPath, req.params.file);
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }
    console.error('File not found:', filePath);
    return res.status(404).send('File not found');
  });
  
  console.log('Homepage path:', homepagePath);
} else {
  console.error('Frontend directory not found at:', frontendPath);
}

// Env already loaded above

// Add request logging (with password redaction)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  if (
    req.body &&
    typeof req.body === "object" &&
    Object.keys(req.body).length > 0
  ) {
    const safeBody = { ...req.body };
    for (const key of Object.keys(safeBody)) {
      if (/pass|secret|token|otp/i.test(key)) {
        safeBody[key] = "***";
      }
    }
    console.log("Request body:", JSON.stringify(safeBody, null, 2));
  }
  next();
});

// Ensure admin accounts have a hashed password (supports default admin setup)
async function ensureAdminPasswords() {
  try {
    const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || "admin123";
    const admins = await adminuser.find({});
    if (admins.length === 0) {
      const hash = await bcrypt.hash(defaultPassword, 10);
      await adminuser.create({
        Name: "Admin User",
        Email: "admin@hostel.com",
        Password: hash,
        Status: true,
      });
      console.log("Created default admin account: admin@hostel.com");
      return;
    }

    for (const adm of admins) {
      if (!adm.Password) {
        const hash = await bcrypt.hash(defaultPassword, 10);
        await adminuser.updateOne({ _id: adm._id }, { $set: { Password: hash } });
        console.log(`Initialized default password for admin: ${adm.Email}`);
      }
    }
  } catch (err) {
    console.error("Failed to initialize admin passwords:", err.message);
  }
}

if (mongoose.connection.readyState === 1) {
  ensureAdminPasswords();
} else {
  mongoose.connection.once("open", ensureAdminPasswords);
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

//authentication
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  
  if (!token) {
    console.log("No token provided");
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  jwt.verify(token, process.env.secrettoken || 'your-secret-key', (err, user) => {
    if (err) {
      console.log("Token verification failed:", err.message);
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
}

// Admin login with Email + Password
app.post("/adminlogin", async (req, res) => {
  try {
    const rawEmail = req.body.email || req.body.Email || "";
    const password = req.body.password || req.body.Password || "";
    const email = String(rawEmail).trim();

    if (!email || !password) {
      return res.status(400).json({
        data: "error",
        message: "Email and password are required",
      });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({
        data: "error",
        message: "Database not connected",
      });
    }

    const userData = await adminuser.findOne({
      Email: new RegExp("^" + escapeRegex(email) + "$", "i"),
    });

    if (!userData) {
      return res.json({
        data: "notexist",
        message: "No admin account found with this email",
      });
    }

    if (!userData.Status) {
      return res.json({
        data: "notactive",
        message: "This admin account is inactive. Please contact support.",
      });
    }

    if (!userData.Password) {
      return res.json({
        data: "error",
        message: "Password is not configured for this admin account",
      });
    }

    const isMatch = await bcrypt.compare(password, userData.Password);
    if (!isMatch) {
      return res.json({
        data: "wrongpassword",
        message: "Incorrect password. Please try again.",
      });
    }

    const token = jwt.sign(
      {
        email: userData.Email,
        userId: userData._id,
        role: "admin",
      },
      process.env.secrettoken || "your-secret-key",
      { expiresIn: "24h" }
    );

    return res.json({
      data: "success",
      token,
      Name: userData.Name,
      user: {
        id: userData._id,
        name: userData.Name,
        email: userData.Email,
        role: "admin",
      },
      message: "Login successful",
    });
  } catch (error) {
    console.error("Admin login error:", error);
    return res.status(500).json({
      data: "error",
      message: "An error occurred during login. Please try again.",
    });
  }
});

//login otp verify
app.post("/userverifylogin", async (req, res) => {
  try {
    // Accept either `Email` or `email` from the client
    const Email = req.body.Email || req.body.email;
    console.log("OTP request for email:", Email); // Debug log

    // Basic validation
    if (!Email) {
      console.warn("No email provided in /userverifylogin request");
      return res.status(400).json({ data: "error", message: "Email is required" });
    }

    // Check mongoose connection
    if (mongoose.connection.readyState !== 1) {
      console.error("MongoDB is not connected. readyState=", mongoose.connection.readyState);
      return res.status(500).json({ data: "error", message: "Database not connected" });
    }
    
    // Check if email exists
    const exist = await adminuser.findOne({ Email: Email });
    console.log("User found:", exist); // Debug log
    
    if (!exist) {
      return res.send("notexist"); // Changed to match frontend expectation
    }
    
    if (!exist.Status) {
      return res.send("notactive"); // Changed to match frontend expectation
    }

    // Generate and save OTP
    const otp = Math.floor(1000 + Math.random() * 9000);
    await otpverify.deleteMany({ Email: Email }); // Clean up old OTPs
    await otpverify.create({
      Email: Email,
      Passcode: otp,
    });

    // Log OTP for testing (remove or disable in production)
    __lastOtp = otp;
    __lastOtpEmail = Email;
    __lastOtpTimestamp = new Date().toISOString();

    console.log('==================== OTP GENERATED ====================');
    console.log(`Time : ${__lastOtpTimestamp}`);
    console.log(`Email: ${__lastOtpEmail}`);
    console.log(`OTP  : ${__lastOtp}`);
    console.log('======================================================');

    // Email sending (temporarily disabled for testing)
    try {
      var SibApiV3Sdk = require("sib-api-v3-sdk");
      var defaultClient = SibApiV3Sdk.ApiClient.instance;
      defaultClient.authentications["api-key"].apiKey = process.env.mailapikey;

      var apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
      var sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

      sendSmtpEmail.sender = { 
        name: "Verification", 
        email: "noreply@campus-cove.com" 
      };
      sendSmtpEmail.to = [{ email: Email }];
      sendSmtpEmail.subject = "Your OTP for Login";
      sendSmtpEmail.htmlContent = `
        <p>Your OTP for login is: <strong>${otp}</strong></p>
        <p>This OTP is valid for 10 minutes.</p>
      `;

      const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
      console.log("Email sent successfully:", data);
    } catch (emailError) {
      // Log detailed info about the email error (status and response body when available)
      console.error("Error sending email:", emailError && emailError.message ? emailError.message : emailError);
      if (emailError && emailError.response) {
        try {
          console.error("Email API status:", emailError.response.status);
          console.error("Email API body:", JSON.stringify(emailError.response.body || emailError.response, null, 2));
        } catch (e) {
          console.error("Error while logging emailError.response:", e);
        }
      }
      // Continue even if email fails, since we're logging the OTP
    }

    res.send("success");
  } catch (error) {
    console.error("Error in /userverifylogin:", error);
    res.status(500).json({ data: "error", message: error.message || "Internal server error" });
  }
});

// Development-only debug endpoint to fetch the last generated OTP
app.get('/debug/last-otp', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!__lastOtp) {
    return res.json({ data: 'none', message: 'No OTP generated yet' });
  }

  return res.json({
    data: 'ok',
    email: __lastOtpEmail,
    otp: __lastOtp,
    timestamp: __lastOtpTimestamp
  });
});

//login into account
app.post("/loginaccount", async (req, res) => {
  const { Email, Otp } = req.body;
  
  try {
    // Input validation
    if (!Email || !Otp) {
      return res.status(400).json({ 
        data: "error",
        message: "Email and OTP are required" 
      });
    }

    const userData = await adminuser.findOne({ Email });
    const otpData = await otpverify.findOne({ Email });
    
    // Check if user exists and is active
    if (!userData) {
      return res.json({ 
        data: "notexist",
        message: "User not found" 
      });
    }
    
    if (!userData.Status) {
      return res.json({ 
        data: "notactive",
        message: "Account is not active. Please contact admin." 
      });
    }
    
    // Check if OTP exists
    if (!otpData) {
      console.log('No OTP found for email:', Email);
      return res.json({ 
        data: "invalid",
        message: "No OTP found. Please request a new one." 
      });
    }
    
    // Log OTP verification attempt
    console.log('OTP Verification -', {
      email: Email,
      storedOTP: otpData.Passcode,
      receivedOTP: Otp,
      otpType: { 
        stored: typeof otpData.Passcode, 
        received: typeof Otp 
      }
    });
    
    // Convert both to string for comparison to avoid type issues
    if (String(otpData.Passcode) !== String(Otp)) {
      // Increment failed attempt count
      const newCount = (otpData.Count || 0) + 1;
      
      if (newCount >= 3) {
        // Block account after 3 failed attempts
        await adminuser.updateOne({ Email }, { $set: { Status: false } });
        await otpverify.deleteOne({ Email });
        
        return res.json({ 
          data: "noattempts",
          message: "Too many failed attempts. Account has been blocked. Please contact admin." 
        });
      } else {
        // Update failed attempt count
        await otpverify.updateOne({ Email }, { $set: { Count: newCount } });
        
        return res.json({ 
          data: "wrongotp",
          message: `Incorrect OTP. ${3 - newCount} attempts remaining.` 
        });
      }
    }
    
    // If we get here, OTP is correct
    // Delete the used OTP
    await otpverify.deleteOne({ Email });
    
    // Create JWT token
    const token = jwt.sign(
      { 
        email: userData.Email,
        userId: userData._id,
        role: userData.role || 'user' 
      },
      process.env.secrettoken || 'your-secret-key',
      { expiresIn: '24h' }
    );
    
    // Send success response with user data
    console.log(`Login successful for ${Email} (id=${userData._id})`);
    return res.json({ 
      data: "success",
      token,
      Name: userData.Name,
      user: {
        id: userData._id,
        name: userData.Name,
        email: userData.Email,
        role: userData.role || 'user'
      },
      message: "Login successful"
    });
    
  } catch (error) {
    console.error("Login error:", error);
    // Clean up OTP in case of error
    await otpverify.deleteOne({ Email }).catch(console.error);
    
    return res.status(500).json({ 
      data: "error",
      message: "An error occurred during login. Please try again."
    });
  }
});

//hotel first user onboarding

app.post("/onboarduser",async(req,res)=>{
  try{
    const { username, userroom, userbranch, usercollege, userjoiningdate, userphone,_id} = req.body;
    if(_id.length>0){
      await user.updateOne({_id},{$set:{Name:username,Room:userroom,Branch:userbranch,College:usercollege,JoinDate:userjoiningdate}})
      return res.json({data:"updated"})
    }
    const userexist = await user.findOne({PhoneNumber:userphone})
    if(userexist){
      return res.json({data:"exist"})
    }
    await user.create({
      Name:username,
      Room:userroom,
      Branch:userbranch,
      College:usercollege,
      JoinDate:new Date(userjoiningdate),
      PhoneNumber:userphone
    })
    await sendWelcomeSMS(userphone, username,userroom).catch(() => {});
    return res.json({data:"created"})

  }
  catch(err){
    console.log("error is",err.message)
    return res.json({data:"failed",mess:err.message})
  }
})

//members list
app.get("/memberslist",async(req,res)=>{
  try{
    const usersdetails = await user.find({},{__v:0})
    console.log(usersdetails)
    return res.send(usersdetails)
  }
  catch(err){
    return res.json({error:err.message})
  }
})

//authenticate

app.post("/authenticate",authenticateToken,async(req,res)=>{
  return res.json({data:"ok"})
})

//delete member------------

app.post('/deleteMember',async(req,res)=>{
  try{
    const{_id} = req.body;
    const userdetails = await user.findOne({_id})
    await vacate.create({
      Name:userdetails.Name,
      Room:userdetails.Room,
      Branch:userdetails.Branch,
      College:userdetails.College,
      JoinDate:userdetails.JoinDate,
      PhoneNumber:userdetails.PhoneNumber
    })
    await user.deleteOne({_id})
    return res.json({data:"success"})
  }
  catch(err){
    console.log(err.message)
    return res.json({data:"failed"})
  }
})

//editing member details
app.post("/editmember",async(req,res)=>{
  try{
    const {_id} = req.body;
    const userdetails = await user.findOne({_id},{__v:0})
    console.log(userdetails)
    return res.send(userdetails)
  }
  catch(err){
    console.log(err.message)
  }
})
//total hostlers
app.get("/totalhostlers",async(req,res)=>{
  try{
    const userscount = await user.aggregate([{
      $count:"Total_users"
    }])
    const count = userscount[0].Total_users;
    res.send(count)
  }
  catch(err){
    console.log(err)
  }
})

//searching the name to verify when adding payment
app.post('/namesearch',async(req,res)=>{
  try{
    const {Phonenumber} = req.body;
    console.log(Phonenumber)
    const userdata = await user.findOne({PhoneNumber:Phonenumber})
    const username = userdata.Name;
    return res.send(username)
  }
  catch(err){
    console.log(err.message)
  }
})

//searching vacate history
app.get("/vacatehistory",async(req,res)=>{

  try {
    const usersdetails = await vacate.find({}, { __v: 0 }).sort({Date:-1})
    console.log(usersdetails)
    return res.send(usersdetails);
  } catch (err) {
    console.log(err.message)
    return res.json({ error: err.message });
  }

})

//user signup
app.post("/usersignup",async(req,res)=>{

  try{
    const {mobilenumber,password} = req.body;
    const userexist = await user.find({PhoneNumber:mobilenumber})
    if(userexist.length==0){
      return res.json({data:"noaccess"})
    }
    const usersignupexist = await signupuser.find({PhoneNumber:mobilenumber})
    if(usersignupexist.length==1){
      return res.json({data:"exist"})
    }
    const hash =await  bcrypt.hash(password,10)
    await signupuser.create({
      PhoneNumber:mobilenumber,
      Passcode:hash
    })
    return res.json({data:"success"})

  }
  catch(err){
    console.log(err.message)
    return res.json({data:"fail"})

  }

})

//users login route
app.post("/userlogin",async(req,res)=>{

  try{
    const {mobilenumber,password} = req.body;
    const phone = String(mobilenumber || "").trim();
    if (!phone || !password) {
      return res.json({ data: "error", message: "Mobile number and password are required" });
    }
    const userexist = await signupuser.find({PhoneNumber:phone})
    if(userexist.length==0){
      return res.json({data:"notexist"})
    }
    // Defensive: ensure we have a stored passcode
    if (!userexist[0] || !userexist[0].Passcode) {
      return res.json({ data: "notexist" });
    }

    const result = await bcrypt.compare(password, userexist[0].Passcode)
    if(!result){
      return res.json({data:"wrongpassword"})
    }
    const username = await user.findOne({PhoneNumber:phone})
    const token = jwt.sign(
      { mobilenumber: phone, role: "student" },
      process.env.secrettoken || 'your-secret-key',
      { expiresIn: "3h" }
    );
    return res.json({data:"success",Name:username ? username.Name : "Student",token})

  }
  catch(err){
    console.log(err)
    res.json({data:"fail"})
  }

})

//total number of days user stayed in hostel

app.get("/mystaydays", authenticateToken, async (req, res) => {
  try {
    const phone = req.user.mobilenumber;
    const u = await user.findOne({ PhoneNumber: phone });
    const join = new Date(u.JoinDate);
    const today = new Date();
    const diffMs = today.getTime() - join.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    res.send(days.toString());
    console.log(days)
  } catch (err) {
    console.log(err.message)
    res.json({data:"fail"})
  }
});

//present month payment details
app.get("/mypaymentstatus", authenticateToken, async (req, res) => {
  try {
    const phone = req.user.mobilenumber;
    const now = new Date();
    const months = [
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
    const currentMonth = months[now.getMonth()];

    const pay = await payment.findOne({
      PhoneNumber: phone,
      Month: currentMonth,
    });
    if (pay) {
      res.send("Paid");
    } else {
      res.send("Not Paid");
    }
  } catch (err) {
    res.send("Not Paid");
  }
});

//fetching user profile

app.get("/myprofile", authenticateToken, async (req, res) => {
  try {
    const phone = req.user.mobilenumber;
    const u = await user.findOne({ PhoneNumber: phone });
    res.json(u);
  } catch (err) {
    res.json({});
  }
});

//user payment history

app.get("/mypayments", authenticateToken, async (req, res) => {
  try {
    const phone = req.user.mobilenumber;
    const pays = await payment.find({ PhoneNumber: phone }).sort({ Date: -1 });
    console.log(pays)
    res.json(pays);
  } catch (err) {
    res.json([]);
  }
});



//adding payment to database
app.post("/addpayment",async(req,res)=>{
  try{
    const { paymentphone, paymentmonth, paymentdate, paymentamount, paymenttxn, paymentmode } = req.body;

    const userexist = await user.findOne({ PhoneNumber: paymentphone })
    if(!userexist){
      return res.json({data:"nouser"})
    }

    const paymentexist = await payment.findOne({ PhoneNumber: paymentphone, Month: paymentmonth })
    if(paymentexist){
      return res.json({data:"exist"})
    }

    await payment.create({
      PhoneNumber: paymentphone,
      Month: paymentmonth,
      Date: new Date(paymentdate),
      Amount: paymentamount,
      TransactionId: paymenttxn,
      Mode: paymentmode
    })

    await sendPaymentSms(paymentphone,paymentamount,paymentdate.slice(0,10)).catch(() => {});

    return res.json({data:"created"})
  }
  catch(err){
    console.log("error is",err.message)
    return res.json({data:"failed",mess:err.message})
  }
})

//fetching payments
app.post("/fetchpayments",async(req,res)=>{
  try{
    const { fetchmonth } = req.body;
    const paymentslist = await payment.find({Month:fetchmonth},{__v:0}).sort({Date:-1})
    return res.send(paymentslist)
  }
  catch(err){
    console.log("error is",err.message)
    return res.json({data:"failed",mess:err.message})
  }
})

//fetching payment history
app.post("/paymenthistory", async (req, res) => {
  try {
    const { historyphone } = req.body;
    const history = await payment
      .find({ PhoneNumber: historyphone }, { __v: 0 })
      .sort({ Date: -1 });
    return res.send(history);
  } catch (err) {
    console.log("error is", err.message);
    return res.json({ data: "failed", mess: err.message });
  }
});

//fetching members by room
app.post("/roommembers",async(req,res)=>{
  try{
    const { roomno } = req.body;
    const members = await user.find({Room:roomno},{__v:0}).sort({Name:1})
    return res.send(members)
  }
  catch(err){
    console.log("error is",err.message)
    return res.json({data:"failed",mess:err.message})
  }
})

//day wise members

//fetching day-wise joined members
app.post("/daywisemembers",async(req,res)=>{
  try{
    const { dayno } = req.body;
    const members = await user.find(
      { $expr: { $eq: [ { $dayOfMonth: "$JoinDate" }, Number(dayno) ] } },
      { __v:0 }
    ).sort({Name:1})
    return res.send(members)
  }
  catch(err){
    console.log("error is",err.message)
    return res.json({data:"failed",mess:err.message})
  }
})


//payment pending members for a month
app.post("/pendingmembers",async(req,res)=>{
  try{
    const { pendingmonth } = req.body;
    const paidphones = await payment.distinct("PhoneNumber",{Month:pendingmonth})
    const pending = await user.find(
      { PhoneNumber: { $nin: paidphones } },
      { __v:0 }
    ).sort({Room:1,Name:1})
    return res.send(pending)
  }
  catch(err){
    console.log("error is",err.message)
    return res.json({data:"failed",mess:err.message})
  }
})

//function for sending welcome user
async function sendWelcomeSMS(number, name,room) {
  const url = "https://www.fast2sms.com/dev/bulkV2";
  const body = new URLSearchParams({
    route: "q",
    language: "english",
    message: `Hi ${name}, welcome to Rajesh Hostels! ,we have allocated Room no ${room} to you.We're happy to have you with us. Wishing you a comfortable and memorable stay.`,
    numbers: String(number).trim(),
  });

  const { data } = await axios.post(url, body, {
    headers: {
      authorization: process.env.FAST2SMS_API_KEY,
      "content-type": "application/x-www-form-urlencoded",
    },
    timeout: 15000,
  });

  return data;
}

//payment list
app.get("/paymentslist", authenticateToken, async (req, res) => {
  const rows = await payment.find({}, "PhoneNumber Amount Month Date").lean();
  res.json(rows);
});




//sending payment received message
async function sendPaymentSms(number,amount,date) {
  const url = "https://www.fast2sms.com/dev/bulkV2";
  const body = new URLSearchParams({
    route: "q",
    language: "english",
    message: `Hostel fee of ₹${amount} received on ${date}.
  Thank you for your payment 
   — Rajesh Hostels`,
    numbers: String(number).trim(),
  });

  const { data } = await axios.post(url, body, {
    headers: {
      authorization: process.env.FAST2SMS_API_KEY,
      "content-type": "application/x-www-form-urlencoded",
    },
    timeout: 15000,
  });

  console.log(data)
}


// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', message: 'API is working!', timestamp: new Date().toISOString() });
});

// Razorpay routes - only available if Razorpay is initialized
if (razorpay) {
  // Razorpay initialization code here
  console.log("Razorpay routes are enabled");
} else {
  console.log("Razorpay routes are disabled - no API keys provided");
  
  // Add a dummy route to handle payment requests when Razorpay is disabled
  app.post("/razorpay/orders", (req, res) => {
    res.status(200).json({
      success: false,
      message: "Online payments are currently disabled. Please contact support."
    });
  });
}

app.post("/createorder", async (req, res) => {
  const { amount, currency, receipt,mobilenumber } = req.body;
  try {
    if (!mobilenumber) {
      return res.status(400).json({ error: "Mobile number is required" });
    }
    const order = await razorpay.orders.create({ amount, currency, receipt });
    console.log(order)

    await onlinepayment.create({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
      receipt: order.receipt,
      PhoneNumber: mobilenumber,
    });

    res.json(order);
  } catch (err) {
    console.log(err)
    res.status(500).send(err);
  }
});

//payment verifying-----------------------------------------
app.post("/verify-payment", async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    req.body;

  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.razorpaykey)
    .update(body.toString())
    .digest("hex");

  if (expectedSignature === razorpay_signature) {
    await onlinepayment.updateOne(
      { order_id: razorpay_order_id },
      { $set: { status: "paid" } }
    );
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false });
  }
});

app.get("/roommates", authenticateToken, async (req, res) => {
  const phone = req.user.mobilenumber;
  const me = await user.findOne({ PhoneNumber: phone });
  const mates = await user.find({ Room: me.Room });
  res.json({ room: me.Room, members: mates });
});

//sending menu

app.get("/download", (req, res) => {
  try{
  const filePath = path.join(__dirname,"menuhostel.pdf");
  res.download(filePath, "menuhoostel.pdf", (err) => {
    if (err) {
      console.error("Error while sending the file:", err);
      res.status(500).send("Error downloading the file");
    } else {
      console.log("File downloaded successfully");
    }
  })
}
catch(err){
  console.log(err.message)
}
});




// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log('MongoDB Connected...');
});
