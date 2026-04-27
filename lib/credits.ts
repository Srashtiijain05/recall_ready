import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb/connect";
import { CreditBalance } from "@/models/CreditBalance";
import { CreditTransaction } from "@/models/CreditTransaction";

const DEFAULT_USER_CREDITS = Number(process.env.DEFAULT_USER_CREDITS || "10000");

function getUserObjectId(userId: string) {
  return new mongoose.Types.ObjectId(userId);
}

function buildTransactionRecord(
  userId: string,
  type: "credit" | "debit",
  amount: number,
  action: string,
  referenceId?: string,
  metadata?: Record<string, unknown>
) {
  return {
    transactionId: crypto.randomUUID?.() || new mongoose.Types.ObjectId().toString(),
    userId: getUserObjectId(userId),
    type,
    amount,
    action,
    referenceId,
    metadata,
    createdAt: new Date(),
  };
}

export async function createOrEnsureCreditBalance(userId: string) {
  await connectToDatabase();

  return CreditBalance.findOneAndUpdate(
    { userId: getUserObjectId(userId) },
    {
      $setOnInsert: {
        creditsBalance: DEFAULT_USER_CREDITS,
        updatedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  ).lean();
}

export async function getCreditBalance(userId: string) {
  await connectToDatabase();

  const balance = await CreditBalance.findOne({ userId: getUserObjectId(userId) }).lean();
  if (balance) {
    return balance.creditsBalance;
  }

  const created = await createOrEnsureCreditBalance(userId);
  return created?.creditsBalance ?? DEFAULT_USER_CREDITS;
}

export async function debitCredits(
  userId: string,
  amount: number,
  action: string,
  referenceId?: string,
  metadata?: Record<string, unknown>
) {
  if (amount <= 0) {
    throw new Error("Invalid debit amount");
  }

  await connectToDatabase();
  await createOrEnsureCreditBalance(userId);

  const userObjectId = getUserObjectId(userId);
  const balance = await CreditBalance.findOneAndUpdate(
    {
      userId: userObjectId,
      creditsBalance: { $gte: amount },
    },
    {
      $inc: { creditsBalance: -amount },
      $set: { updatedAt: new Date() },
    },
    { new: true }
  ).lean();

  if (!balance) {
    throw new Error("Insufficient credits");
  }

  await CreditTransaction.create(
    buildTransactionRecord(userId, "debit", amount, action, referenceId, metadata)
  );

  return balance.creditsBalance;
}

export async function creditCredits(
  userId: string,
  amount: number,
  action: string,
  referenceId?: string,
  metadata?: Record<string, unknown>
) {
  if (amount <= 0) {
    throw new Error("Invalid credit amount");
  }

  await connectToDatabase();

  const userObjectId = getUserObjectId(userId);
  const balance = await CreditBalance.findOneAndUpdate(
    { userId: userObjectId },
    {
      $inc: { creditsBalance: amount },
      $set: { updatedAt: new Date() },
    },
    { upsert: true, new: true }
  ).lean();

  await CreditTransaction.create(
    buildTransactionRecord(userId, "credit", amount, action, referenceId, metadata)
  );

  return balance.creditsBalance;
}

export async function getTransactions(
  userId: string,
  page = 1,
  limit = 20
) {
  await connectToDatabase();

  const skip = Math.max(0, page - 1) * limit;
  const transactions = await CreditTransaction.find({
    userId: getUserObjectId(userId),
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await CreditTransaction.countDocuments({
    userId: getUserObjectId(userId),
  });

  return {
    transactions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

export async function getUsageSummary(userId: string) {
  await connectToDatabase();

  const balance = await CreditBalance.findOne({ userId: getUserObjectId(userId) }).lean();
  const creditsRemaining = balance?.creditsBalance ?? DEFAULT_USER_CREDITS;

  const aggregation = await CreditTransaction.aggregate([
    { $match: { userId: getUserObjectId(userId), type: "debit" } },
    {
      $group: {
        _id: "$action",
        total: { $sum: "$amount" },
      },
    },
    { $sort: { total: -1 } },
    { $limit: 5 },
  ]);

  return {
    credits_used: aggregation.reduce((sum, item) => sum + item.total, 0),
    credits_remaining: creditsRemaining,
    top_actions: aggregation.map((item) => item._id),
  };
}

export function estimateTokens(text: string) {
  if (!text || typeof text !== "string") {
    return 0;
  }

  return Math.max(0, Math.ceil(text.length / 4));
}

export function lowCreditWarning(balance: number) {
  const threshold = Math.max(20, Math.ceil(DEFAULT_USER_CREDITS * 0.2));
  if (balance <= threshold) {
    return "Low credits";
  }
  return undefined;
}
