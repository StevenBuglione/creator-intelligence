import { test, expect } from "@playwright/test";
test("owner can review fixture metrics and approve one versioned production blueprint", async ({
  page,
}, testInfo) => {
  const suffix = testInfo.project.name + " " + Date.now();
  await page.goto("/");
  await page.getByLabel("Owner password").fill(process.env.OWNER_PASSWORD!);
  await page.getByRole("button", { name: "Open workspace" }).click();
  await expect(
    page.getByRole("heading", { name: /Before you use|Overview/ }),
  ).toBeVisible();
  const accept = page.getByRole("button", {
    name: "Accept policies & open workspace",
  });
  if (await accept.isVisible()) {
    await expect(accept).toBeDisabled();
    await page
      .getByLabel("I agree to the privacy policy.", { exact: true })
      .check();
    await page
      .getByLabel(
        "I agree to the terms of use, including the YouTube Terms of Service.",
        { exact: true },
      )
      .check();
    await accept.click();
  }
  await expect(
    page.getByText("SYNTHETIC DEMONSTRATION", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "1200", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "My channel", exact: true }).click();
  await page.getByLabel("Report", { exact: true }).selectOption("retention");
  await page
    .getByLabel("Video ID (required for retention/reach)")
    .fill("fixture0001");
  await page.getByRole("button", { name: "Load stored report" }).click();
  await expect(
    page.getByRole("columnheader", { name: "audienceWatchRatio" }),
  ).toBeVisible();
  await page.getByLabel("Report", { exact: true }).selectOption("reach");
  await expect(page.getByRole("cell", { name: "4.20%" })).toBeVisible();
  await page.getByRole("button", { name: "Research", exact: true }).click();
  await page.getByRole("button", { name: "Use as inspiration" }).click();
  await expect(page.getByLabel("Source URL (optional)")).toHaveValue(
    "https://www.youtube.com/watch?v=fixture0001",
  );
  await page
    .getByLabel("Working title", { exact: true })
    .fill("Original idea " + suffix);
  await page
    .getByLabel("Original angle")
    .fill("A lunchbox auditions for an office job.");
  await page.getByRole("button", { name: "Save idea", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Original idea " + suffix }),
  ).toBeVisible();
  await page
    .locator("section")
    .filter({
      has: page.getByRole("heading", { name: "Original idea " + suffix }),
    })
    .getByRole("button", { name: "Develop blueprint" })
    .click();
  await expect(page.getByLabel("Working title", { exact: true })).toHaveValue(
    "Original idea " + suffix,
  );
  await expect(
    page.getByLabel("Research source URLs (one per line)"),
  ).toHaveValue("https://www.youtube.com/watch?v=fixture0001");
  await page
    .getByLabel("Working title", { exact: true })
    .fill("Lunchbox blueprint " + testInfo.project.name + " " + Date.now());
  await page
    .getByRole("textbox", { name: "Hook", exact: true })
    .fill("Your lunch has applied for your job.");
  await page
    .getByLabel("Outline (one beat per line)")
    .fill("Setup\nInterview\nPayoff");
  await page
    .getByLabel("Thumbnail brief")
    .fill("Original lunchbox behind an office desk.");
  await page.getByRole("button", { name: "Save blueprint revision" }).click();
  await expect(page.getByText("Saved revision 1")).toBeVisible();
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Approve & send" }).first().click();
  await expect(
    page.getByRole("status").filter({ hasText: "Delivery:" }),
  ).toContainText("Delivery: delivered");
  await page.getByRole("button", { name: "Approve & send" }).first().click();
  await expect(
    page.getByRole("status").filter({ hasText: "Delivery:" }),
  ).toContainText("Delivery: delivered");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `evidence/workspace-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.emulateMedia({ colorScheme: "dark" });
  const settings = page.getByRole("button", { name: "Settings", exact: true });
  await settings.focus();
  await expect(settings).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Connect owner channel" }),
  ).toBeDisabled();
  await page.screenshot({
    path: `evidence/settings-dark-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
