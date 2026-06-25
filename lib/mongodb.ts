import { Db, MongoClient } from "mongodb";
import { getConfig } from "./config";

type GlobalMongo = {
  client?: MongoClient;
  promise?: Promise<MongoClient>;
};

const globalMongo = globalThis as typeof globalThis & {
  __vscbotMongo?: GlobalMongo;
};

let indexesPromise: Promise<void> | undefined;

if (!globalMongo.__vscbotMongo) {
  globalMongo.__vscbotMongo = {};
}

export async function getMongoClient(): Promise<MongoClient> {
  const state = globalMongo.__vscbotMongo!;
  if (state.client) {
    return state.client;
  }

  if (!state.promise) {
    const config = getConfig();
    state.promise = new MongoClient(config.mongodbUri, {
      maxPoolSize: 10,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 8000,
    }).connect();
  }

  state.client = await state.promise;
  return state.client;
}

export async function getDb(): Promise<Db> {
  const config = getConfig();
  const client = await getMongoClient();
  return client.db(config.mongodbDb);
}

export async function ensureMongoIndexes(): Promise<void> {
  if (indexesPromise) {
    return indexesPromise;
  }

  indexesPromise = createMongoIndexes().catch((error) => {
    indexesPromise = undefined;
    throw error;
  });

  return indexesPromise;
}

async function createMongoIndexes(): Promise<void> {
  const db = await getDb();

  await Promise.all([
    db.collection("reports").createIndex({ createdAt: -1 }),
    db.collection("reports").createIndex({ "window.labelDate": 1, createdAt: -1 }),
    db.collection("fuel_snapshots").createIndex({ labelDate: 1, createdAt: 1 }),
    db.collection("fuel_detected_refills").createIndex({ eventKey: 1 }, { unique: true }),
    db.collection("fuel_detected_refills").createIndex({ labelDate: 1, registration: 1, afterTime: -1 }),
    db.collection("fuel_detected_refills").createIndex({ labelDate: 1, status: 1, refilledLiters: -1 }),
    db.collection("fuel_actual_refills").createIndex({ labelDate: 1, registration: 1, filledAt: -1 }),
    db.collection("vehicle_status_snapshots").createIndex({ labelDate: 1, createdAt: 1 }),
    db.collection("driver_daily_audits").createIndex({ labelDate: 1, generatedAt: -1 }),
    db.collection("driver_audit_cases").createIndex({ caseKey: 1 }, { unique: true }),
    db.collection("driver_audit_cases").createIndex({ labelDate: 1, status: 1, severity: 1 }),
    db.collection("driver_audit_cases").createIndex({ driverName: 1, createdAt: -1 }),
    db.collection("staff").createIndex({ email: 1 }, { unique: true, sparse: true }),
    db.collection("staff").createIndex({ username: 1 }, { unique: true, sparse: true }),
    db.collection("staff").createIndex({ status: 1, role: 1 }),
  ]);
}
