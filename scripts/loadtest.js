// k6 load test: read-heavy slot search + booking-history reads (+ optional booking attempts).
//   k6 run -e BASE=http://localhost:8000 -e TOKENS=tok1,tok2 -e VUS=20 -e DURATION=60s scripts/loadtest.js
// TOKENS: comma-separated valid access tokens. Record results in docs/testing-and-evaluation.md.
import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE || "http://localhost:8000";
const TOKENS = (__ENV.TOKENS || "").split(",").filter(Boolean);

export const options = {
  vus: Number(__ENV.VUS || 20),
  duration: __ENV.DURATION || "60s",
  summaryTrendStats: ["avg", "p(50)", "p(95)", "p(99)", "max"],
};

export default function () {
  const t = TOKENS[__VU % TOKENS.length];
  const params = { headers: { Authorization: `Bearer ${t}` } };
  const slots = http.get(`${BASE}/api/v1/slots?available_only=true&page_size=20`, params);
  check(slots, { "slots 200": (r) => r.status === 200 });
  const mine = http.get(`${BASE}/api/v1/bookings/me?page_size=20`, params);
  check(mine, { "bookings 200": (r) => r.status === 200 });
  sleep(0.2);
}
