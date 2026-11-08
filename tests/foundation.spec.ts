import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const credentials = JSON.parse(readFileSync(".local/development.json", "utf8"));

test("contributor permissions and recoverable service failure", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.getByLabel("Email address").fill("nila@demoworks.test");
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".error[role=alert]")).toContainText(
    "Email or password is incorrect",
  );
  await page.getByLabel("Password", { exact: true }).fill(credentials.demo);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Delivery overview" }),
  ).toBeVisible();
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toBeEnabled();
  await expect(page.getByRole("button", { name: "Replay demo event" })).toHaveCount(0);
  if (info.project.name === "mobile")
    await page
      .getByRole("button", { name: "Close navigation", exact: true })
      .last()
      .click();
  await page.route("**/api/projects/*/dashboard", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Database unavailable. Please retry." }),
    }),
  );
  await page.getByRole("button", { name: "Refresh data" }).click();
  await expect(page.locator(".error[role=alert]")).toContainText("Database unavailable");
  await page.unroute("**/api/projects/*/dashboard");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.locator(".error[role=alert]")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: /Completed tasks 01/ }),
  ).toBeVisible();
});

test("sign in, stored overview, tasks, team, keyboard dialog, refresh, sign out", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Welcome to your workspace" }),
  ).toBeVisible();
  await page.getByLabel("Email address").fill("asha@demoworks.test");
  await page.getByLabel("Password", { exact: true }).fill(credentials.demo);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Delivery overview" }),
  ).toBeVisible();
  await expect(page.getByText("Stored in PostgreSQL")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Completed tasks 01/ }),
  ).toBeVisible();
  await page.screenshot({
    path: `evidence/overview-${info.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Delivery overview" }),
  ).toBeVisible();
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Task Board", exact: true }).click();
  await page.getByRole("button", { name: "List", exact: true }).click();
  await page.getByRole("textbox", { name: "Search tasks" }).fill("LOGIN");
  await expect(
    page.getByRole("button", { name: /LOGIN-102 Login UI/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /LOGIN-102 Login UI/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Login UI", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: /LOGIN-102 Login UI/ }),
  ).toBeFocused();
  await page.getByRole("textbox", { name: "Search tasks" }).fill("no-match");
  await expect(
    page.getByRole("heading", { name: "No matching tasks" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Team Capacity", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Team capacity", exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Asha", exact: true }),
  ).toBeVisible();
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByText("API keys stay on the server.", { exact: false })).toBeVisible();
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome to your workspace" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
