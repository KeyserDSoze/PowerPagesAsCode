import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/_layout/tokenhtml', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<input name="__RequestVerificationToken" type="hidden" value="test-token" />'
    })
  })

  await page.route('**/_api/serverlogics/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        Success: true,
        Data: JSON.stringify({ status: 'ok', activityId: 'test', user: 'Playwright', timestamp: new Date().toISOString() }),
        Error: null
      })
    })
  })
})

test('loads and reaches the mocked Server Logic endpoint', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Field Service offline-first boilerplate/i })).toBeVisible()
  await expect(page.getByTestId('backend-status')).toHaveText('reachable')
})

test('reacts to offline and online browser state', async ({ page, context }) => {
  await page.goto('/')
  await context.setOffline(true)
  await expect(page.getByTestId('network-status')).toHaveText('Offline')
  await context.setOffline(false)
  await expect(page.getByTestId('network-status')).toHaveText('Online')
})
