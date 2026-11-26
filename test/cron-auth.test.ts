import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST, GET } from "@/app/api/cron/notifications/route";
import { resetDb } from "./helpers";

const URL_ = "http://localhost:3000/api/cron/notifications";

beforeEach(async () => {
  await resetDb();
  process.env.CRON_SECRET = "cron-test-secret";
});
afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("cron endpoint auth", () => {
  it("accepts the bearer header", async () => {
    const res = await POST(new Request(URL_, { method: "POST", headers: { authorization: "Bearer cron-test-secret" } }));
    expect(res.status).toBe(200);
  });
  it("rejects the secret passed as ?key=", async () => {
    const res = await GET(new Request(`${URL_}?key=cron-test-secret`));
    expect(res.status).toBe(401);
  });
  it("rejects a wrong or missing header", async () => {
    expect((await POST(new Request(URL_, { method: "POST", headers: { authorization: "Bearer nope" } }))).status).toBe(401);
    expect((await POST(new Request(URL_, { method: "POST" }))).status).toBe(401);
  });
  it("rejects everything when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(new Request(URL_, { method: "POST", headers: { authorization: "Bearer " } }));
    expect(res.status).toBe(401);
  });
});
