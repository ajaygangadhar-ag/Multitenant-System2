const mongoose = require("mongoose");

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI environment variable is missing!");
    }

    cached.promise = mongoose
      .connect(process.env.MONGO_URI, {
        dbName: "multitenantDB",
      })
      .then((mongooseInstance) => {
        console.log("✅ MongoDB Connected Successfully");
        return mongooseInstance;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    console.error("❌ MongoDB Connection Failed");
    console.error(error.message);
    throw error;
  }

  return cached.conn;
};

module.exports = connectDB;