require("dotenv").config();
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const {
  adminuser,
  user,
  payment,
  vacate,
  signupuser,
} = require("./models/mongoSchema");

async function waitForConnection() {
  if (mongoose.connection.readyState === 1) return;
  await new Promise((resolve, reject) => {
    mongoose.connection.once("open", resolve);
    mongoose.connection.once("error", reject);
  });
}

async function seed() {
  await waitForConnection();
  console.log("Connected to MongoDB. Seeding sample data...");

  const now = new Date();
  const year = now.getFullYear();

  // 1. Ensure default admin has password "admin123"
  const adminPasswordHash = await bcrypt.hash("admin123", 10);
  const existingAdmin = await adminuser.findOne({ Email: "admin@hostel.com" });
  if (!existingAdmin) {
    await adminuser.create({
      Name: "Admin User",
      Email: "admin@hostel.com",
      Password: adminPasswordHash,
      Status: true,
    });
    console.log("Created admin: admin@hostel.com / admin123");
  } else {
    await adminuser.updateOne(
      { _id: existingAdmin._id },
      { $set: { Password: adminPasswordHash, Status: true } }
    );
    console.log("Updated admin: admin@hostel.com / admin123");
  }

  // Drop stale unique email_1 index on users collection if present (userSchema has no email field)
  try {
    const indexes = await user.collection.indexes();
    if (indexes.some((idx) => idx.name === "email_1")) {
      await user.collection.dropIndex("email_1");
      console.log("Dropped stale email_1 index on users collection");
    }
  } catch (idxErr) {
    console.warn("Could not inspect/drop email_1 index:", idxErr.message);
  }

  // 2. Active Students (Users)
  const sampleUsers = [
    { Name: "aarav sharma", Room: 101, Branch: "cse", College: "vignan university", JoinDate: new Date(year, 0, 5), PhoneNumber: "9876543210" },
    { Name: "priya patel", Room: 101, Branch: "aiml", College: "vignan university", JoinDate: new Date(year, 1, 10), PhoneNumber: "9876543211" },
    { Name: "rohan verma", Room: 102, Branch: "ece", College: "kl university", JoinDate: new Date(year, 0, 15), PhoneNumber: "9876543212" },
    { Name: "ananya reddy", Room: 102, Branch: "cse", College: "kl university", JoinDate: new Date(year, 2, 5), PhoneNumber: "9876543213" },
    { Name: "karthik nair", Room: 103, Branch: "it", College: "srm ap", JoinDate: new Date(year, 3, 1), PhoneNumber: "9876543214" },
    { Name: "sneha gupta", Room: 201, Branch: "cse", College: "vit ap", JoinDate: new Date(year, 4, 10), PhoneNumber: "9876543215" },
    { Name: "vikram singh", Room: 201, Branch: "mech", College: "vit ap", JoinDate: new Date(year, 5, 15), PhoneNumber: "9876543216" },
    { Name: "divya menon", Room: 202, Branch: "eee", College: "khit guntur", JoinDate: new Date(year, 6, 1), PhoneNumber: "9876543217" },
    { Name: "arjun desai", Room: 301, Branch: "cse", College: "khit guntur", JoinDate: new Date(year, 6, 20), PhoneNumber: "9876543218" },
    { Name: "meera iyer", Room: 301, Branch: "it", College: "vignan university", JoinDate: new Date(year, 7, 5), PhoneNumber: "9876543219" },
    { Name: "siddharth rao", Room: 302, Branch: "ece", College: "srm ap", JoinDate: new Date(year, 8, 10), PhoneNumber: "9876543220" },
    { Name: "neha joshi", Room: 401, Branch: "aiml", College: "kl university", JoinDate: new Date(year, 9, 1), PhoneNumber: "9876543221" },
  ];

  let addedUsers = 0;
  for (const u of sampleUsers) {
    const exists = await user.findOne({ PhoneNumber: u.PhoneNumber });
    if (!exists) {
      await user.create(u);
      addedUsers++;
    }
  }
  console.log(`Users seeded: ${addedUsers} added (${sampleUsers.length} total sample residents)`);

  // 3. Pre-registered Student Login accounts (password: student123)
  const studentPasswordHash = await bcrypt.hash("student123", 10);
  const preSignedUpPhones = ["9876543210", "9876543211", "9876543212"];
  let addedSignups = 0;
  for (const phone of preSignedUpPhones) {
    const exists = await signupuser.findOne({ PhoneNumber: phone });
    if (!exists) {
      await signupuser.create({
        PhoneNumber: phone,
        Passcode: studentPasswordHash,
      });
      addedSignups++;
    }
  }
  console.log(`Student logins seeded: ${addedSignups} added (password: student123)`);

  // 4. Monthly Payments (August, September, October, November)
  const monthDefs = [
    { name: "August", monthIndex: 7, paidCount: 10 },
    { name: "September", monthIndex: 8, paidCount: 11 },
    { name: "October", monthIndex: 9, paidCount: 12 },
    { name: "November", monthIndex: 10, paidCount: 8 }, // Leaves 4 students pending for current month
  ];

  let addedPayments = 0;
  let txnSeq = 1001;
  for (const m of monthDefs) {
    for (let i = 0; i < m.paidCount; i++) {
      const stu = sampleUsers[i];
      const exists = await payment.findOne({
        PhoneNumber: stu.PhoneNumber,
        Month: m.name,
      });
      if (!exists) {
        const amount = stu.Room >= 300 ? "7500" : "6500";
        const mode = i % 3 === 0 ? "Cash" : "Upi";
        const payDay = Math.min(2 + (i % 12), 18);
        await payment.create({
          PhoneNumber: stu.PhoneNumber,
          Month: m.name,
          Date: new Date(year, m.monthIndex, payDay),
          Amount: amount,
          TransactionId: `TXN${year}${String(m.monthIndex + 1).padStart(2, "0")}${txnSeq}`,
          Mode: mode,
        });
        addedPayments++;
      }
      txnSeq++;
    }
  }
  console.log(`Payments seeded: ${addedPayments} added`);

  // 5. Vacated Students History
  const sampleVacates = [
    {
      Name: "rahul kumar",
      Room: 104,
      Branch: "mech",
      College: "kl university",
      JoinDate: new Date(year - 1, 7, 12),
      PhoneNumber: "9123456780",
      VacateDate: new Date(year, 4, 30),
    },
    {
      Name: "pooja varma",
      Room: 203,
      Branch: "cse",
      College: "vignan university",
      JoinDate: new Date(year - 1, 6, 5),
      PhoneNumber: "9123456781",
      VacateDate: new Date(year, 6, 15),
    },
    {
      Name: "manish choudhary",
      Room: 303,
      Branch: "ece",
      College: "vit ap",
      JoinDate: new Date(year - 1, 8, 1),
      PhoneNumber: "9123456782",
      VacateDate: new Date(year, 8, 25),
    },
  ];

  let addedVacates = 0;
  for (const v of sampleVacates) {
    const exists = await vacate.findOne({ PhoneNumber: v.PhoneNumber });
    if (!exists) {
      await vacate.create(v);
      addedVacates++;
    }
  }
  console.log(`Vacate history seeded: ${addedVacates} added`);

  await mongoose.disconnect();
  console.log("Seeding complete!");
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
