const map = new Map();

const LIMITS = {
  default:     { maxHits: 3,  windowMs: 30_000      },
  message:     { maxHits: 5,  windowMs: 10_000      },
  buy:         { maxHits: 3,  windowMs: 60_000      },
  coupon:      { maxHits: 5,  windowMs: 60_000      },
  payment:     { maxHits: 2,  windowMs: 300_000     },
  withdraw:    { maxHits: 1,  windowMs: 86_400_000  },
  createorder: { maxHits: 5,  windowMs: 300_000     },
};

// Dọn dẹp entry cũ mỗi 5 phút
setInterval(() => {
  const now = Date.now();
  for (const [userId, actions] of map.entries()) {
    for (const [action, data] of Object.entries(actions)) {
      const { windowMs } = LIMITS[action] || LIMITS.default;
      if (now - data.firstHit > windowMs) delete actions[action];
    }
    if (!Object.keys(actions).length) map.delete(userId);
  }
}, 5 * 60 * 1000);

function checkLimit(userId, action = "default") {
  const { maxHits, windowMs } = LIMITS[action] || LIMITS.default;
  const now = Date.now();

  if (!map.has(userId)) map.set(userId, {});
  const userActions = map.get(userId);

  if (!userActions[action]) {
    userActions[action] = { count: 1, firstHit: now, lastHit: now };
    return { limited: false, remaining: maxHits - 1, retryAfter: 0 };
  }

  const entry = userActions[action];
  if (now - entry.firstHit > windowMs) {
    userActions[action] = { count: 1, firstHit: now, lastHit: now };
    return { limited: false, remaining: maxHits - 1, retryAfter: 0 };
  }

  entry.count  += 1;
  entry.lastHit = now;
  return {
    limited:    entry.count > maxHits,
    remaining:  Math.max(0, maxHits - entry.count),
    retryAfter: Math.ceil((entry.firstHit + windowMs - now) / 1000),
  };
}

function resetLimit(userId, action = "default") {
  const ua = map.get(userId);
  if (ua?.[action]) delete ua[action];
}

function addLimit(action, maxHits, windowMs) {
  LIMITS[action] = { maxHits, windowMs };
}

function formatRetry(seconds) {
  if (seconds < 60)   return `${seconds} giây`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} phút`;
  return `${Math.ceil(seconds / 3600)} giờ`;
}

module.exports = { checkLimit, resetLimit, addLimit, formatRetry, LIMITS };
