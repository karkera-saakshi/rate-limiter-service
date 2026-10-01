# Rate Limiter Service

A per-client rate limiter for Express, built from scratch in Node.js using the **token bucket** algorithm. Each client (identified by IP address) gets a bucket of tokens. Every request spends one token, tokens refill over time, and requests with no token available are rejected with `429 Too Many Requests`.

## Screenshot

### Successful Request (Tokens Available)
<img width="1535" height="734" alt="image" src="https://github.com/user-attachments/assets/d43be3b6-a3b6-4f46-a541-4a1e35f6d63b" />

### Rate Limit Exceeded (429 Too Many Requests)
<img width="1535" height="730" alt="image" src="https://github.com/user-attachments/assets/4caa00d4-7749-4723-ab22-07732c586ee7" />

### Video Demo: Rate Limiting in Action
https://github.com/user-attachments/assets/07cf4c09-22d0-427d-b230-ad04ce6b1e2f

## Features

- Token bucket algorithm with a configurable capacity (default: 10 tokens)
- Lazy refill: no timers or background jobs, tokens are calculated when a request arrives
- Whole-token refill (1 token every 5 seconds) with leftover time carried forward
- Per-client buckets stored in an in-memory `Map`
- Drop-in Express middleware (`app.use(getBucket)`)
- Core logic is plain JavaScript functions, easy to reason about and test

## Tech Stack

- Node.js (ES modules)
- Express

## How It Works

### Token bucket in one minute

1. Every client gets a bucket that holds up to `maxTokens` tokens (10).
2. Each request costs 1 token.
3. If the bucket has a token, the request passes. If it is empty, the request is rejected with `429`.
4. Tokens come back over time: 1 token every 5 seconds, never above the maximum.

This allows short bursts (up to 10 quick requests) while limiting the long-run average rate.

### Lazy refill

There is no timer. When a request arrives, the limiter works out how much time has passed since the bucket was last updated and adds the tokens that were earned in that time.

It does this in four steps:

It takes the time passed since the last update and adds the leftover time (extraSec) saved from the previous request.
It divides that total by the refill interval (5 seconds) and rounds down, which gives the number of whole tokens earned.
It keeps whatever time is left over after taking out those whole tokens, and saves it as the new extraSec.
It adds the earned tokens to the bucket, but never lets the total go above the maximum capacity.

extraSec stores the leftover milliseconds that did not add up to a whole token yet, so no time is lost between requests.
### Request flow

```
Request
   |
   v
getBucket (middleware)        find or create the bucket for req.ip
   |
   v
consumeToken                  refill, then spend one token if available
   |
   v
fillBucket                    refill math (lazy refill)
   |
   +-- token available --> save bucket, next() --> route handler --> 200
   |
   +-- no token ---------> 429 Too Many Requests
```

### Bucket shape

```js
{
  tokens: 10,       // tokens currently available
  maxTokens: 10,    // capacity
  lastTime: 0,      // timestamp (ms) of the last refill
  extraSec: 0       // leftover ms carried toward the next token
}
```

## Getting Started

### Prerequisites

- Node.js 18 or newer

### Install and run

```bash
git clone https://github.com/karkera-saakshi/rate-limiter-service.git
cd rate-limiter-service/backend
npm install
node server.js
```

Make sure `backend/package.json` contains `"type": "module"` so the `import` syntax works.

The server starts on `http://localhost:3000`.

### Try it

Open `http://localhost:3000` and refresh quickly more than 10 times. The first 10 requests return `200`, after that you get `429 Too Many Requests`. Wait 5 seconds and one request will pass again.

## Design Decisions

- **Lazy refill over timers:** a timer per client would not scale. Computing tokens on demand costs a few arithmetic operations per request.
- **Core logic separate from the HTTP layer:** `fillBucket` and `consumeToken` return new state instead of touching the map or Express. Only `getBucket` knows about `req`, `res` and `next`.
- **Client identity from the connection:** buckets are keyed by `req.ip`, which the client cannot choose. Keying on a value from the request body would let a client dodge the limit by sending a new fake address each time.
- **Save only on success:** the bucket is saved only when a token is consumed. A rejected request means no whole token was earned, so keeping the old `lastTime` and `extraSec` gives the same elapsed time on the next request.
- **Time passed in one place:** `Date.now()` is read once per refill, never stored in the bucket, because stored time would go stale between requests.

## Known Limitations

- **Single node only:** buckets live in one process's memory. With two or more servers, each keeps its own buckets, so a client effectively gets a multiple of the limit.
- **State is lost on restart:** the map is empty after the server restarts.
- **Memory growth:** buckets are never removed, so idle clients accumulate. A production version needs TTL or eviction.
- **`extraSec` while full:** leftover time is kept even when the bucket is full, so the next spent token can come back slightly early (under one refill interval).
- **No `Retry-After` header:** rejected requests get a plain `429` without telling the client how long to wait.
- **Behind a proxy:** `req.ip` may be the proxy's address unless Express `trust proxy` is configured.

## What I Learned

### 1. Token bucket rate limiting
Every client has a bucket with a fixed capacity (10 tokens). Each request spends one token.
Tokens come back at a steady rate (1 per 5 seconds), but the bucket can never hold more than its capacity.
Because the bucket starts full, a client can send a burst of up to 10 quick requests. Over a longer time, the client is held to the refill rate. This is the main selling point of token bucket: it allows bursts but controls the average rate.

### 2. Lazy refill, and why not a timer

Lazy refill means the bucket is not refilled on a schedule. Instead, the tokens are calculated at the moment a request arrives, using the time that has passed since the last update. If a client is silent for an hour, nothing runs for them during that hour.

Why a timer is a worse choice:

It does not scale. A timer (or a background job) that tops up every bucket every few seconds does work for every client, including ones that left long ago. With a million clients, that is a million updates per tick, even if almost nobody is sending requests. Lazy refill does a few calculations only for the client that is actually making a request.
Fixed-window boundary problem. A related timer-based idea is to keep a counter and reset it to zero every N seconds. The weakness is at the edge of the window. A client can send a full allowance of requests in the last second of one window, and then another full allowance in the first second of the next window. For that short stretch around the reset, the client gets double the intended limit. A token bucket has no reset moment, so there is no such edge: the tokens only come back gradually, as time passes.
Timers drift and pile up. Timer callbacks can run late or bunch together when the server is busy. Calculating from the real timestamps (current time minus last update) is always correct, however late the request arrives.

How the lazy refill works in this project: take the time passed plus the leftover time saved last time, convert it into whole tokens, keep the remainder as the new leftover, and cap the total at capacity. The leftover time (extraSec) matters because without it, requests that arrive more often than the refill interval would each throw away a little time, and the bucket would refill slower than intended.

### 3. Identifying the client with req.ip
The limiter needs a key to decide which bucket belongs to which client. I used the IP address from req.ip.
Express fills req.ip from the network connection itself, so the client cannot choose it.
My first version read the address from req.body.address. That is wrong for two reasons: the client writes the body, so an attacker could send a new fake address with every request and never be limited, and a normal browser visit has no body at all, so the code crashes.
Rule to remember: never key a rate limiter on a value the client controls.
On my own computer, req.ip shows up as ::1 or 127.0.0.1, which just means "this machine".
Things to remember about its limits:
Shared IPs: many people behind one network (a college, an office, a mobile carrier) share one IP, so they also share one bucket. One heavy user can block the rest.
Proxies and load balancers: if the server sits behind one, req.ip is the proxy's address, so everyone looks like the same client. Express has a trust proxy setting that tells it to read the real client address from the X-Forwarded-For header. Only turn it on when a proxy you control really sits in front, because otherwise a client can fake that header.
Better keys for logged-in users: an API key or user ID is more precise than an IP, because it identifies the account rather than the network.
