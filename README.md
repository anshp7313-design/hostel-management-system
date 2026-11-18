# 🏠 Campus Cove Hostels — Hostel Management System

A full-stack web application for managing hostel operations including resident onboarding, room allocation, monthly fee tracking, analytics, and a student self-service portal.

Built with **Node.js**, **Express**, **MongoDB**, and vanilla **HTML / CSS / JavaScript**.

---

## ✨ Features

- 🔐 **Unified Login Portal** — Single landing page with **Student** and **Admin** tabs (`Email + Password` for admins, `Mobile Number + Password` for students, plus inline Student Account creation)
- 👥 **Resident Management** — Onboard, edit, search, and vacate hostel residents
- 🛏️ **Room & Day Views** — View residents by room number, joining day, or vacate history
- 💳 **Fee & Payment Tracking** — Record cash/UPI payments, inspect month-wise collections, view individual payment history, and track pending dues
- 📊 **Hostel Analytics** — Visual overview of occupancy and monthly collections
- 🎓 **Student Dashboard** — Students can check stay duration, monthly payment status, profile, roommates, and payment history

---

## 🧩 Tech Stack

- **Backend:** Node.js, Express 5, MongoDB, Mongoose, JWT, bcrypt
- **Frontend:** HTML5, CSS3, JavaScript, Axios

---

## ⚙️ Setup & Running Locally

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [MongoDB](https://www.mongodb.com/try/download/community) running locally on port `27017` (or a MongoDB Atlas connection string)

### 1. Clone the repository
```bash
git clone https://github.com/anshp7313-design/hostel-management-system.git
cd hostel-management-system
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Copy `.env.example` to `.env` and adjust values if needed:
```bash
cp .env.example .env
```

Key variables:
```env
MONGO_URI=mongodb://localhost:27017/hostel_management
PORT=5000
NODE_ENV=development
secrettoken=change_this_to_a_strong_secret_key
DEFAULT_ADMIN_PASSWORD=admin123
```

### 4. Seed sample data *(optional)*
Populate MongoDB with sample residents, payments, vacate history, and login accounts:
```bash
npm run seed
```

### 5. Start the server
```bash
npm start
```

Open **http://localhost:5000** in your browser.

---

## 🔑 Demo Accounts (after `npm run seed`)

| Role | Login Field | Password |
| --- | --- | --- |
| **Admin** | `admin@hostel.com` | `admin123` |
| **Student 1** *(Room 101)* | `9876543210` | `student123` |
| **Student 2** *(Room 101)* | `9876543211` | `student123` |
| **Student 3** *(Room 102)* | `9876543212` | `student123` |

> Students onboarded by an admin (such as `9876543213`–`9876543221` in the seed data) can register their own password using **Create Student Account** on the Student tab.

---

## 📁 Project Structure

```text
hostelmanagement/
├── backend/
│   ├── models/mongoSchema.js   # Mongoose schemas & DB connection
│   ├── routes/server.js        # Express API & static frontend server
│   ├── routes/razorpaydetails.js
│   └── seed.js                 # Idempotent sample data seeder
├── frontend/
│   ├── index.html              # Unified Student / Admin login portal
│   ├── shared/                 # Shared login UI, API config, toast/loader helpers
│   ├── Homepage/               # Admin dashboard
│   ├── hostelanalysis/         # Analytics page
│   └── userhomepage/           # Student dashboard
├── .env.example
├── package.json
└── README.md
```
