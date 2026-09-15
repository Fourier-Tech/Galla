import mongoose from "mongoose";
import { connectToDatabase } from "./mongodb";

/**
 * Runs a callback inside a MongoDB multi-document ACID transaction.
 * Automatically manages session lifecycle, commits on success, and aborts on error.
 */
export async function withTransaction<T>(
  work: (session: mongoose.ClientSession) => Promise<T>
): Promise<T> {
  await connectToDatabase();
  const session = await mongoose.startSession();

  try {
    let result: T;
    try {
      await session.withTransaction(async () => {
        result = await work(session);
      });
      return result!;
    } catch (txError: unknown) {
      // ponytail: If running against a standalone local MongoDB without replica set support,
      // fall back to non-transactional execution. Upgrade path: Always use MongoDB Atlas or replica set in production.
      const isReplicaSetError =
        txError instanceof Error &&
        (txError.message.includes("Transaction numbers are only allowed on a replica set member") ||
          txError.message.includes("This MongoDB deployment does not support retryable writes"));

      if (isReplicaSetError) {
        return await work(session);
      }
      throw txError;
    }
  } finally {
    await session.endSession();
  }
}

export default withTransaction;
