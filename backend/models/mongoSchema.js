const mongoose = require("mongoose")

// Use environment variable when provided; fall back to local Mongo
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/HostelManagement";

mongoose.connect(MONGO_URI)
.then(()=>{
  console.log("MongoDB connected")
})
.catch((err)=>{
  console.log("MongoDB connection error:", err.message)
})

const adminuserSchema = new mongoose.Schema({
  Name: { type: String, required: true },
  Email: { type: String, required: true },
  Password: { type: String, required: false },
  Status: {
    type: Boolean,
    default: true
  }
})

const otpSchema = new mongoose.Schema({
  Email: { type: String, required: true },
  Passcode:{type:Number,required:true},
  Count:{type:Number,required:false}
});

const userSchema = new mongoose.Schema({
  Name:{type:String,required:true},
  Room:{type:Number,required:true},
  Branch:{type:String,required:true},
  College:{type:String,required:true},
  JoinDate:{type:Date,required:true},
  PhoneNumber:{type:String,required:true,unique:true}
})

const paymentSchema = new mongoose.Schema({
  PhoneNumber:{type:String,required:true},
  Month:{type:String,required:true},
  Date:{type:Date,required:true},
  Amount:{type:String,required:true},
  TransactionId:{type:String,required:true},
  Mode:{type:String,required:true}
})

const vacateSchema = new mongoose.Schema({
  Name: { type: String, required: true },
  Room: { type: Number, required: true },
  Branch: { type: String, required: true },
  College: { type: String, required: true },
  JoinDate: { type: Date, required: true },
  PhoneNumber: { type: String, required: true ,unique:false},
  VacateDate:{type:Date,required:false,default:new Date()}
});


const signupuserSchema = new mongoose.Schema({
  PhoneNumber:{type:String,required:true},
  Passcode:{type:String,required:true}
})

const onlinepaymentSchema = new mongoose.Schema({
  order_id: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    required: true,
    default: "created",
  },
  receipt: {
    type: String,
    required: true,
  },
  PhoneNumber: {
    type: String,
    required: true,
  },
});

const adminuser = mongoose.model("AdminUsers",adminuserSchema)
const otpverify = mongoose.model("otps",otpSchema)
const user = mongoose.model("Users",userSchema)
const payment = mongoose.model("Payments",paymentSchema)
const vacate = mongoose.model("Vacatedetailslist",vacateSchema)
const signupuser = mongoose.model("usersignupdetails",signupuserSchema)
const onlinepayment = mongoose.model("OnlinePayments",onlinepaymentSchema)

module.exports = {adminuser,otpverify,user,payment,vacate,signupuser,onlinepayment}