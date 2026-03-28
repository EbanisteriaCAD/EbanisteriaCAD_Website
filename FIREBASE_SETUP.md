# Firebase Setup

This repo now uses Firebase for three things:

- Google sign-in on `admin.html`
- Firestore storage for quote requests
- Firestore storage for public gallery categories and pricing cards
- Firebase Storage for project photos
- Firebase Storage for public design-gallery images
- A Firestore email queue for receipt emails

## Files involved

- `firebase-config.js`: Firebase web config and allowed admin emails
- `quote-service.js`: writes quote requests to Firestore, uploads project photos, and queues receipt emails
- `content-service.js`: reads and writes gallery categories and pricing cards
- `admin-content.js`: admin CRUD for gallery and pricing
- `admin.html` + `admin.js`: protected admin portal that reads and manages Firestore data
- `designs.html` + `pricing.html` + `content-page.js`: public pages rendered from Firestore
- `quote.html` + `script.js`: public quote form

## 1. Update `firebase-config.js`

This repo now supports separate Firebase environments:

- `production`: used automatically on the live domain
- `development`: used automatically on `localhost`, `127.0.0.1`, and other local testing hosts

Inside `firebase-config.js`:

- keep the real production config under `production`
- replace the `REPLACE_WITH_DEV_...` values under `development` with the Firebase web config from your dev Firebase project

Important:

- local testing should use a separate Firebase project from production
- if the development config is left as placeholders, localhost will not connect to Firebase, which is safer than accidentally changing production

Replace `allowedAdminEmails` with the exact Google account emails that should be allowed into the admin portal.

Example:

```js
allowedAdminEmails: [
  'you@example.com'
]
```

Optional overrides:

```js
quotesCollection: 'quoteRequests',
designsCollection: 'designCategories',
pricingCollection: 'pricingCards',
mailCollection: 'mail',
quoteAttachmentsFolder: 'quote-attachments',
designGalleryFolder: 'design-gallery'
```

If you do not set those, the code defaults to:

- `quoteRequests`
- `designCategories`
- `pricingCards`
- `mail`
- `quote-attachments`
- `design-gallery`

## 2. Firebase Authentication

In Firebase Console:

1. Open `Authentication`
2. Enable the `Google` sign-in provider
3. In `Settings`, add your domains to `Authorized domains`

For local testing, add:

- `localhost`
- `127.0.0.1`

## 3. Firestore Database

Create Firestore if you have not already.

The code expects:

- quote documents in `quoteRequests`
- design category documents in `designCategories`
- pricing card documents in `pricingCards`
- receipt email jobs in `mail`

The public quote form creates quote documents.
The admin portal reads, updates, and deletes quote documents.
The public `designs.html` and `pricing.html` pages read directly from Firestore.

## 4. Firestore Rules

Use the rules in `firestore.rules` as a starting point.

They are designed for this flow:

- anyone can create a quote request
- anyone can create a receipt-email queue item
- only admin email accounts can read, update, or delete data

Before using them, replace `you@example.com` with your real admin email.

## 5. Storage Rules

Project photos upload into Firebase Storage under:

- `quote-attachments/{quoteId}/...`

Public gallery images upload into:

- `design-gallery/{categorySlug}/...`

Publish the rules in `storage.rules` so image uploads can work from the public quote form.

The starter rules currently:

- allow public image uploads
- limit uploads to image files
- limit each file to under 8 MB
- allow reads for uploaded images

For gallery images, the starter rules:

- allow public reads
- allow uploads only for signed-in admin accounts

## 6. Receipt Emails

The website queues a receipt email by creating a document in the `mail` collection.

To actually send those emails, install Firebase's official `Trigger Email` extension and point it at the `mail` collection.

The queued documents use this shape:

```js
{
  to: ['customer@example.com'],
  message: {
    subject: 'Recibimos tu solicitud de cotizacion',
    text: '...',
    html: '...'
  }
}
```

## 7. What to test

1. Submit a quote in `quote.html`
2. Confirm a new document appears in `quoteRequests`
3. If you attached photos, confirm files appear in Storage under `quote-attachments`
4. Open `admin.html`
5. Sign in with an allowed admin account
6. Confirm the new quote appears in the admin table
7. Open the quote details and confirm the photos are visible
8. Change status or delete it and confirm Firestore updates
9. Create a gallery category in the admin panel and confirm it appears on `designs.html`
10. Create or edit a pricing card in the admin panel and confirm it appears on `pricing.html`
11. If you later enable receipt emails, confirm the Trigger Email extension sends the receipt email
