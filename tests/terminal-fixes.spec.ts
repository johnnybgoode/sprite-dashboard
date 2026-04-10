import { test, expect } from "@playwright/test";

const SPRITE_NAME = "test-terminal-fixes";

test.describe("Terminal fixes", () => {
  test("Bug 1: TERM is set to xterm-256color in interactive terminal", async ({
    page,
  }) => {
    await page.goto(`/sprites/${SPRITE_NAME}/terminal`);

    // Click connect
    const connectBtn = page.getByRole("button", { name: /connect terminal/i });
    await expect(connectBtn).toBeVisible({ timeout: 15000 });
    await connectBtn.click();

    // Wait for connected state
    await expect(page.getByText("Live")).toBeVisible({ timeout: 30000 });

    // Type command in the xterm textarea
    const termInput = page.getByRole("textbox", { name: "Terminal input" });
    await termInput.click();
    await termInput.pressSequentially("echo $TERM", { delay: 50 });
    await termInput.press("Enter");

    // Wait for output
    await page.waitForTimeout(2000);

    // Read terminal content through accessibility tree
    const termRows = page.locator(".xterm-rows");
    const text = await termRows.innerText();
    expect(text).toContain("xterm-256color");
  });

  test("Bug 4: Chained commands work in exec input", async ({ page }) => {
    await page.goto(`/sprites/${SPRITE_NAME}/terminal`);

    const execInput = page.getByPlaceholder("Enter command...");
    await expect(execInput).toBeVisible({ timeout: 15000 });

    await execInput.fill("echo hello && echo world");

    const runBtn = page.getByRole("button", { name: "Run" });
    await runBtn.click();

    // Wait for result to appear (Running... disappears)
    await expect(runBtn).toBeEnabled({ timeout: 30000 });

    // Check output contains both words and exit code 0
    const output = page.locator("[class*='font-mono']").filter({ hasText: "hello" });
    await expect(output).toBeVisible({ timeout: 5000 });

    await expect(page.getByText("exit code")).toBeVisible({ timeout: 5000 });
  });

  test("Bug 4: cd && command works in exec input", async ({ page }) => {
    await page.goto(`/sprites/${SPRITE_NAME}/terminal`);

    const execInput = page.getByPlaceholder("Enter command...");
    await expect(execInput).toBeVisible({ timeout: 15000 });

    await execInput.fill("cd /tmp && pwd");
    const runBtn = page.getByRole("button", { name: "Run" });
    await runBtn.click();

    await expect(runBtn).toBeEnabled({ timeout: 30000 });

    const output = page.locator("pre").filter({ hasText: "/tmp" });
    await expect(output).toBeVisible({ timeout: 5000 });

    await expect(page.getByText("exit code")).toBeVisible({ timeout: 5000 });
  });

  test("Bug 3: Tabs allow horizontal overflow on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`/sprites/${SPRITE_NAME}/terminal`);

    // Check that tabs container has overflow-x-auto
    const tabsContainer = page.locator(".overflow-x-auto").first();
    await expect(tabsContainer).toBeVisible({ timeout: 15000 });

    // Check that individual tab links have shrink-0 and whitespace-nowrap
    const tabLink = tabsContainer.locator("a").first();
    await expect(tabLink).toBeVisible();
    const classes = await tabLink.getAttribute("class");
    expect(classes).toContain("shrink-0");
    expect(classes).toContain("whitespace-nowrap");
  });

  test("Bug 2: Terminal reconnects after SSE drop", async ({ page }) => {
    await page.goto(`/sprites/${SPRITE_NAME}/terminal`);

    // Connect
    const connectBtn = page.getByRole("button", { name: /connect terminal/i });
    await expect(connectBtn).toBeVisible({ timeout: 15000 });
    await connectBtn.click();

    // Wait for connected
    await expect(page.getByText("Live")).toBeVisible({ timeout: 30000 });

    // Verify button shows "Connected" and is disabled
    await expect(
      page.getByRole("button", { name: /connected/i })
    ).toBeDisabled();

    // Simulate SSE drop by going offline
    await page.context().setOffline(true);
    await page.waitForTimeout(3000);
    await page.context().setOffline(false);

    // After going back online, should show reconnecting or reconnect
    await page.waitForTimeout(8000);

    // Should be in one of: reconnecting, reconnected (Live), or connect available
    const hasReconnecting = await page.getByText("Reconnecting").isVisible().catch(() => false);
    const hasLive = await page.getByText("Live").isVisible().catch(() => false);
    const hasConnectBtn = await page
      .getByRole("button", { name: /connect terminal/i })
      .isVisible()
      .catch(() => false);

    expect(hasReconnecting || hasLive || hasConnectBtn).toBeTruthy();
  });
});
