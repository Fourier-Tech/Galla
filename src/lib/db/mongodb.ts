import mongoose from "mongoose";


declare global {
  var mongooseCache: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
}

const MONGODB_URI = process.env.MONGODB_URI;

let cached = global.mongooseCache;

if (!cached) {
  cached = global.mongooseCache = { conn: null, promise: null };
}

/**
 * Connects to MongoDB Atlas using Mongoose with connection pooling and caching.
 * Prevents multiple simultaneous connections on serverless cold starts (Vercel).
 */
export async function connectToDatabase(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI || MONGODB_URI;
  if (!uri) {
    throw new Error(
      "Please define the MONGODB_URI environment variable inside .env.local or production environment."
    );
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      dbName: "galla",
    };

    cached.promise = mongoose.connect(uri, opts).then((mongooseInstance) => {
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error: any) {
    if (error?.message?.includes("querySrv") || error?.code === "ECONNREFUSED") {
      try {
        const dns = await import("node:dns");
        dns.setServers(["8.8.8.8", "1.1.1.1"]);
        const opts: mongoose.ConnectOptions = {
          bufferCommands: false,
          dbName: "galla",
        };
        cached.promise = mongoose.connect(uri, opts);
        cached.conn = await cached.promise;
        return cached.conn;
      } catch {
        // Fallback failed, continue to rethrow original error
      }
    }
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}

export default connectToDatabase;
