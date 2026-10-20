import { test, expect } from 'playwright-test-coverage';
import { Role, User } from '../src/service/pizzaService';
import { Page } from '@playwright/test';

async function basicInit(page: Page, valid: string = 'valid') {
    let loggedInUser: User | undefined;
    const validUsers: Record<string, User> = { 'd@jwt.com': { id: '3', name: 'Kai Chen', email: 'd@jwt.com', password: 'a', roles: [{ role: Role.Diner }] }, 'a@jwt.com': { id: '2', name: 'Admin User', email: 'a@jwt.com', password: 'admin', roles: [{ role: Role.Admin }] }, 'f@jwt.com': { id: '1', name: 'Franchise User', email: 'f@jwt.com', password: 'franchise', roles: [{ role: Role.Diner }, { role: Role.Franchisee }] } };

    // Authorize login for the given user
    await page.route('*/**/api/auth', async (route) => {
        const authReq = route.request().postDataJSON();
        let authRes;
        switch (route.request().method()) {
            case 'PUT': {
                const user = validUsers[authReq.email];
                if (!user || user.password !== authReq.password) {
                    await route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
                    return;
                }
                loggedInUser = validUsers[authReq.email];
                authRes = {
                    user: loggedInUser,
                    token: 'abcdef',
                };
                break;
            }
            case 'POST': {
                authRes = {
                    user: { id: '4', name: authReq.name, email: authReq.email, password: authReq.password, roles: [{ role: Role.Diner }] },
                    token: 'abcdef',
                };
                break;
            }
            case 'DELETE': {
                break;
            }
            default: {
                expect(route.request().method()).toBe('PUT');
            }
        }
        await route.fulfill({ json: authRes });
    });

    // Return the currently logged in user
    await page.route('*/**/api/user/me', async (route) => {
        expect(route.request().method()).toBe('GET');
        await route.fulfill({ json: loggedInUser });
    });

    await page.route(/\/api\/user(\?.*)?$/, async (route) => {
        const userRes = { users: Object.values(validUsers), more: false };
        expect(route.request().method()).toBe('GET');
        await route.fulfill({ json: userRes });
    });

    await page.goto('http://localhost:5173');
}


test('updateUser', async ({ page }) => {
  const email = `user${Math.floor(Math.random() * 10000)}@jwt.com`;
  await page.goto('http://localhost:5173');
  await page.getByRole('link', { name: 'Register' }).click();
  await page.getByRole('textbox', { name: 'Full name' }).fill('pizza diner');
  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill('diner');
  await page.getByRole('button', { name: 'Register' }).click();

  await page.getByRole('link', { name: 'pd' }).click();

  await expect(page.getByRole('main')).toContainText('pizza diner');

  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('h3')).toContainText('Edit user');
  await page.getByRole('button', { name: 'Update' }).click();

  await page.waitForSelector('[role="dialog"].hidden', { state: 'attached' });

  await expect(page.getByRole('main')).toContainText('pizza diner');

  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('h3')).toContainText('Edit user');
  await page.getByRole('textbox').first().fill('pizza dinerx');
  await page.getByRole('button', { name: 'Update' }).click();

  await page.waitForSelector('[role="dialog"].hidden', { state: 'attached' });

  await expect(page.getByRole('main')).toContainText('pizza dinerx');

  await page.getByRole('link', { name: 'Logout' }).click();
  await page.getByRole('link', { name: 'Login' }).click();

  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill('diner');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.getByRole('link', { name: 'pd' }).click();

  await expect(page.getByRole('main')).toContainText('pizza dinerx');
});

test('listUsers', async ({ page }) => {
    await basicInit(page);
    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByRole('textbox', { name: 'Email address' }).fill('a@jwt.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('admin');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page.getByRole('link', { name: 'AU' })).toBeVisible();

    await page.getByRole('link', { name: 'Admin' }).click();

    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();

    await expect(page.getByRole('cell', { name: 'Kai Chen' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'd@jwt.com' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'diner', exact: true })).toBeVisible();

    await expect(page.getByRole('cell', { name: 'Franchise User' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'f@jwt.com' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'diner, franchisee' })).toBeVisible();

    await expect(page.getByRole('cell', { name: 'Admin User' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'a@jwt.com' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'admin', exact: true })).toBeVisible();
});