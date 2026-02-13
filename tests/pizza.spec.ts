import { Page } from '@playwright/test';
import { test, expect } from 'playwright-test-coverage';
import { User, Role } from '../src/service/pizzaService';

async function basicInit(page: Page, valid: string = 'valid') {
    let loggedInUser: User | undefined;
    const validUsers: Record<string, User> = { 'd@jwt.com': { id: '3', name: 'Kai Chen', email: 'd@jwt.com', password: 'a', roles: [{ role: Role.Diner }] }, 'a@jwt.com': { id: '2', name: 'Admin User', email: 'a@jwt.com', password: 'admin', roles: [{ role: Role.Admin }] }, 'f@jwt.com': { id: '1', name: 'Franchise User', email: 'f@jwt.com', password: 'franchise', roles: [{ role: Role.Diner }, { role: Role.Franchisee }] } };
    const validFranchises = [{ id: 2, name: 'LotaPizza', stores: [{ id: 4, name: 'Lehi' }, { id: 5, name: 'Springville' }, { id: 6, name: 'American Fork' },], }, { id: 3, name: 'PizzaCorp', stores: [{ id: 7, name: 'Spanish Fork' }] }, { id: 4, name: 'topSpot', stores: [] }];

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

    await page.route('*/**/api/order/verify', async (route) => {
        expect(route.request().postDataJSON().jwt).toBe('eyJpYXQ');
        // jwtMessage = valid ? 'valid' : 'invalid';
        // valid = false;
        await route.fulfill( { json: { message: valid, payload: {}}});
    })

    // A standard menu
    await page.route('*/**/api/order/menu', async (route) => {
        const menuRes = [
            {
                id: 1,
                title: 'Veggie',
                image: 'pizza1.png',
                price: 0.0038,
                description: 'A garden of delight',
            },
            {
                id: 2,
                title: 'Pepperoni',
                image: 'pizza2.png',
                price: 0.0042,
                description: 'Spicy treat',
            },
        ];
        expect(route.request().method()).toBe('GET');
        await route.fulfill({ json: menuRes });
    });

    // Standard franchises and stores
    await page.route(/\/api\/franchise\/?(.*)?$/, async (route) => {
        const franchiseReq = route.request().postDataJSON();
        let franchiseRes;
        switch (route.request().method()) {
            case 'GET': {
                franchiseRes = {
                    franchises: validFranchises
                };
                break;
            }
            case 'POST': {
                franchiseRes = { ...franchiseReq, id: '5' };
                validFranchises.push(franchiseRes);
                break;
            }
            case 'DELETE': {
                validFranchises.pop();
                break;
            }
            default: {
                expect(route.request().method()).toBe('GET');
            }
        }


        await route.fulfill({ json: franchiseRes });
    });

    // Order a pizza.
    await page.route('*/**/api/order', async (route) => {
        const orderReq = route.request().postDataJSON();
        let orderRes;
        switch (route.request().method()) {
            case 'POST': {
                orderRes = {
                    order: { ...orderReq, id: 23 },
                    jwt: 'eyJpYXQ',
                };
                break;
            }
            case 'GET': {
                orderRes = {
                    id: '1',
                    dinerId: '4',
                    orders: []
                };
                break;
            }
            default: {
                expect(route.request().method()).toBe('POST');
                break;
            }
        }
        await route.fulfill({ json: orderRes });
    });

    await page.goto('http://localhost:5173');
}

test('register', async ({ page }) => {
    await basicInit(page);

    await page.getByRole('link', { name: 'Register' }).click();
    await expect(page.getByRole('heading')).toContainText('Welcome to the party');
    await page.getByRole('textbox', { name: 'Full name' }).click();
    await page.getByRole('textbox', { name: 'Full name' }).fill('Test User');
    await page.getByRole('textbox', { name: 'Full name' }).press('Tab');
    await page.getByRole('textbox', { name: 'Email address' }).fill('t@jwt.com');
    await page.getByRole('textbox', { name: 'Email address' }).press('Tab');
    await page.getByRole('textbox', { name: 'Password' }).fill('t');
    await page.getByRole('button', { name: 'Register' }).click();
    await expect(page.getByRole('heading')).toContainText('The web\'s best pizza');
    await page.getByRole('link', { name: 'TU' }).click();
    await expect(page.getByRole('main')).toContainText('Test User');
    await expect(page.getByRole('main')).toContainText('t@jwt.com');
    await expect(page.getByRole('main')).toContainText('diner');
});

test('login', async ({ page }) => {
    await basicInit(page);

    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByRole('textbox', { name: 'Email address' }).fill('d@jwt.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('a');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page.getByRole('link', { name: 'KC' })).toBeVisible();
});

test('logout', async ({ page }) => {
    await basicInit(page);

    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByRole('textbox', { name: 'Email address' }).fill('d@jwt.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('a');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page.getByRole('link', { name: 'KC' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Logout' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Login' })).toBeHidden();
    await expect(page.getByRole('link', { name: 'Register' })).toBeHidden();

    await page.getByRole('link', { name: 'Logout' }).click();
    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Register' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Logout' })).toBeHidden();
});

test('purchase with login', async ({ page }) => {
    await basicInit(page);

    // Go to order page
    await page.getByRole('button', { name: 'Order now' }).click();

    // Create order
    await expect(page.locator('h2')).toContainText('Awesome is a click away');
    await page.getByRole('combobox').selectOption('4');
    await page.getByRole('link', { name: 'Image Description Veggie A' }).click();
    await page.getByRole('link', { name: 'Image Description Pepperoni' }).click();
    await expect(page.locator('form')).toContainText('Selected pizzas: 2');
    await page.getByRole('button', { name: 'Checkout' }).click();

    // Login
    await page.getByPlaceholder('Email address').click();
    await page.getByPlaceholder('Email address').fill('d@jwt.com');
    await page.getByPlaceholder('Email address').press('Tab');
    await page.getByPlaceholder('Password').fill('a');
    await page.getByRole('button', { name: 'Login' }).click();

    // Pay
    await expect(page.getByRole('main')).toContainText('Send me those 2 pizzas right now!');
    await expect(page.locator('tbody')).toContainText('Veggie');
    await expect(page.locator('tbody')).toContainText('Pepperoni');
    await expect(page.locator('tfoot')).toContainText('0.008 ₿');
    await page.getByRole('button', { name: 'Pay now' }).click();

    // Check balance
    await expect(page.getByText('0.008')).toBeVisible();
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page.locator('h3')).toContainText('JWT Pizza - valid');
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('h2')).toContainText('Here is your JWT Pizza!');
});

test('cancelled purchase', async ({ page }) => {
        await basicInit(page);

    // Go to order page
    await page.getByRole('button', { name: 'Order now' }).click();

    // Create order
    await expect(page.locator('h2')).toContainText('Awesome is a click away');
    await page.getByRole('combobox').selectOption('4');
    await page.getByRole('link', { name: 'Image Description Veggie A' }).click();
    await page.getByRole('link', { name: 'Image Description Pepperoni' }).click();
    await expect(page.locator('form')).toContainText('Selected pizzas: 2');
    await page.getByRole('button', { name: 'Checkout' }).click();

    // Login
    await page.getByPlaceholder('Email address').click();
    await page.getByPlaceholder('Email address').fill('d@jwt.com');
    await page.getByPlaceholder('Email address').press('Tab');
    await page.getByPlaceholder('Password').fill('a');
    await page.getByRole('button', { name: 'Login' }).click();

    // Pay
    await expect(page.getByRole('main')).toContainText('Send me those 2 pizzas right now!');
    await expect(page.locator('tbody')).toContainText('Veggie');
    await expect(page.locator('tbody')).toContainText('Pepperoni');
    await expect(page.locator('tfoot')).toContainText('0.008 ₿');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('h2')).toContainText('Awesome is a click away');
});

test('purchase with invalid jwt', async ({ page }) => {
    await basicInit(page);

    // Go to order page
    await page.getByRole('button', { name: 'Order now' }).click();

    // Create order
    await expect(page.locator('h2')).toContainText('Awesome is a click away');
    await page.getByRole('combobox').selectOption('4');
    await page.getByRole('link', { name: 'Image Description Veggie A' }).click();
    await page.getByRole('link', { name: 'Image Description Pepperoni' }).click();
    await expect(page.locator('form')).toContainText('Selected pizzas: 2');
    await page.getByRole('button', { name: 'Checkout' }).click();

    // Login
    await page.getByPlaceholder('Email address').click();
    await page.getByPlaceholder('Email address').fill('d@jwt.com');
    await page.getByPlaceholder('Email address').press('Tab');
    await page.getByPlaceholder('Password').fill('a');
    await page.getByRole('button', { name: 'Login' }).click();

    // Pay
    await expect(page.getByRole('main')).toContainText('Send me those 2 pizzas right now!');
    await expect(page.locator('tbody')).toContainText('Veggie');
    await expect(page.locator('tbody')).toContainText('Pepperoni');
    await expect(page.locator('tfoot')).toContainText('0.008 ₿');
    await page.getByRole('button', { name: 'Pay now' }).click();

    // Check balance
    await expect(page.getByText('0.008')).toBeVisible();
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page.locator('h3')).toContainText('JWT Pizza - invalid');
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('h2')).toContainText('Here is your JWT Pizza!');
});

test('create franchise', async ({ page }) => {
    await basicInit(page, 'invalid');

    // Go to login page
    await expect(page.getByRole('heading')).toContainText('The web\'s best pizza');
    await page.getByRole('link', { name: 'Login' }).click();
    await expect(page.getByRole('heading')).toContainText('Welcome back');

    // Login
    await page.getByRole('textbox', { name: 'Email address' }).click();
    await page.getByRole('textbox', { name: 'Email address' }).fill('a@jwt.com');
    await page.getByRole('textbox', { name: 'Email address' }).press('Tab');
    await page.getByRole('textbox', { name: 'Password' }).fill('admin');
    await page.getByRole('button', { name: 'Login' }).click();

    // Go to admin page
    await expect(page.getByRole('heading')).toContainText('The web\'s best pizza');
    await page.getByRole('link', { name: 'Admin' }).click();
    await expect(page.locator('h2')).toContainText('Mama Ricci\'s kitchen');
    await expect(page.getByRole('table')).not.toContainText('The Newest Franchise');

    // Create franchise
    await page.getByRole('button', { name: 'Add Franchise' }).click();
    await expect(page.getByRole('heading')).toContainText('Create franchise');
    await page.getByRole('textbox', { name: 'franchise name' }).click();
    await page.getByRole('textbox', { name: 'franchise name' }).fill('The Newest Franchise');
    await page.getByRole('textbox', { name: 'franchise name' }).press('Tab');
    await page.getByRole('textbox', { name: 'franchisee admin email' }).fill('a@jwt.com');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.locator('h2')).toContainText('Mama Ricci\'s kitchen');
    await expect(page.getByRole('table')).toContainText('The Newest Franchise');
    await page.getByRole('row', { name: 'The Newest Franchise Close' }).getByRole('button').click();
    await expect(page.getByRole('heading')).toContainText('Sorry to see you go');
    await page.getByRole('button', { name: 'Close' }).click();
});

test('history and about pages', async ({ page }) => {
    await basicInit(page);

    // Go to history page
    await page.getByRole('link', { name: 'History' }).click();
    await expect(page.getByRole('heading')).toContainText('Mama Rucci, my my');

    // Go to about page
    await page.getByRole('link', { name: 'About' }).click();
    await expect(page.getByRole('main')).toContainText('The secret sauce');
});

test('not found page', async ({ page}) => {
    await page.goto('http://localhost:5173/d');

    await expect(page.getByRole('heading')).toContainText('Oops');
    await expect(page.getByRole('main')).toContainText('It looks like we have dropped a pizza on the floor. Please try another page.');
});

test('docs', async ({ page }) => {
    await page.goto('http://localhost:5173/docs');
    await expect(page.getByRole('main')).toContainText('JWT Pizza API');
});