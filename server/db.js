/**
 * Database connection and models
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Connect to MongoDB Atlas
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB Atlas connected");
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
  }
}

// User Schema
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
  },
  { timestamps: true },
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// History Schema
const historySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    fileName: { type: String, required: true },
    summary: {
      totalTransactions: Number,
      creditCount: Number,
      debitCount: Number,
      totalCredit: Number,
      totalDebit: Number,
      daysCovered: Number,
      monthCount: Number,
      months: { type: mongoose.Schema.Types.Mixed, default: [] },
      dateRange: { start: String, end: String },
    },
    transactions: { type: Array, default: [] },
  },
  { timestamps: true },
);

const User = mongoose.model("User", userSchema);
const History = mongoose.model("History", historySchema);

module.exports = { connectDB, User, History };
