import { b, sectionNumber, to, type HelpDocument, type HelpImage, type HelpImageId, type HelpSectionId } from './types';

const img = (id: HelpImageId, alt: string, caption?: string): HelpImage => (caption === undefined ? { id, alt } : { id, alt, caption });

/** "section 11": the number comes from the section order, so it can never drift. */
const sec = (id: HelpSectionId) => `section ${sectionNumber(id)}`;
const secLink = (id: HelpSectionId, capital = false) => to(id, capital ? `Section ${sectionNumber(id)}` : sec(id));

/**
 * The guide in English. Button and field names are written exactly as the English screen shows them.
 * The Russian guide shows the same screen, so the pictures are shared with it.
 */
export const contentEn: HelpDocument = {
  lang: 'en',
  title: 'MenuPilot: step-by-step guide',
  subtitle: 'For anyone who has never used a program like this. Take your time: every step is one small action.',
  ui: {
    languageLabel: 'Language of this guide',
    print: 'Print this guide',
    contents: 'Contents',
    toTop: 'Up to the top',
    stepsDone: 'What you will see',
    openLarger: 'Open larger (in a new tab)',
    backToContents: 'Back to contents',
    messageHeader: 'Message on the screen',
    meaningHeader: 'What it means and what to do',
    contextLink: 'Help for this page',
  },
  sections: [
    /* ------------------------------------------------------------------ 1 */
    {
      id: 'how-to-use',
      title: 'How to use this guide',
      blocks: [
        { kind: 'p', text: 'This guide shows how to use MenuPilot, one small step at a time. You do not need any computer skills. Read slowly: do one step, then look at the screen.' },
        {
          kind: 'note',
          tone: 'safe',
          title: 'Looking around is safe',
          text: ['Practise with the fictional demo cafe. ', b('Cancel'), ' closes a window without saving what you typed in it.'],
        },
        {
          kind: 'note',
          tone: 'important',
          title: 'Reading and working at the same time',
          text: ['A printed guide is easier to follow while you work. If you read on the screen, ', b('Help'), ' in the menu at the top opens this guide again, and the link ', b('Help for this page'), ' under the title of every page opens the matching part. Save your recipe before you leave its page.'],
        },
        {
          kind: 'steps',
          title: 'How to read the steps',
          steps: [
            {
              text: ['Names of buttons and fields are written in ', b('bold'), '. They are written exactly as on the screen. This guide is for the English screen, so these names stay in English. If your screen is in Dutch, the Dutch guide uses Dutch names.'],
            },
            {
              text: 'Each step is one action. Do it, then look at the screen. Under the step you will find what should appear. If your screen looks different, read the previous step again. You do not need the Back button of your browser.',
            },
            {
              text: ['To jump to a part of this guide, click its name in the ', b('Contents'), ' list below.'],
              result: ['The page scrolls to that part. At the end of every section the link ', b('Back to contents'), ' brings you back. On a computer, the button ', b('Up to the top'), ' (bottom right) does the same.'],
            },
            {
              text: ['To change the language of this guide, press ', b('English'), ', ', b('Nederlands'), ' or ', b('Русский'), ' at the top of this page.'],
              result: 'The whole guide changes language. The program remembers your choice. Without a choice, the guide uses the language of the screen.',
              image: img('help-toolbar', 'The top of the guide: the buttons English, Nederlands and Русский, and the button Print this guide.', 'The language buttons and the print button are at the top of this page.'),
            },
            {
              text: ['To print the guide on paper, press ', b('Print this guide'), '.'],
              result: 'The printing window of your computer opens. The printed guide is always light, has large letters and no menu.',
            },
            {
              text: 'To make everything on the screen larger, hold the Ctrl key and press the plus key (on a Mac: the ⌘ key and plus). To make it smaller again, hold Ctrl and press minus. On a Mac, hold ⌘ instead.',
              result: 'Text and buttons grow. Do this until you can read comfortably.',
            },
          ],
        },
      ],
    },
    /* ------------------------------------------------------------------ 2 */
    {
      id: 'about',
      title: 'What MenuPilot is and how it helps',
      blocks: [
        { kind: 'p', text: 'MenuPilot is a small program for the owner of a cafe or restaurant. You enter what you buy, what each dish contains and what you sell it for. The program then tells you what each dish costs to make and what is left from its price.' },
        {
          kind: 'p',
          text: ['Here is an example. Your supplier raised the price of beef mince (ground beef). Your Classic Burger uses 180 g of it. A month ago the ingredients of one burger cost ', b('€4.20'), '. Now they cost ', b('€4.85'), '. That is 65 cents more for every burger. If you sell 300 burgers a month, you are left with ', b('€195.00'), ' less every month.'],
        },
        { kind: 'p', text: 'MenuPilot finds this for you in a few seconds. It also lets you try out answers: raise the price by 75 cents, serve a slightly smaller portion, or hope the supplier goes back to the old price. You see the result before you decide anything.' },
        { kind: 'image', image: img('dashboard-table', 'The Dishes table on the Dashboard: the Classic Burger row shows the cost a month ago and now, the change in euros and the monthly impact.', 'The Dashboard shows for every dish what changed. The Classic Burger row shows €4.20 before, €4.85 now, and −€195.00 per month.') },
        {
          kind: 'list',
          items: [
            [b('Dashboard'), ': which dishes became more expensive, and how much that costs you per month.'],
            [b('Simulator'), ': a safe place to try “what if” without changing your real data.'],
            [b('Recipes'), ': your dishes and your preps (sauces and other things made in a batch).'],
            [b('Ingredients'), ': what you buy and its price. Every new price is remembered with its date.'],
            [b('Data'), ': copies of your data (backups).'],
          ],
        },
        {
          kind: 'note',
          tone: 'safe',
          title: 'A demo cafe is already inside',
          text: ['The first time you open MenuPilot you see a made-up burger cafe. Nothing in it is real, so try everything freely. How to switch to your own data is in ', secLink('data'), '.'],
        },
        {
          kind: 'note',
          tone: 'important',
          title: 'Where your data lives',
          text: ['A browser is the program you use to open MenuPilot, such as Chrome, Safari or Edge. Your saved data stays only in that browser on this computer. It is not sent anywhere and there is no account. ', secLink('data', true), ' explains how to make a backup.'],
        },
      ],
    },
    /* ------------------------------------------------------------------ 3 */
    {
      id: 'glossary',
      title: 'Words explained simply',
      blocks: [
        { kind: 'p', text: 'You will meet these words on the screen. Each one is explained with an everyday example.' },
        {
          kind: 'terms',
          items: [
            { term: 'Ingredient', meaning: 'Anything you buy for the kitchen: meat, buns, oil, wine.', example: 'Beef mince 80/20 is an ingredient.' },
            {
              term: 'Pack',
              meaning: 'The way the supplier sells an ingredient: one pack has a size and a price. You type both as they are on the invoice. MenuPilot works out the price per kilo, litre or piece for you.',
              example: 'A pack of 1 kg of mince for €17.00 is €17.00 per kg. A pack of 12 buns for €10.56 is €0.88 per bun.',
            },
            {
              term: 'Price excl. VAT / incl. VAT',
              meaning: 'VAT (value added tax) is a tax that is added to prices. “Excl. VAT” means without the tax, “incl. VAT” means with the tax. Your supplier’s invoice prices go in without tax. The price on your menu, which the guest pays, is with tax. MenuPilot always calculates with the price without tax.',
              example: 'A burger on the menu costs €13.08 incl. VAT. With 9% VAT that is €12.00 excl. VAT.',
            },
            {
              term: 'Recipe-based ingredient cost',
              meaning: 'What the ingredients of one portion should cost according to your recipe. It is calculated from the recipe, not measured in the kitchen: food that was thrown away or an extra-large portion is not counted.',
              example: 'The ingredients of one Classic Burger cost €4.85.',
            },
            {
              term: 'Contribution (before other costs)',
              meaning: 'The price without VAT minus the cost of the ingredients. It is what is left from one portion to pay for everything else: staff, rent, electricity. It is NOT profit, because those other costs are still to be paid.',
              example: '€12.00 − €4.85 = €7.15 contribution per burger.',
            },
            {
              term: 'Food cost %',
              meaning: 'How much of the price (without VAT) goes into ingredients. A higher percentage means less is left for you.',
              example: '€4.85 of €12.00 is 40.4%.',
            },
            {
              term: 'pp (percentage points)',
              meaning: 'The unit for a change of a percentage. If the food cost went from 35.0% to 40.4%, that is +5.4 pp.',
              example: 'Under “Change (€)” in the Dashboard table you see, for example, +5.4 pp.',
            },
            {
              term: 'Net quantity',
              meaning: 'The usable amount of an ingredient for the whole batch, after the losses you entered. For four portions, enter the total amount for all four.',
              example: '180 g of mince for one burger; 720 g for a batch of four.',
            },
            {
              term: 'Yield %',
              meaning: 'How much of what you buy can really be used. 100 means nothing is lost. 80 means a fifth is lost, for example peel or trimmed fat.',
              example: 'For 300 g of chips you need potatoes with 20% peel: yield 80. MenuPilot then counts 375 g of potatoes.',
            },
            {
              term: 'Prep',
              meaning: 'Something you make in a batch and then use in several dishes: a sauce, dough, stock. MenuPilot works out its cost per kilo, and the dishes use that.',
              example: 'The burger sauce is used in the Classic Burger and in the Fries.',
            },
            { term: 'Dish', meaning: 'Something on your menu that a guest orders. A dish has a menu price.', example: 'Classic Burger, Tomato Soup.' },
            {
              term: 'Scenario',
              meaning: 'A “what if” copy of one dish in the Simulator. You change something in the copy and see the result. The real dish and the real prices are never changed.',
              example: '“What if I raise the burger price by 75 cents?”',
            },
            { term: 'Baseline', meaning: 'Your real data today: the recipe and the prices that every scenario is compared with. A saved scenario may still use an older starting point.', example: 'In the Simulator the Baseline column shows your real dish today.' },
            {
              term: 'Expected sales per month (monthly volume)',
              meaning: 'How many portions of a dish you think you sell in a month. This is your own estimate, not a forecast made by the program. It turns the difference per portion into euros per month. You may leave it empty.',
              example: '300 burgers a month.',
            },
            {
              term: 'Monthly impact at your volume',
              meaning: 'On the Dashboard: how much more or less is left from the price per month, because ingredient prices changed. It is calculated with your own sales estimate.',
              example: '−€195.00 means that you are left with €195.00 less per month.',
            },
            {
              term: 'cost unknown',
              meaning: 'MenuPilot shows this when a price is missing, so the cost cannot be calculated. It never shows zero for something unknown.',
              example: 'You added an ingredient but not its price yet.',
            },
            {
              term: 'Browser',
              meaning: 'The program you use to open websites and MenuPilot, for example Chrome, Safari or Edge. MenuPilot keeps your data inside it, on this computer only.',
              example: 'If you open MenuPilot in Safari after using it in Chrome, you see no data: each browser keeps its own.',
            },
            {
              term: 'Backup',
              meaning: 'A file with a copy of all your data. If something is lost, you can put the data back from this file.',
              example: 'Like a photocopy of your recipe book that you keep in a drawer.',
            },
          ],
        },
      ],
    },
    /* ------------------------------------------------------------------ 4 */
    {
      id: 'first-start',
      title: 'First start: the demo cafe',
      blocks: [
        { kind: 'p', text: ['When you open MenuPilot for the first time, it already contains a made-up burger cafe: 12 ingredients, 5 dishes and 2 preps. Use it to learn. When you have practised, you can empty the program and enter your own data (', secLink('data'), ').'] },
        { kind: 'note', tone: 'safe', title: 'Local version', text: ['The local version starts empty; its demo notice appears only after demo data is loaded. After a restart, open the new address printed in the terminal window running npm start. If needed, run npm run menupilot -- open-url. Recipe drafts are stored in this browser on this computer for this dataset for up to 7 days, including across tabs. Unsaved ingredient and supplier-price dialog entries are not retained.'] },
        {
          kind: 'note',
          tone: 'safe',
          title: 'You cannot spoil the demo',
          text: ['Whatever you change in the demo, you can always go back: ', b('Reset to demo data'), ' on the Data page puts the original demo back. It also removes the recipes and scenarios you made yourself.'],
        },
        {
          kind: 'steps',
          title: 'Look around the demo cafe',
          steps: [
            {
              text: ['Look at the top of the screen. You see the menu: ', b('Dashboard'), ', ', b('Simulator'), ', ', b('Recipes'), ' and ', b('Ingredients'), ' on the left, ', b('Data'), ' and ', b('Help'), ' further right.'],
              result: 'The name of the page you are on is underlined. On a phone the menu hides behind the button Menu: press it to open the list.',
              image: img('menu', 'The main menu at the top of the screen: Dashboard, Simulator, Recipes, Ingredients, and further right Data and Help.', 'The menu at the top of every page.'),
            },
            { text: ['Click ', b('Ingredients'), '.'], result: 'A list of 12 ingredients with their prices opens.' },
            { text: ['Click ', b('Recipes'), '.'], result: 'You see the cards Dishes (five dishes) and Preps (two preps), each with its cost.' },
            { text: ['Click ', b('Dashboard'), '.'], result: ['You see which dishes became more expensive. ', secLink('dashboard', true), ' explains this page.'] },
          ],
        },
        {
          kind: 'note',
          tone: 'important',
          title: 'Want to practise first?',
          text: ['Keep the demo cafe and continue with ', secLink('appearance'), ' or ', secLink('ingredients'), '. The following examples use its ingredients. Empty the program after practising: ', secLink('data'), ' shows how.'],
        },
      ],
    },
    /* ------------------------------------------------------------------ 5 */
    {
      id: 'appearance',
      title: 'Colours (theme) and language of the screen',
      blocks: [
        { kind: 'p', text: 'At the top of each page, find Theme and the EN and NL language buttons. Theme chooses the colours of the screen, the buttons choose the language. Neither changes your data.' },
        { kind: 'image', image: img('theme-language', 'The top right of the screen: the list Theme with the choice Light, and the language buttons EN and NL.', 'The list Theme and the language buttons EN | NL.') },
        {
          kind: 'steps',
          title: 'Change the colours of the screen',
          steps: [
            { text: ['At the top of the page, find the list ', b('Theme'), ' and click it.'], result: 'A list opens with three choices: System, Light and Dark.' },
            { text: ['Click ', b('Light'), ' for a bright screen, or ', b('Dark'), ' for a dark screen.'], result: 'The colours change at once. The program remembers your choice in this browser.' },
          ],
        },
        {
          kind: 'list',
          items: [
            [b('Light'), ': a bright screen. Best by day, and easiest to read in a bright kitchen.'],
            [b('Dark'), ': a dark screen. Easier on the eyes in the evening.'],
            [b('System'), ': MenuPilot follows your computer’s or phone’s light or dark setting. When that setting changes, MenuPilot changes with it. This is what you have until you choose.'],
          ],
        },
        {
          kind: 'note',
          tone: 'safe',
          title: 'Printing is always light',
          text: 'Even when the screen is dark, this guide and the Dashboard print light, on white paper, so that nothing is lost on the paper.',
        },
        {
          kind: 'steps',
          title: 'Change the language of the screen',
          steps: [
            { text: ['At the top of the page, click ', b('NL'), ' for Dutch (Nederlands) or ', b('EN'), ' for English.'], result: 'All texts and buttons of the program change language at once. The chosen language is underlined and remembered in this browser.' },
          ],
        },
        {
          kind: 'note',
          tone: 'important',
          title: 'Saved names are not translated',
          text: ['The language only changes the program’s own words. The names you typed yourself (ingredients, dishes, scenarios) stay as you wrote them. The demo cafe is loaded in the language of the screen the first time. ', b('Reset to demo data'), ' loads the demo in the language of the screen at that moment, and replaces your data. Names in demo data already loaded also keep their original language: Rundergehakt 80/20 does not automatically become Beef mince 80/20. This English guide uses English demo names.'],
        },
        {
          kind: 'note',
          tone: 'safe',
          title: 'This guide has its own language buttons',
          text: ['At the top of this guide you can choose English, Nederlands or Русский. Without a choice the guide follows the language of the screen. The Russian guide shows the English screen.'],
        },
      ],
    },
    /* ------------------------------------------------------------------ 6 */
    {
      id: 'ingredients',
      title: 'Ingredients and their prices',
      blocks: [
        { kind: 'p', text: 'Everything starts with ingredients: what you buy and the price on the supplier’s invoice. MenuPilot keeps every price you enter, with its date. The newest price is the one used in calculations. The older ones stay in the history, and the Dashboard needs them to show what changed.' },
        { kind: 'image', image: img('ingredients-list', 'The Ingredients page: the table Current supplier prices with the buttons New price, Price history, Rename and Delete at the end of each row.', 'Each row has four buttons on the right. The button Add ingredient is at the top right of the page.') },
        {
          kind: 'steps',
          title: 'Add a new ingredient (example: olive oil, a 5 litre can for €24.00)',
          steps: [
            { text: ['Click ', b('Ingredients'), ' in the menu.'], result: 'The list of your ingredients opens.' },
            { text: ['Click ', b('Add ingredient'), ' near the top of the page.'], result: 'A window “Add ingredient” opens.' },
            { text: ['Click the field ', b('Name'), ' and type the name: Olive oil.'] },
            {
              text: ['Open the list ', b('Unit'), ' (right of the pack size). Choose ', b('l'), ' for litres.'],
              result: ['The title of the size field changes to ', b('Pack size (l)'), '.'],
            },
            { text: ['In ', b('Pack size (l)'), ' type the size of one pack as written on the invoice: 5.'] },
            {
              text: ['In ', b('Pack price (excl. VAT)'), ' type the price from the invoice, without VAT: 24.00. You can use a point or a comma.'],
              result: ['Below the fields the program shows “That is €4.80/l excl. VAT.” This is the price per litre.'],
              image: img('ingredient-add', 'The window Add ingredient filled in: Olive oil, pack size 5 l, pack price 24.00, and the line That is €4.80/l excl. VAT.', 'The window with Olive oil filled in.'),
            },
            { text: ['Click the button ', b('Add ingredient'), ' in the window.'], result: 'The window closes and Olive oil is at the end of the list.' },
          ],
        },
        {
          kind: 'note',
          tone: 'safe',
          title: 'What the units mean',
          text: [b('g'), ' grams, ', b('kg'), ' kilograms, ', b('ml'), ' millilitres, ', b('l'), ' litres, ', b('pc'), ' pieces. Use the unit that is written on the invoice for one pack.'],
        },
        { kind: 'note', tone: 'safe', title: 'If you make a mistake', text: ['Press ', b('Cancel'), ' (or the key Esc on your keyboard). The window closes and nothing is saved.'] },
        {
          kind: 'note',
          tone: 'important',
          title: 'You do not know the price yet?',
          text: ['Enter the name and choose the ', b('Unit'), ' you buy it in, such as kg, l or pc. Leave the pack size and the price empty. Add the price later with ', b('New price'), '. Until then the dishes that use this ingredient show “cost unknown”, which is honest: the program does not guess.'],
        },
        {
          kind: 'steps',
          title: 'The supplier raised a price (example: beef mince from €17.00 to €18.50 per kg)',
          steps: [
            { text: ['Click ', b('Ingredients'), '.'], result: 'The list opens.' },
            { text: ['Find the row ', b('Beef mince 80/20'), '. At the end of the row click the button ', b('New price'), '.'], result: ['A window “New price: Beef mince 80/20” opens. It says “Now: €17.00 excl. VAT for 1 kg. The old price stays in the history.”'] },
            { text: ['Look at ', b('Pack size (kg)'), '. It already shows 1, the last pack size. Change it only if the pack is different now.'] },
            {
              text: ['Click ', b('Pack price (excl. VAT)'), ' and type the new price from the invoice, without VAT: 18.50.'],
              result: ['Below the fields you see “That is €18.50/kg excl. VAT.”, the new price per kilo.'],
              image: img('ingredient-price', 'The window New price: Beef mince 80/20, with the new pack price 18.50 typed in and the line That is €18.50/kg excl. VAT.', 'Only the price needs to be typed; the pack size is already there.'),
            },
            { text: ['Click ', b('Save price'), '.'], result: 'The window closes. In the row, the price is €18.50 and the date in the column Last price is today’s.' },
          ],
        },
        {
          kind: 'note',
          tone: 'important',
          title: 'This changes real data',
          text: ['In the demo cafe too: the burger becomes more expensive on the Dashboard. You saved the practice price of €18.50, so later figures will differ from the pictures. To follow the later examples, add another price for this ingredient: ', b('New price'), ' with €17.00 excl. VAT for 1 kg. Or use ', b('Reset to demo data'), ' (', secLink('data'), ').'],
        },
        {
          kind: 'steps',
          title: 'See the price history of an ingredient',
          steps: [
            { text: ['In the row of the ingredient click ', b('Price history'), '.'], result: ['A window “Price history of Beef mince 80/20” opens. The newest price is first and has the mark “current”. The older prices are below, each with its date.'], image: img('ingredient-history', 'The window Price history of Beef mince 80/20 with its prices: the current one on top and older ones below.', 'The newest price is on top.') },
            { text: ['Click ', b('Close'), '.'], result: 'The window closes. Nothing was changed.' },
          ],
        },
        { kind: 'p', text: 'Adding a new price keeps the earlier entries in the history. Deleting the ingredient also deletes its price history. The Dashboard uses the old prices to tell you what a dish cost a month ago.' },
        {
          kind: 'steps',
          title: 'Rename an ingredient',
          steps: [
            { text: ['In the row of the ingredient click ', b('Rename'), '.'], result: ['A small window “Rename” opens with the field ', b('Name'), '.'], image: img('ingredient-rename', 'The window Rename with the field Name, and the buttons Cancel and Rename.', 'Recipes that use the ingredient keep working under the new name.') },
            { text: ['Click the field ', b('Name'), ', change the name and click the button ', b('Rename'), '.'], result: 'The window closes and the new name is in the list and in all recipes.' },
          ],
        },
        {
          kind: 'steps',
          title: 'Delete an ingredient (example: remove the Olive oil you added)',
          steps: [
            { text: ['In the row of Olive oil click ', b('Delete'), '.'], result: ['A window “Delete Olive oil?” opens. It says that this cannot be undone.'], image: img('ingredient-delete', 'The window Delete Olive oil? with the buttons Cancel and Delete ingredient.', 'Cancel keeps the ingredient.') },
            { text: ['Click the red button ', b('Delete ingredient'), '. To keep the ingredient, click ', b('Cancel'), ' instead.'], result: 'The ingredient and its price history disappear from the list.' },
          ],
        },
        { kind: 'h3', text: 'Why an ingredient sometimes cannot be deleted' },
        {
          kind: 'p',
          text: 'An ingredient that is used in a recipe cannot be deleted, because the recipe would lose a part. When you click Delete ingredient, a red message appears in the window and names the recipes that use it. Open each of them, remove the line with this ingredient (button Remove), press Save changes, and then delete the ingredient.',
        },
        { kind: 'image', image: img('ingredient-in-use', 'The window Delete Beef mince 80/20 with a red message that it is still used by recipes, and a link to Classic Burger.', 'The red message names the recipe. The link under it opens that recipe.') },
      ],
    },
    /* ------------------------------------------------------------------ 7 */
    {
      id: 'preps',
      title: 'Preps: sauces and other batches',
      blocks: [
        { kind: 'p', text: 'A prep is something you make in a batch and then use in several dishes, for example a sauce, a dough or a stock. You enter the prep once, with its ingredients. MenuPilot works out what one kilo costs, and the dishes use that price.' },
        {
          kind: 'note',
          tone: 'safe',
          title: 'Why this is useful',
          text: 'When the price of an ingredient in the sauce changes, every dish with that sauce is updated by itself. If only one dish uses a sauce, you can also put its ingredients straight into that dish. Then you do not need a prep.',
        },
        {
          kind: 'note',
          tone: 'important',
          title: 'Nothing is saved until you press Save',
          text: ['Your entries are not saved yet. When finished, click ', b('Save prep'), '. The card Cost changes while you type, but leaving this page before saving loses what you typed.'],
        },
        {
          kind: 'steps',
          title: 'Create a prep (example: Mustard mayo, 900 g mayonnaise and 100 g mustard make 1 kg)',
          steps: [
            { text: ['Click ', b('Recipes'), ' in the menu.'], result: 'You see the cards Dishes and Preps.' },
            { text: ['In the card ', b('Preps'), ' click the button ', b('New prep'), '.'], result: ['A page “New prep” opens.'] },
            { text: ['Click the field ', b('Name'), ' and type: Mustard mayo.'] },
            { text: ['Open the list ', b('Batch unit'), ' (right of the field for the amount) and choose ', b('kg'), '.'], result: ['The title of the amount field changes to ', b('One batch makes (kg)'), '.'] },
            {
              text: ['In ', b('One batch makes (kg)'), ' type how much the whole batch produces: 1.'],
              result: 'The batch is everything you make at one time. Here it is one kilo.',
              image: img('prep-form', 'The top of the New prep page: Name Mustard mayo, One batch makes 1 kg with Batch unit kg.', 'The first card of a new prep.'),
            },
            { text: ['In the first line, open the list ', b('Ingredient or prep'), ' and choose ', b('Mayonnaise · g'), '.'], result: ['The title of the amount field says ', b('Net quantity (g)'), '.'] },
            {
              text: ['In ', b('Net quantity (g)'), ' type 900. Leave ', b('Yield %'), ' at 100.'],
              result: ['At the end of the line, ', b('Line cost (excl. VAT)'), ' shows €3.96.'],
            },
            { text: ['Click ', b('Add line'), '.'], result: 'A second, empty line appears.' },
            { text: ['In the new line, choose ', b('Dijon mustard · g'), '.'] },
            { text: ['In ', b('Net quantity (g)'), ' of the new line, type 100.'], result: ['The line cost shows €0.50.'], image: img('prep-lines', 'The card Ingredients and preps with two lines: Mayonnaise 900 g and Dijon mustard 100 g, with their line costs.', 'Two lines make one batch.') },
            { text: ['Look at the card ', b('Cost'), ' at the bottom.'], result: ['It shows ', b('Batch cost, all portions (excl. VAT)'), ' €4.46, ', b('One batch makes'), ' 1 kg and ', b('Cost per kg, l or pc (excl. VAT)'), ' €4.46/kg. It changes while you type.'], image: img('prep-cost', 'The card Cost with Batch cost €4.46, One batch makes 1 kg, Cost per kg, l or pc €4.46/kg.', 'The cost of the whole batch and of one kilo.') },
            { text: ['Click ', b('Save prep'), ' at the bottom of the page.'], result: ['The prep is saved. The page now has the name of the prep as its title, and the buttons at the bottom become ', b('Save changes'), ', ', b('Discard changes'), ' and ', b('Delete prep'), '.'] },
            { text: ['Click ', b('← All recipes'), ' at the top of the page.'], result: 'Mustard mayo is in the card Preps with its cost, €4.46/kg.' },
          ],
        },
        { kind: 'p', text: ['A prep can use other preps, but not itself and not in a circle. The program refuses this with a clear message, and it allows at most 5 levels. To change or delete a prep, click its name on the Recipes page. A prep that a dish uses cannot be deleted until you remove it from that dish. How to use a prep in a dish is shown in ', secLink('dishes'), '.'] },
      ],
    },
    /* ------------------------------------------------------------------ 8 */
    {
      id: 'dishes',
      title: 'Dishes: recipe, price and cost',
      blocks: [
        { kind: 'p', text: 'A dish is something a guest orders. For each dish you enter the menu price, the VAT rate and the lines: what goes into it and how much. MenuPilot then shows what the dish costs and what is left from its price.' },
        {
          kind: 'note',
          tone: 'important',
          title: 'Save before you leave',
          text: ['Your entries are not saved yet. When finished, click ', b('Save dish'), '. Leaving this page before saving loses what you typed.'],
        },
        {
          kind: 'steps',
          title: 'Create a dish (example: Chicken Bun for €9.80, with the Mustard mayo from the previous section)',
          steps: [
            { text: ['Click ', b('Recipes'), ' in the menu.'], result: 'The cards Dishes and Preps open.' },
            { text: ['In the card ', b('Dishes'), ' click ', b('New dish'), '.'], result: ['A page “New dish” opens. The first, empty line is already there.'] },
            { text: ['Click the field ', b('Name'), ' and type: Chicken Bun.'] },
            { text: ['In ', b('Menu price (incl. VAT)'), ' type the price your guest pays, with tax: 9.80.'] },
            {
              text: ['Look at ', b('VAT rate'), '. Leave it at 9% (food). For alcohol choose 21%. The list also has 0%.'],
            },
            { text: ['In ', b('Portions per batch'), ' leave 1. This number says how many portions the lines below make. If the lines make four portions, type 4.'] },
            {
              text: ['In ', b('Monthly volume (optional)'), ' enter your estimate of how many portions you sell per month: 100. You may leave this field empty.'],
              image: img('dish-form', 'The top of the New dish page: Chicken Bun, menu price 9.80, VAT rate 9%, portions per batch 1, monthly volume 100.', 'The first card of a dish.'),
            },
            { text: ['In the first line, open the list ', b('Ingredient or prep'), ' and choose ', b('Chicken breast fillet · g'), '.'] },
            {
              text: ['In ', b('Net quantity (g)'), ' type 120. Leave ', b('Yield %'), ' at 100.'],
              result: ['The line cost shows €1.06.'],
            },
            { text: ['Click ', b('Add line'), '.'], result: 'A second, empty line appears.' },
            { text: ['In the new line, open the list ', b('Ingredient or prep'), ' and choose ', b('Brioche burger bun · pc'), '.'] },
            { text: ['Type 1 in ', b('Net quantity (pc)'), '.'], result: ['The line cost shows €0.88.'] },
            { text: ['Click ', b('Add line'), ' again.'], result: 'A third, empty line appears.' },
            { text: ['In the new line, open the list ', b('Ingredient or prep'), ' and, under the heading Preps, choose ', b('Mustard mayo · g'), '.'] },
            {
              text: ['Type 20 in ', b('Net quantity (g)'), '.'],
              result: ['The line cost shows €0.09. Your prep is used inside the dish.'],
              image: img('dish-lines', 'The card Ingredients with three lines: Chicken breast fillet 120 g, Brioche burger bun 1 pc, Mustard mayo 20 g.', 'A dish line can be an ingredient or a prep.'),
            },
            {
              text: ['For this example, leave ', b('Yield %'), ' at 100. ', secLink('glossary', true), ' explains other values.'],
            },
            {
              text: ['Look at the card ', b('Cost'), ' at the bottom.'],
              result: 'It shows what one portion costs and what is left from the price: here €2.03 for ingredients, €8.99 price excl. VAT and €6.97 contribution. The next part explains every row.',
              image: img('dish-cost', 'The card Cost for Chicken Bun with the ingredient cost per portion, the price excl. VAT, the contribution and the monthly estimate.', 'The Cost card of the new dish.'),
            },
            { text: ['Click ', b('Save dish'), ' at the bottom of the page.'], result: ['The dish is saved. The page now has the dish name as its title, and the buttons at the bottom become ', b('Save changes'), ', ', b('Discard changes'), ' and ', b('Delete dish'), '. The dish is on the Recipes page and on the Dashboard.'] },
          ],
        },
        {
          kind: 'note',
          tone: 'safe',
          title: 'Kilograms and litres',
          text: ['In every line you may choose ', b('kg'), ' in the list ', b('Unit'), ' and type 0.12 instead of 120 with g. The program converts it itself. You cannot mix weight and volume: a line in grams cannot be typed in litres.'],
        },
        { kind: 'p', text: 'Amounts on the screen are rounded to cents. The program calculates more precisely, so checking with the shown amounts can give a difference of a few cents.' },
        { kind: 'h3', text: 'How to read the numbers in the Cost card' },
        {
          kind: 'list',
          items: [
            [b('Batch cost, all portions (excl. VAT)'), ': what the ingredients of the whole batch cost.'],
            [b('Recipe-based ingredient cost per portion (excl. VAT)'), ': what the ingredients of one portion cost. This is the main cost number.'],
            [b('Menu price (incl. VAT)'), ' and ', b('Price excl. VAT'), ': the price your guest pays, and the same price without tax. The program calculates with the one without tax.'],
            [b('Contribution per portion (before other costs)'), ': the price without VAT minus the ingredient cost. This is not profit: staff, rent and the rest still have to be paid from it.'],
            [b('Food cost %'), ': how much of the price without VAT goes to ingredients. ', b('Contribution margin %'), ' is the rest.'],
            [b('Estimated monthly contribution'), ': contribution per portion times your monthly sales number. It appears only when you typed a monthly volume. It is your estimate, not a forecast.'],
            [b('cost unknown'), ': a price is missing. A line under the card says which ingredient has no price yet. Add it on the Ingredients page.'],
          ],
        },
        {
          kind: 'steps',
          title: 'Change or delete a dish',
          steps: [
            { text: ['Click ', b('Recipes'), ', then click the name of the dish.'], result: 'The dish opens with all its lines.' },
            { text: ['Change what you need. To change your mind before saving, click ', b('Discard changes'), '.'], result: 'The note “You have unsaved changes.” shows next to the buttons until you save.' },
            { text: ['Click ', b('Save changes'), '.'], result: 'The note “Saved.” appears.' },
            {
              text: ['To delete the dish, click ', b('Delete dish'), ' at the bottom right, then confirm with the red button ', b('Delete dish'), ' in the window. To keep it, click ', b('Cancel'), '.'],
              result: 'If the dish has saved simulator scenarios, the window says they will be deleted too.',
            },
          ],
        },
      ],
    },
    /* ------------------------------------------------------------------ 9 */
    {
      id: 'dashboard',
      title: 'Dashboard: what became more expensive',
      blocks: [
        { kind: 'p', text: 'The Dashboard answers one question: since a chosen date, which of my dishes became more expensive, and how much does that cost me per month? It only reads your data. Nothing you do here changes anything. For both dates, MenuPilot uses your current recipe and current menu price. Only the supplier prices differ. This does not compare older versions of the recipe.' },
        {
          kind: 'steps',
          title: 'Read the Dashboard',
          steps: [
            { text: ['Click ', b('Dashboard'), ' in the menu (or the name MenuPilot at the top left).'], result: 'The Dashboard opens.' },
            {
              text: 'Look at the two blocks at the top. The left one is the whole menu: the big number is the effect per month. The right one shows the single dish with the biggest rise in the cost of one portion.',
              result: ['The left block is called ', b('Monthly impact at your volume'), ': red with a minus (for example −€273.38) means that you are left with that much less per month. The right block is called ', b('Largest increase per portion'), ': the dish, its cost then and now, and the button ', b('Try a scenario'), '.'],
              image: img('dashboard-cards', 'The two top blocks: Monthly impact at your volume −€273.38, and Largest increase per portion: Classic Burger, from €4.20 to €4.85, with the button Try a scenario.', 'The summary blocks. A minus sign before the euros means you are left with less each month.'),
            },
            {
              text: ['Find the line ', b('Compare prices with'), '. Click one of the buttons ', b('7 days'), ', ', b('30 days'), ' or ', b('90 days'), '.'],
              result: 'The chosen button gets a light gold background. All numbers below are now compared with the prices of that many days ago. In the demo, 7 days shows no change, because the last demo prices are older than a week; for 90 days the demo has no prices yet, and the table says “no price on this date”.',
              image: img('dashboard-picker', 'The line Compare prices with, three buttons 7 days, 30 days, 90 days, the field Choose date and the note Dates in UTC.', 'The buttons for the comparison period and the date field.'),
            },
            {
              text: ['To compare with an exact day (for example the day of an old invoice), click the field ', b('Choose date'), ' and pick or type a date, for example the day three weeks ago.'],
              result: 'The buttons lose their gold colour, and everything is compared with that date. The date cannot be in the future. Dates are in UTC.',
            },
            {
              text: ['Look at the table ', b('Dishes'), '. Each row is one dish: its name with the menu price incl. and excl. VAT.'],
              result: 'Each row shows the cost then and now, the change in euros (red when it is higher), what is left from the price now and the effect per month.',
              image: img('dashboard-table', 'The Dishes table of the Dashboard with the columns for cost at the comparison date, cost now, change, contribution now and monthly impact.', 'One row per dish.'),
            },
            { text: ['To try “what if” for a dish, click ', b('Simulate'), ' under its name.'], result: ['The Simulator opens for that dish (see ', sec('simulator'), ').'] },
            {
              text: 'Look under the table at the total line.',
              result: ['It says ', b('Menu monthly impact (dishes with a volume estimate)'), ' and the total in euros. A dish without a monthly volume is left out and counted below it, for example “1 dish without volume excluded”.'],
            },
            {
              text: ['Scroll down to the card ', b('Preps'), '.'],
              result: 'It shows what one kilo (or litre, or piece) of each prep costs on the comparison date (Before) and now (Now).',
              image: img('dashboard-preps', 'The Preps card: Tomato base and Burger sauce, with the cost per kilo before and now.', 'Preps are shown separately from dishes.'),
            },
            {
              text: ['Scroll down to ', b('Menu summary'), ' at the bottom.'],
              result: 'Three numbers: how many dishes got more expensive, the average food cost % of your dishes, and how many dishes have no monthly volume. Below them a note says that about 30% food cost is an average for restaurants in the Netherlands: a general reference, not a target or a rule.',
              image: img('dashboard-summary', 'The Menu summary: Dishes that got more expensive 5, Average food cost % 21.7%, Dishes without volume 1.', 'The three summary numbers.'),
            },
          ],
        },
        { kind: 'h3', text: 'What the columns mean' },
        {
          kind: 'list',
          items: [
            [b('Dish'), ': the name, and under it the menu price with and without VAT.'],
            [b('[date]'), ' and ', b('Now'), ': what the ingredients of one portion cost on the comparison date and today.'],
            [b('Change (€)'), ': the difference. A plus sign (+€0.65) means the dish became more expensive. Under it the change of the food cost in percentage points, for example +5.4 pp.'],
            [b('Contribution now (before other costs)'), ': what is left from the price after ingredients. This is not profit.'],
            [b('Monthly impact at your volume'), ': contribution now minus contribution then, times your monthly sales number. A minus sign (−€195.00) means you are left with that much less per month. It is a calculation from your own number, not a forecast.'],
          ],
        },
        { kind: 'h3', text: 'Signs you may see instead of a number' },
        {
          kind: 'messages',
          items: [
            { message: '—', meaning: ['No monthly sales number was entered for this dish (the table says “Volume missing”). It is left out of the monthly total. Open the dish. Enter the number of portions in ', b('Monthly volume (optional)'), '. Click ', b('Save changes'), '.'] },
            { message: 'cost unknown', meaning: ['A price is missing for an ingredient of this dish. Add the price on the Ingredients page.'] },
            { message: 'no price on this date', meaning: ['One of the ingredients had no price yet on the chosen date, because you started entering prices later. Choose a more recent date.'] },
            { message: 'n/a', meaning: ['The number cannot be calculated, for example a percentage when the menu price is €0.00.'] },
            { message: '(incomplete)', meaning: ['Next to the monthly impact: some dishes with a monthly volume had to be left out, and a line below says why.'] },
            { message: 'No comparable dish became more expensive in this period.', meaning: ['None of the dishes with known prices on both dates became more expensive. Also check whether other dishes show cost unknown or no price on this date. Choose a longer period or an older date to look further back.'] },
          ],
        },
        {
          kind: 'note',
          tone: 'important',
          title: 'Two things to remember',
          text: 'The cost is calculated from your recipes, it is not what was really used in the kitchen. And “contribution” is not profit: staff, rent and other costs are not included.',
        },
      ],
    },
    /* ------------------------------------------------------------------ 10 */
    {
      id: 'simulator',
      title: 'Simulator: try “what if” safely',
      blocks: [
        { kind: 'p', text: 'The Simulator answers questions like: what if I raise the price? What if I serve a slightly smaller portion? What if the supplier goes back to the old price? You make a copy of a dish, change something in the copy and see the result next to your real numbers.' },
        {
          kind: 'note',
          tone: 'safe',
          title: 'This is safe',
          text: 'The Simulator never changes your real ingredients, prices or recipes. Everything you try is only a calculation in a copy.',
        },
        { kind: 'p', text: 'On a computer, the fields are on the left and the comparison is on the right. On a phone, the comparison is below the fields. It shows Baseline and the selected scenario. Select A, B or C to view another scenario.' },
        {
          kind: 'steps',
          title: 'Open the Simulator for the Classic Burger',
          steps: [
            { text: ['Click ', b('Simulator'), ' in the menu.'], result: 'A card for every dish opens, with its ingredient cost per portion and the number of saved scenarios.', image: img('simulator-picker', 'The Simulator page with a card for each dish and its recipe-based ingredient cost per portion.', 'One card for each dish.') },
            { text: ['Click the card ', b('Classic Burger'), '.'], result: ['The page “Simulator: Classic Burger” opens. A link ', b('All dishes'), ' at the top leads back to the cards.'] },
            {
              text: ['Look at ', b('Baseline'), '. It is your real data today.'],
              result: 'Five numbers in a row: menu price €13.08, ingredient cost €4.85, contribution €7.15, food cost 40.4%, and €2,145.00 estimated per month.',
              image: img('simulator-baseline', 'The Baseline row for Classic Burger: menu price, ingredient cost, contribution per portion, food cost % and estimated monthly contribution.', 'Baseline: your real dish today.'),
            },
            {
              text: ['Look at the field ', b('Expected sales per month (your estimate)'), ' on the left. It already shows 300, the number saved with the dish. Change it if you wish.'],
              result: ['This is the shared sales estimate. Each scenario also has ', b('Own sales per month (optional)'), '. Leave that field empty to use the shared number.'],
            },
          ],
        },
        {
          kind: 'steps',
          title: 'Scenario A: raise the menu price by 75 cents',
          steps: [
            { text: ['Click the button ', b('Add scenario'), '.'], result: ['A big block “Scenario A” appears with the monthly difference (now €0.00), a card ', b('Adjust your scenario'), ' on the left and the table ', b('Same starting point, different choices'), ' on the right.'] },
            {
              text: ['In the card on the left, click the field ', b('Menu price (incl. VAT)'), ' and type 13.83.'],
              result: 'The grey 13.08 shows the current price. In the card the contribution per portion becomes €7.84, with +€0.69, and at the top of the page the monthly difference becomes +€206.42.',
              image: img('simulator-scenario', 'The top of the card Adjust your scenario: scenario name, menu price 13.83, and the results contribution per portion €7.84 and monthly contribution €2,351.42.', 'Menu price 13.83: contribution €7.84 per portion, monthly difference +€206.42.'),
            },
          ],
        },
        {
          kind: 'steps',
          title: 'Scenario B: a smaller portion of mince (160 g instead of 180 g)',
          steps: [
            { text: ['Click ', b('Add scenario'), ' again.'], result: ['A second scenario, B, appears. It is chosen, and its card is on the left. Under ', b('Choose a scenario to compare'), ' you can switch between A and B.'] },
            { text: ['In the card of Scenario B click the bar ', b('Quantities in the dish'), '.'], result: 'The bar opens and shows a field for every line in the dish, including a prep used by it. You can change that amount here; the prep’s internal lines stay unchanged.' },
            {
              text: ['Find ', b('Beef mince 80/20'), ' and type 160 in ', b('New net quantity (g)'), '. Leave ', b('Unit'), ' set to g.'],
              result: 'Fields you leave empty say “unchanged”. A small mark “1 changed” appears on the bar. The contribution becomes €7.49 (+€0.34).',
              image: img('simulator-qty', 'The opened bar Quantities in the dish with the field New net quantity filled with 160 for Beef mince 80/20.', 'Only the fields you fill in are changed.'),
            },
          ],
        },
        {
          kind: 'note',
          tone: 'important',
          title: 'Be careful with portions',
          text: 'A smaller portion can change the quality of the dish, and it can affect food safety or allergen information. The program only calculates. Please check this yourself before you change a real recipe.',
        },
        {
          kind: 'steps',
          title: 'Scenario C: what if the supplier returns to the old price',
          steps: [
            { text: ['Click ', b('Add scenario'), ' once more.'], result: ['Scenario C appears. The button now says “Up to 3 scenarios” and is greyed out: three is the most.'] },
            { text: ['In the card of Scenario C click the bar ', b('Ingredient prices'), '.'], result: 'The bar opens and lists the ingredients of the dish and of its preps.' },
            {
              text: ['Find ', b('Beef mince 80/20'), '. Under its name you see the price now and the earlier price. In ', b('New pack price of Beef mince 80/20 (excl. VAT)'), ' type 14.00.'],
              result: ['The line “That is €14.00/kg excl. VAT.” appears. The contribution becomes €7.69 (+€0.54). The real price on the Ingredients page stays €17.00.'],
              image: img('simulator-prices', 'The opened bar Ingredient prices with Beef mince 80/20: now €17.00 per 1 kg pack, before €14.00/kg, and the new pack price 14.00 typed in.', 'The real price is not changed: this only goes into the copy.'),
            },
          ],
        },
        {
          kind: 'steps',
          title: 'Read the comparison',
          steps: [
            { text: ['Look at the table ', b('Same starting point, different choices'), '.'], result: ['On a computer it has four columns: Baseline (today) and Scenarios A, B and C. Each scenario shows the difference from Baseline under its number. Green marks a favourable change in the calculation, red an unfavourable one. The arrow shows whether the number goes up or down, so lower ingredient costs have a green arrow pointing down. The chosen scenario has a tinted column.'], image: img('simulator-compare', 'The comparison table with the columns Baseline, Scenario A, B and C and the differences from Baseline.', 'Green is a favourable change, red an unfavourable one. The arrow shows up or down.') },
            { text: ['Look at the row ', b('Contribution per portion'), '. The small marks show how much more or less is left from one portion, compared with Baseline.'] },
            { text: ['Look at the rows ', b('Estimated monthly contribution'), ' and ', b('Monthly difference'), '. They show the difference per month at your sales estimate: A +€206.42, B +€102.00, C +€162.00.'] },
            { text: 'Read the sentence under the table. It names the column with the highest estimated monthly contribution. That column also says “highest monthly”.', result: 'This is only a calculation from your numbers. It is not advice and not a forecast.' },
          ],
        },
        {
          kind: 'steps',
          title: 'Save a scenario and give it a name',
          steps: [
            { text: ['Under ', b('Choose a scenario to compare'), ', click ', b('Scenario A'), '.'], result: 'The card now shows Scenario A with the menu price 13.83.' },
            { text: ['In the card, click the field ', b('Scenario name'), '. It says Scenario A.'] },
            { text: 'Hold Ctrl and press A. On a Mac, use ⌘ and A.', result: 'The old name is selected. Without this step, your text would be added after the old name.' },
            { text: ['Type the new name: Price 13.83.'], result: 'The column in the table gets the same name. This step is optional.' },
            { text: ['Click ', b('Save scenario'), '.'], result: ['The text under the buttons changes from “Not saved yet.” to “Saved.” The button is now called ', b('Save changes'), ' and is grey until you change something.'] },
            {
              text: ['To throw a scenario away, click ', b('Remove'), ' (not saved yet) or ', b('Delete'), ' (saved). A saved one asks you to confirm with ', b('Delete scenario'), '.'],
              result: 'Only the scenario disappears. Your dishes and prices are not touched.',
            },
          ],
        },
        {
          kind: 'note',
          tone: 'important',
          title: 'Unsaved scenarios are lost when you close the page',
          text: ['While you stay in MenuPilot, an unsaved scenario waits for you when you come back to the dish. If you close or reload the page, it is gone. Press ', b('Save scenario'), ' for everything you want to keep.'],
        },
        { kind: 'h3', text: '“Baseline changed” and “Update baseline”' },
        {
          kind: 'p',
          text: 'A scenario keeps the recipe and prices from when you created it or last used Update baseline. Save scenario keeps that starting point; it does not automatically fetch newer prices. If a price changes later, the scenario would be compared with old numbers. The program warns you and lets you calculate again on today’s data.',
        },
        {
          kind: 'steps',
          title: 'See it yourself',
          steps: [
            { text: ['Save Scenario A as described above.'] },
            { text: ['Click ', b('Ingredients'), ', press ', b('New price'), ' in the row of Beef mince 80/20, type 18.50 and click ', b('Save price'), '.'] },
            { text: ['Click ', b('Simulator'), ', then the card ', b('Classic Burger'), '.'], result: ['The card of the scenario shows a gold note “Baseline changed since this scenario was saved”, and the table marks the column “older prices”.'], image: img('simulator-stale', 'The gold note Baseline changed since this scenario was saved with the button Update baseline.', 'The note appears inside the scenario card.') },
            { text: ['Click ', b('Update baseline'), ' to use the current recipe and prices for comparison.'], result: ['Only this scenario is recalculated, on today’s prices. Your changes stay where they still apply. The text under the buttons says “Unsaved changes.”: click ', b('Save changes'), ' to keep the update.'] },
          ],
        },
        {
          kind: 'p',
          text: ['To restore the mince price, add a new price of €17.00 excl. VAT for 1 kg (', b('New price'), ' on the Ingredients page). ', b('Reset to demo data'), ' replaces everything, including your practice recipes and saved scenarios.'],
        },
        { kind: 'p', text: 'Amounts are rounded to cents, so a difference per month may not be exactly the difference per portion times 300.' },
        { kind: 'h3', text: 'Messages in the Simulator' },
        {
          kind: 'messages',
          items: [
            { message: 'Baseline changed since this scenario was saved', meaning: ['Prices or the recipe changed after you saved it. Click ', b('Update baseline'), ' to calculate on today’s data.'] },
            { message: 'Baseline updated. Some changes no longer apply and were removed (save to keep this):', meaning: ['After the update, one of your changes did not fit any more (for example an ingredient was removed from the recipe). Click ', b('OK'), ', check the numbers and save if you agree.'] },
            { message: 'Not enough data to compare monthly results.', meaning: ['The table needs at least two columns with a monthly figure. Type a number in ', b('Expected sales per month (your estimate)'), ' and make sure no price is missing, or press ', b('Update baseline'), ' on a scenario marked “older prices”.'] },
            { message: 'Enter your estimate. Enter 0 for no sales.', meaning: ['The dish has a monthly volume, so the field cannot be left empty. Type a number, or 0. Note: 0 means you expect no sales. Monthly amounts become zero; they are not hidden.'] },
            { message: 'Enter a whole number of 0 or more, for example 300.', meaning: ['In the field for sales per month, type a whole number such as 300, without words or a unit.'] },
          ],
        },
      ],
    },
    /* ----------------------------------------------------------------- 11 */
    {
      id: 'data',
      title: 'Your data and backups',
      blocks: [
        { kind: 'p', text: 'Your data is saved after you successfully use a save button. MenuPilot does not upload it to a server. It stays in this browser on this computer. Recipe drafts are also stored in this browser on this computer for this dataset for up to 7 days. Someone with access to this browser may see them. The other side of this: if the browser data is cleared, or you open MenuPilot in another browser or on another computer, your data is not there. A backup copy protects saved data.' },
        { kind: 'image', image: img('data-page', 'The Data page with the cards Export backup, Import backup, Reset to demo data and Start with empty data.', 'Make a backup before replacing or removing data.') },
        {
          kind: 'note',
          tone: 'important',
          title: 'How often to make a backup',
          text: ['Once a week, and after every big change: new prices, new recipes, a long session in the Simulator. It takes a few seconds. Before making a backup, save the recipes and scenarios you want to keep. Unsaved entries are not included.'],
        },
        {
          kind: 'steps',
          title: 'Make a backup copy (Export backup)',
          steps: [
            { text: ['Click ', b('Data'), ' in the menu.'], result: ['The Data page opens. Under the title it says what is inside now, for example “Now: 12 ingredients, 7 recipes, 0 saved scenarios.”'] },
            { text: ['In the card ', b('Export backup'), ' click ', b('Export backup'), '.'], result: ['Your browser saves a file named like menupilot-backup-2026-10-20.json, usually in the folder Downloads. The page says “Backup saved as … Keep it somewhere safe.”'] },
            { text: 'Find that file in your Downloads folder and copy it to a safe place: a USB stick, or send it to yourself by email.', result: 'Now you have a copy that survives even if the computer is lost.' },
          ],
        },
        {
          kind: 'note',
          tone: 'important',
          title: 'Importing replaces everything',
          text: ['Importing a backup replaces all current data. Entries made after that backup will be lost. First export a separate backup of your current data.'],
        },
        {
          kind: 'steps',
          title: 'Put a backup back (Import backup)',
          steps: [
            { text: ['Click ', b('Data'), ', then in the card ', b('Import backup'), ' click the button ', b('Import backup'), '.'], result: 'A window of your computer opens to choose a file.' },
            { text: 'Choose your backup file (the name starts with menupilot-backup) and click Open.', result: ['A window “Import this backup?” opens and shows the name of the file. It says that all current data will be replaced.'] },
            { text: ['To go on, click ', b('Replace with backup'), '. To change your mind, click ', b('Cancel'), '.'], result: ['The message “Backup … was imported. Your data is replaced.” appears. If the file cannot be used, a red message appears in the window and tells why, and nothing is changed.'] },
          ],
        },
        {
          kind: 'steps',
          title: 'Go back to the demo data (Reset to demo data)',
          steps: [
            { text: ['Click ', b('Data'), ', then in the card ', b('Reset to demo data'), ' click the button ', b('Reset to demo data'), '.'], result: ['A window “Reset to demo data?” opens. It says that all current data is replaced.'], image: img('data-reset-dialog', 'The window Reset to demo data? with the buttons Cancel and Reset to demo data.', 'If you have unsaved scenarios, a note in this window counts them.') },
            { text: ['Need to keep your data? Click ', b('Cancel'), '. Make a copy with ', b('Export backup'), '. Then open ', b('Reset to demo data'), ' again. Otherwise, read the window and go on.'] },
            { text: ['Click the red button ', b('Reset to demo data'), '. To change your mind, click ', b('Cancel'), '.'], result: ['The message “Demo data restored.” appears. The demo is loaded in the language of the screen.'] },
          ],
        },
        {
          kind: 'note',
          tone: 'important',
          title: 'Read before you empty the program',
          text: ['“Start with empty data” removes everything that is in the program now: the demo and anything you typed yourself. If you have already entered your own data, first make a copy: see step 1 below. Practice recipes and saved scenarios are removed too. Make a backup if you want to keep them.'],
        },
        {
          kind: 'steps',
          title: 'Start with your own data (empty program)',
          steps: [
            {
              text: ['Only if you already typed your own data: make a backup first. Click ', b('Data'), ', then ', b('Export backup'), ' (described above).'],
              result: 'A file named menupilot-backup with today’s date is saved on your computer.',
            },
            { text: ['In the menu at the top, click ', b('Data'), '.'], result: 'The Data page opens with four cards: Export backup, Import backup, Reset to demo data and Start with empty data.' },
            {
              text: ['Scroll down to the card ', b('Start with empty data'), ' and click the button ', b('Start with empty data'), ' in it.'],
              result: ['A window “Start with empty data?” opens. It says that everything will be removed.'],
              image: img('data-empty-dialog', 'The confirmation window Start with empty data? with the buttons Cancel and Start with empty data.', 'You can still change your mind: Cancel closes the window and changes nothing.'),
            },
            {
              text: 'Read the window. If you have simulator scenarios that you did not save, a note says how many will be lost.',
            },
            {
              text: ['To go on, click the red button ', b('Start with empty data'), '. To change your mind, click ', b('Cancel'), '.'],
              result: ['The message “All data was removed. Start by adding ingredients on the Ingredients page.” appears, and the page says “Now: 0 ingredients, 0 recipes, 0 saved scenarios.”'],
            },
            { text: ['Click ', b('Ingredients'), ' in the menu, then click ', b('Add your first ingredient'), '.'], result: ['The window for a new ingredient opens. ', secLink('ingredients', true), ' shows how to fill it in.'] },
          ],
        },
        {
          kind: 'note',
          tone: 'safe',
          title: 'You can cancel before replacing data',
          text: ['Cancel closes the window without replacing data. Confirming replaces your current data. You can restore it from a backup you made beforehand. A file that is not a MenuPilot backup is rejected, and your current data stays as it was.'],
        },
      ],
    },
    /* ----------------------------------------------------------------- 12 */
    {
      id: 'troubleshooting',
      title: 'What to do if…',
      blocks: [
        { kind: 'p', text: 'Most problems have a simple answer. Find your situation below.' },
        { kind: 'h3', text: 'I typed a wrong number' },
        {
          kind: 'list',
          items: [
            ['The number is not saved yet: click its field. Hold Ctrl and press A (on a Mac: ⌘ and A). Type the correct number. Then click the save button.'],
            ['You do not want to save at all: click ', b('Cancel'), ' (in a recipe: ', b('Discard changes'), '). Nothing is saved.'],
            ['A wrong ingredient price was already saved: open ', b('New price'), ' for that ingredient and save the right price. The newest price counts. The incorrect price stays in the history. It may still affect comparisons with dates before your correction.'],
            ['A recipe was saved with a wrong number: click ', b('Recipes'), ', open the dish, correct the number and click ', b('Save changes'), '.'],
          ],
        },
        { kind: 'h3', text: 'A window does not close' },
        {
          kind: 'steps',
          title: 'How to close it',
          steps: [
            { text: ['Click ', b('Cancel'), ' or the × at the top right of the window.'], result: 'The window closes.' },
            { text: 'If that does not work, press the Esc key on your keyboard.' },
            { text: 'If the whole page does not react, reload it: press F5 (on a Mac: the ⌘ key and R).', result: 'The page opens again. Everything that was saved is still there. Only what you were typing is gone.' },
          ],
        },
        { kind: 'h3', text: 'A red message appeared' },
        { kind: 'p', text: 'A red message means the program did not accept something and did not save it. Read it, it says what to correct. Here are the messages you can meet.' },
        {
          kind: 'messages',
          items: [
            { message: 'Enter a name.', meaning: 'The Name field is empty. Type a name.' },
            { message: 'Pack size must be greater than zero.', meaning: ['The ', b('Pack size'), ' field is empty or zero. Type the size from the invoice, for example 1 with the unit kg.'] },
            { message: 'Pack price excl. VAT must be a non-negative amount.', meaning: ['The pack price is empty or not a number. Type the price from the invoice without VAT, for example 11.20. Do not type €. A minus sign is not accepted.'] },
            { message: 'Enter a non-negative amount with at most two decimal places. Example: 13.83', meaning: 'Enter zero or a positive amount, such as 13.83. Use up to two decimal places. Do not type €.' },
            { message: 'Enter a quantity, for example 150.', meaning: ['Enter a number greater than zero in ', b('Net quantity'), ', such as 150 or 0.5. Choose the unit in the list beside it. Do not type words or units in the field.'] },
            { message: 'This ingredient is measured in g. Use g or kg.', meaning: 'You chose a unit of the wrong kind, for example litres for a product that is weighed. Choose a unit from the list.' },
            { message: 'Enter a non-negative amount.', meaning: ['The ', b('Menu price (incl. VAT)'), ' of the dish is empty or not a number. Type the price your guest pays, for example 13.50.'] },
            { message: 'Enter a whole number of portions, 1 or more.', meaning: ['In ', b('Portions per batch'), ' type a whole number such as 1 or 4.'] },
            { message: 'Enter a whole number (0 or more), or leave this empty.', meaning: ['In ', b('Monthly volume (optional)'), ' type a whole number such as 300, or clear the field.'] },
            { message: 'Enter a yield from 0.01 to 100 percent, for example 100 or 85.5.', meaning: ['Enter a number from 0.01 to 100 in ', b('Yield %'), '. Enter 100 if nothing is lost.'] },
            { message: 'Choose an ingredient or a prep.', meaning: ['A line has no ingredient. Open the list ', b('Ingredient or prep'), ' and choose one, or click ', b('Remove'), ' for that line.'] },
            { message: 'Some fields need attention. They are marked above.', meaning: 'Scroll up. The fields with a problem have a red text under them. Correct them and press Save again.' },
            { message: 'This ingredient is still used by recipes and cannot be deleted.', meaning: ['You cannot delete something that a recipe uses. See the end of ', sec('ingredients'), '.'] },
            { message: 'A prep cannot use itself.', meaning: 'A prep cannot contain itself. Choose another ingredient or prep for that line.' },
            { message: 'Your browser storage is full. Your data was not changed.', meaning: ['The browser has no room left. Make a backup (', sec('data'), ') and ask someone to free browser space.'] },
            { message: 'This file is not valid JSON. Your current data was not changed.', meaning: 'The file you chose is not a MenuPilot backup. Choose the file whose name starts with menupilot-backup. Nothing was changed.' },
          ],
        },
        { kind: 'h3', text: 'I changed a number, but the result stayed the same' },
        { kind: 'p', text: ['Look for a red message below the field. Until the entry is corrected, the Simulator shows the last accepted values: “Fix the marked fields to save; results show your last valid values.”'] },
        { kind: 'h3', text: 'My data disappeared' },
        {
          kind: 'steps',
          title: 'What to check',
          steps: [
            { text: 'Stay calm and do not click “Start with empty data” or “Reset to demo data”: they replace everything.' },
            { text: 'Check that you use the same browser (for example Chrome, not Edge), the same computer and the same web address as before, and not a private window. The data lives in one browser on one computer.', result: 'If it was a different browser, open the one you used before.' },
            { text: ['If you have a backup file: click ', b('Data'), ', then ', b('Import backup'), ' and choose it (', sec('data'), ').'], result: 'Your data comes back as it was on the day of the backup.' },
            { text: ['If the page says “Your data could not be opened” and “Nothing was changed or deleted”, do not press anything else. Ask the person who set up the program for you to help.'], result: 'Your saved data is still in the browser. It was only not readable.' },
          ],
        },
        { kind: 'p', text: 'If there is no backup and the browser data was cleared, the data cannot be brought back. This is why a weekly backup is worth the few seconds.' },
        { kind: 'h3', text: 'I want to work on another computer' },
        {
          kind: 'steps',
          title: 'How to move your data',
          steps: [
            { text: ['On the old computer: click ', b('Data'), ' and ', b('Export backup'), '.'], result: 'A backup file is saved.' },
            { text: 'Copy the file to the other computer with a USB stick, or send it to yourself by email.' },
            { text: ['On the other computer open MenuPilot, click ', b('Data'), ' and ', b('Import backup'), ', choose the file and click ', b('Replace with backup'), '.'], result: 'Your data is there. From now on the two computers keep separate copies: a change on one does not appear on the other.' },
          ],
        },
        { kind: 'h3', text: 'On the phone everything is small or looks different' },
        {
          kind: 'steps',
          title: 'What helps',
          steps: [
            { text: 'Turn the phone on its side.', result: 'The screen is wider and the text is easier to read.' },
            { text: 'Spread two fingers on the screen to make things larger.' },
            { text: ['Know that on a narrow screen the menu hides behind the button ', b('Menu'), ', and the tables become cards: each dish or ingredient is a separate card with the same numbers.'] },
            { text: 'For typing a lot of data, use a computer or a tablet if you can.' },
          ],
        },
        { kind: 'h3', text: 'The screen says “Something went wrong”' },
        {
          kind: 'steps',
          title: 'What to do',
          steps: [
            { text: ['Read the text under the title. It says: “Reload the app to try again. Your saved data was not changed.”'] },
            { text: ['Click the button ', b('Reload'), '.'], result: 'The program starts again, and your saved data is there.' },
            { text: 'If it appears again, remember what you did just before and ask for help.' },
          ],
        },
        { kind: 'h3', text: 'The numbers look wrong' },
        {
          kind: 'steps',
          title: 'What to check',
          steps: [
            { text: ['Look at the prices of the ingredients on the Ingredients page. Are they without VAT, as on the invoice? Is the pack size right (1 kg, not 1 g)?'] },
            { text: ['Look at ', b('Yield %'), ' in the lines. 100 means nothing is lost.'] },
            { text: ['Look at ', b('Portions per batch'), ' in the dish. The quantities in the lines are for the whole batch, so a dish made in a batch of four needs 4.'] },
            { text: ['If a row shows “cost unknown”, an ingredient has no price yet. Add it with ', b('New price'), '.'] },
          ],
        },
      ],
    },
  ],
};
