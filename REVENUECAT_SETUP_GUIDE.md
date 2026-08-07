# 💎 Complete Guide: RevenueCat & Apple App Store Payment Setup

This guide details the end-to-end steps required to integrate **RevenueCat** with **Apple App Store Connect** for **Splitmaro Pro**, resolving the configuration errors and enabling seamless production-ready purchases.

---

## 📋 Table of Contents
1. [Prerequisites & Apple Developer Account](#1-prerequisites--apple-developer-account)
2. [App Store Connect Product Configuration](#2-app-store-connect-product-configuration)
3. [Generate App Store Connect API Keys (Crucial Fix)](#3-generate-app-store-connect-api-keys-crucial-fix)
4. [RevenueCat Dashboard Configuration](#4-revenuecat-dashboard-configuration)
5. [Testing In-App Purchases Locally (Simulator & StoreKit)](#5-testing-in-app-purchases-locally-simulator--storekit)
6. [Testing on a Physical Device (Sandbox)](#6-testing-on-a-physical-device-sandbox)

---

## 1. Prerequisites & Apple Developer Account

Before setting up products, your Apple Developer account must have the proper agreements and capabilities active.

### ✍️ A. Sign the Paid Applications Agreement (Mandatory)
If this is not done, Apple will block all Sandbox and Production product fetches.
1. Log in to [App Store Connect](https://appstoreconnect.apple.com/).
2. Navigate to **Agreements, Tax, and Banking**.
3. Under **Agreements**, locate **Paid Applications**.
4. Review and accept the agreement, then complete the required tax and banking information.
5. Ensure the status turns to **`Active`**.

### 🛠️ B. Enable In-App Purchases in App Identifier
1. Go to the [Apple Developer Portal Certificates & Identifiers](https://developer.apple.com/account/resources/identifiers/list).
2. Click on your App Identifier: `com.dineshruhela.vibhag`.
3. Scroll down and verify that **In-App Purchase** is checked.
4. Click **Save** if any changes were made.

---

## 2. App Store Connect Product Configuration

Your product in App Store Connect must be fully configured and cleared for sale.

1. Navigate to **App Store Connect ➜ Apps ➜ Splitmaro**.
2. On the left sidebar, under **Features**, select **In-App Purchases**.
3. Click the **`+`** icon to add a new In-App Purchase.
4. Choose **Non-Consumable** (ideal for lifetime Pro upgrades).
5. Configure the following details:
   - **Reference Name:** `Splitmaro Pro Upgrade`
   - **Product ID:** `com.dineshruhela.vibhag.pro` *(Must match the ID in RevenueCat and code)*
6. Click **Create**.
7. In the product detail screen, resolve the **"Missing Metadata"** warning by filling out:
   - **Pricing:** Select your price tier (e.g., Tier 5 / ₹499).
   - **App Store Information:** Add a Display Name (e.g., `Splitmaro Pro`) and Description (e.g., `Unlock unlimited groups, recurring expenses, and all premium features.`).
   - **Review Information:** Upload any dummy 640x960 screenshot of the upgrade screen.
8. Click **Save**. The status should change to **`Ready to Submit`**.

---

## 3. Generate App Store Connect API Keys (Crucial Fix)

Your error `Missing App Store Connect API credentials` means RevenueCat's backend cannot authenticate with Apple to verify receipts and sync the product catalog. Here is how to generate and link the credentials:

### 🔑 A. Generate an API Key in App Store Connect
1. In App Store Connect, select **Users and Access**.
2. Click the **Integrations** tab (or **Keys** tab).
3. Under **Key Type**, choose **App Store Connect API**.
4. Click the **`+` (Generate API Key)** button.
5. Provide details:
   - **Name:** `RevenueCat Integration`
   - **Access / Role:** **`Admin`** or **`App Manager`** *(Admin is recommended by RevenueCat to fetch catalog details).*
6. Click **Generate**.
7. Once generated, note down:
   - **Issuer ID** (A string of hex characters at the top of the keys table).
   - **Key ID** (The 10-character ID of your new key).
8. Click **Download API Key** (`.p8` file). 
   > ⚠️ **Warning:** You can only download this file **once**. Save it securely!

---

## 4. RevenueCat Dashboard Configuration

Now, link Apple and RevenueCat to bridge your app.

### 🌐 A. Upload App Store Connect API Credentials
1. Log in to the [RevenueCat Dashboard](https://app.revenuecat.com/).
2. Select your Project, click on **Project Settings ➜ Apps ➜ Your iOS App**.
3. Scroll down to the **App Store Connect API** section.
4. Fill in the fields:
   - **Issuer ID:** Paste your App Store Connect Issuer ID.
   - **Key ID:** Paste the 10-character Key ID.
   - **Private Key (.p8 file):** Upload the `.p8` file you downloaded from App Store Connect.
5. Click **Save**. The API warning will disappear!

### 📦 B. Create the Product, Entitlement, and Offering
1. Under **Product Catalog ➜ Products**, click **+ New** to register a product.
   - **Store:** `App Store`
   - **Product ID:** `com.dineshruhela.vibhag.pro`
2. Under **Product Catalog ➜ Entitlements**, click **+ New** to create an entitlement.
   - **Identifier:** `pro` *(Matches the entitlement queried in `upgrade.tsx`)*
   - Attach your newly registered product `com.dineshruhela.vibhag.pro` to this entitlement.
3. Under **Product Catalog ➜ Offerings**, click **+ New Offering**.
   - **Identifier:** `default`
   - Inside the `default` offering, click **Add Package**.
   - Choose **Lifetime** or **Custom** and enter the package identifier (e.g., `$rc_lifetime`).
   - Attach the App Store Product `com.dineshruhela.vibhag.pro` to this package.
4. Click **Make Current** at the top right of the `default` offering page.

---

## 5. Testing In-App Purchases Locally (Simulator & StoreKit)

We have already configured a local StoreKit configuration in your workspace. This runs in Xcode/Simulator and completely bypasses Apple server checks, allowing offline sandbox checkouts.

### 💻 A. Verify Local StoreKit Settings
I have already pre-configured these 3 files in your `/ios` folder:
- **`ios/Splitmaro/Splitmaro.storekit`**: Contains the local product template for `com.dineshruhela.vibhag.pro`.
- **`ios/Splitmaro.xcodeproj/project.pbxproj`**: Registers the StoreKit file in the project.
- **`ios/Splitmaro.xcodeproj/xcshareddata/xcschemes/Splitmaro.xcscheme`**: Automatically feeds the StoreKit file to the debugger on launch.

### ⚡ B. Rebuild & Run
To compile these native changes and begin local transaction tests:
1. Re-compile your iOS development build on the simulator:
   ```bash
   npx expo run:ios
   ```
2. Open the Upgrade Screen. The paywall will read the local `Splitmaro.storekit` file, load your mock product, and successfully process mock checkouts on the simulator!

---

## 6. Testing on a Physical Device (Sandbox)

To test the actual receipt validation flow on a physical iPhone:

1. **Create a Sandbox Tester:**
   - In App Store Connect, go to **Users and Access ➜ Sandbox ➜ Sandbox Testers**.
   - Click **`+`** to add a new tester. Use a real email address that is *not* currently associated with an Apple ID.
2. **Sign In on iPhone:**
   - On your physical iPhone running iOS 14+, go to **Settings ➜ App Store**.
   - Scroll down to the bottom **`Sandbox Account`** section.
   - Sign in with your Sandbox Tester credentials. *(Do not sign out of your main iCloud account at the top of Settings; sandbox testing is separate).*
3. **Build the Development Client:**
   - Run the app on your physical device:
     ```bash
     npx expo run:ios --device
     ```
   - Proceed to buy the upgrade. It will display a pop-up: `[Environment: Sandbox]`. Complete the payment using your sandbox password. It will process receipt verification against RevenueCat's servers!
