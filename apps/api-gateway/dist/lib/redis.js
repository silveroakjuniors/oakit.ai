"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
exports.connectRedis = connectRedis;
exports.isRedisConnected = isRedisConnected;
const redis_1 = require("redis");
let redisClient = null;
const noop = async (..._args) => null;
// Safe proxy — all methods are no-ops if Redis is unavailable
exports.redis = new Proxy({}, {
    get(_target, prop) {
        if (redisClient) {
            return redisClient[prop];
        }
        return noop;
    },
});
async function connectRedis() {
    try {
        const client = (0, redis_1.createClient)({
            url: process.env.REDIS_URL || 'redis://localhost:6379',
            socket: { reconnectStrategy: false },
        });
        client.on('error', () => { });
        await client.connect();
        redisClient = client;
        console.log('Redis connected');
    }
    catch {
        console.warn('Redis unavailable, continuing without cache');
    }
}
function isRedisConnected() {
    return !!redisClient;
}
