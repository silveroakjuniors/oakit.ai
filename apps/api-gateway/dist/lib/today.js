"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setTimeMachine = setTimeMachine;
exports.clearTimeMachine = clearTimeMachine;
exports.getTimeMachineStatus = getTimeMachineStatus;
exports.getToday = getToday;
const redis_1 = require("./redis");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Always resolve relative to this file's directory — consistent regardless of cwd
const TM_FILE = path_1.default.resolve(__dirname, '../../time_machine.json');
console.log(`[TimeMachine] Store file: ${TM_FILE}`);
function readFileStore() {
    try {
        if (fs_1.default.existsSync(TM_FILE)) {
            return JSON.parse(fs_1.default.readFileSync(TM_FILE, 'utf-8'));
        }
    }
    catch { }
    return {};
}
function writeFileStore(store) {
    try {
        fs_1.default.writeFileSync(TM_FILE, JSON.stringify(store, null, 2));
    }
    catch { }
}
async function setTimeMachine(schoolId, date, ttlSeconds) {
    const expires = Date.now() + ttlSeconds * 1000;
    // Try Redis first
    try {
        const result = await redis_1.redis.set(`time_machine:${schoolId}`, date, { EX: ttlSeconds });
        if (result) {
            await redis_1.redis.set(`time_machine:${schoolId}:expires`, new Date(expires).toISOString(), { EX: ttlSeconds });
            console.log(`[TimeMachine] Redis SET school=${schoolId} date=${date}`);
            return;
        }
    }
    catch { }
    // Fallback to file
    const store = readFileStore();
    store[schoolId] = { date, expires };
    writeFileStore(store);
    console.log(`[TimeMachine] File SET school=${schoolId} date=${date} (Redis unavailable)`);
}
async function clearTimeMachine(schoolId) {
    try {
        await redis_1.redis.del(`time_machine:${schoolId}`);
    }
    catch { }
    const store = readFileStore();
    delete store[schoolId];
    writeFileStore(store);
}
async function getTimeMachineStatus(schoolId) {
    // Try Redis
    try {
        const mock = await redis_1.redis.get(`time_machine:${schoolId}`);
        if (mock) {
            const expiresAt = await redis_1.redis.get(`time_machine:${schoolId}:expires`);
            const ttl = await redis_1.redis.ttl(`time_machine:${schoolId}`);
            return { active: true, mock_date: mock, expires_at: expiresAt, ttl_seconds: ttl > 0 ? ttl : 0 };
        }
    }
    catch { }
    // Fallback to file
    const store = readFileStore();
    const entry = store[schoolId];
    if (entry && entry.expires > Date.now()) {
        return {
            active: true,
            mock_date: entry.date,
            expires_at: new Date(entry.expires).toISOString(),
            ttl_seconds: Math.ceil((entry.expires - Date.now()) / 1000),
        };
    }
    // Clean up expired entry
    if (entry) {
        delete store[schoolId];
        writeFileStore(store);
    }
    return { active: false, mock_date: null, expires_at: null, ttl_seconds: 0 };
}
/**
 * Returns today's date as YYYY-MM-DD.
 * If a time machine mock date is set for this school, returns that instead.
 */
async function getToday(schoolId) {
    const status = await getTimeMachineStatus(schoolId);
    if (status.active && status.mock_date) {
        console.log(`[TimeMachine] school=${schoolId} using mock date: ${status.mock_date}`);
        return status.mock_date;
    }
    return new Date().toISOString().split('T')[0];
}
