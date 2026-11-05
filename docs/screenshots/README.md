# Portfolio captures

The three `showcase-*.jpg` files were captured on **5 November 2026** from the [public browser demo](https://gadzhaprod.github.io/menupilot/) using `bb browser-automation`, headless Chromium, and a separate browser profile. All data is fictional. English was selected in the app; themes were changed through its Theme control. These are browser screenshots, not mockups.

| File | Screen and theme | Viewport / image | JPEG bytes |
|---|---|---|---:|
| [showcase-dashboard-light.jpg](showcase-dashboard-light.jpg) | Dashboard, light | 1440 × 1000 | 98,082 |
| [showcase-simulator-dark.jpg](showcase-simulator-dark.jpg) | Classic Burger Simulator, dark | 1440 × 1000 | 116,476 |
| [showcase-mobile-light.jpg](showcase-mobile-light.jpg) | Dashboard, light | 375 × 812 | 42,065 |

The three images total **256,623 bytes**. JPEG quality was 80–82, with device scale factor 1 and no upscaling. Click a README thumbnail for the full viewport capture. Existing screenshots below the README showcase were retained; this capture log describes only the new `showcase-*` images.

To reproduce the screens:

1. Open the demo in a fresh profile, choose EN and Light, and select **Continue exploring the example**. Capture the Dashboard at 1440 × 1000.
2. Open **Try a scenario** for Classic Burger and choose Dark. Create three scenarios: “Higher price” with menu price **€14.17 incl. VAT**; “Lower volume” with the same menu price and an estimate of 270 sales/month; “Smaller increase” with menu price **€13.63 incl. VAT**. Keep the shared estimate at 300, select the first scenario and capture at 1440 × 1000. These are illustrative inputs, not recommendations or forecasts; real recipes and prices stay unchanged.
3. Return to Dashboard, choose Light, set 375 × 812 and capture from the top.

The default comparison date follows the current date, so later captures may show different dates and results. No clock or displayed figures were altered for these images. The public deployment was observed separately; these captures do not establish its build SHA or prove that it matches local baseline `586e56d` exactly.
