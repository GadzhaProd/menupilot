import { b, to, type HelpDocument, type HelpImage, type HelpImageId } from './types';

const img = (id: HelpImageId, alt: string, caption?: string): HelpImage => (caption === undefined ? { id, alt } : { id, alt, caption });

/** The guide in English. Button and field names are written exactly as the screen shows them. */
export const contentEn: HelpDocument = {
  lang: 'en',
  title: 'MenuPilot: step-by-step guide',
  subtitle: 'For anyone who has never used a program like this. Take your time: every step is one small action.',
  ui: {
    languageLabel: 'Language',
    print: 'Print this guide',
    contents: 'Contents',
    toTop: 'Up to the top',
    stepsDone: 'What you will see',
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
        { kind: 'p', text: 'This guide shows how to use MenuPilot, one small step at a time. You do not need any computer skills. Read slowly and do one step, then look at the screen.' },
        {
          kind: 'note',
          tone: 'safe',
          title: 'This is safe',
          text: ['You cannot break the program by looking around. If you make a mistake in a window, press ', b('Cancel'), ': nothing is saved. The demo cafe is made up, so you can try everything on it.'],
        },
        {
          kind: 'steps',
          title: 'How to read the steps',
          steps: [
            {
              text: ['Names of buttons and fields are written in ', b('bold'), '. They are written exactly as on the screen. The program’s screen is in English, so these names stay in English.'],
            },
            {
              text: 'Each step is one action. Do it, then look at the screen. Under the step you will find what should appear.',
              result: 'If your screen looks different from the description, do not click anything else. Go back one step and read it again.',
            },
            {
              text: ['To jump to a part of this guide, click its name in the ', b('Contents'), ' list below.'],
              result: ['The page scrolls to that part. The round button ', b('Up to the top'), ' (bottom right) brings you back.'],
            },
            {
              text: ['To change the language, press ', b('English'), ' or ', b('Русский'), ' at the top of this page.'],
              result: 'The whole guide changes language. The program remembers your choice.',
              image: img('help-toolbar', 'The language buttons English and Russian, and the Print this guide button.', 'The language buttons and the print button are at the top of this page.'),
            },
            {
              text: ['To print the guide on paper, press ', b('Print this guide'), '.'],
              result: 'The printing window of your computer opens. The printed guide has large letters and no menu.',
            },
            {
              text: 'To make everything on the screen larger, hold the Ctrl key and press the plus key (on a Mac: the ⌘ key and plus). Press the minus key to make it smaller again.',
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
        { kind: 'image', image: img('dashboard-table', 'The Dashboard table: the Classic Burger row shows the cost then and now, the change in euros and the monthly impact.', 'The Dashboard shows for every dish what changed. The Classic Burger row shows €4.20 before, €4.85 now, and −€195.00 per month.') },
        {
          kind: 'list',
          items: [
            [b('Ingredients'), ': what you buy and its price. Every new price is remembered with its date.'],
            [b('Recipes'), ': your dishes and your preps (sauces and other things made in a batch).'],
            [b('Dashboard'), ': which dishes became more expensive, and how much that costs you per month.'],
            [b('Simulator'), ': a safe place to try “what if” without changing your real data.'],
            [b('Data'), ': copies of your data (backups).'],
          ],
        },
        {
          kind: 'note',
          tone: 'safe',
          title: 'A demo cafe is already inside',
          text: ['The first time you open MenuPilot you see a made-up burger cafe. Nothing in it is real, so try everything freely. How to switch to your own data is in ', to('first-start', 'section 4'), '.'],
        },
        {
          kind: 'note',
          tone: 'important',
          title: 'Where your data lives',
          text: ['Everything you type stays only in this browser on this computer. It is not sent anywhere and there is no account. This is why you should make copies from time to time: see ', to('data', 'section 10'), '.'],
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
              term: 'Net quantity',
              meaning: 'How much of an ingredient ends up in the dish, for example on the plate.',
              example: '180 g of mince in a burger.',
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
            { term: 'Baseline', meaning: 'Your real data as it is today. In the Simulator it is the starting point that every scenario is compared with.' },
            {
              term: 'Expected sales per month (monthly volume)',
              meaning: 'How many portions of a dish you think you sell in a month. This is your own estimate, not a forecast made by the program. It turns the difference per portion into euros per month. You may leave it empty.',
              example: '300 burgers a month.',
            },
            {
              term: 'cost unknown',
              meaning: 'MenuPilot shows this when a price is missing, so the cost cannot be calculated. It never shows zero for something unknown.',
              example: 'You added an ingredient but not its price yet.',
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
      title: 'First start: demo data or your own data',
      blocks: [
        { kind: 'p', text: 'When you open MenuPilot for the first time, it already contains a made-up burger cafe: 12 ingredients, 5 dishes and 2 preps. Use it to learn. When you are ready, you can empty the program and enter your own data.' },
        {
          kind: 'note',
          tone: 'safe',
          title: 'You cannot spoil the demo',
          text: ['Whatever you change in the demo, you can always go back: ', b('Reset to demo data'), ' on the Data page puts the original demo back.'],
        },
        {
          kind: 'steps',
          title: 'Look around the demo cafe',
          steps: [
            {
              text: ['Look at the top of the screen. You see the menu: ', b('Dashboard'), ', ', b('Ingredients'), ', ', b('Recipes'), ', ', b('Simulator'), ', ', b('Data'), ' and ', b('Help'), '.'],
              result: 'The button of the page you are on is highlighted.',
              image: img('menu', 'The main menu at the top of the screen with six items: Dashboard, Ingredients, Recipes, Simulator, Data, Help.', 'The menu at the top of every page.'),
            },
            { text: ['Click ', b('Ingredients'), '.'], result: 'A list of 12 ingredients with their prices opens.' },
            { text: ['Click ', b('Recipes'), '.'], result: 'You see five dishes and two preps, each with its cost.' },
            { text: ['Click ', b('Dashboard'), '.'], result: 'You see which dishes became more expensive. Section 8 explains this page.' },
          ],
        },
        {
          kind: 'note',
          tone: 'important',
          title: 'Read before you remove the demo',
          text: ['“Start with empty data” removes everything that is in the program now: the demo and anything you typed yourself. If you have already entered your own data, first make a copy: see step 1 below. If you only have the demo, there is nothing to lose.'],
        },
        {
          kind: 'steps',
          title: 'Start with your own data (empty program)',
          steps: [
            {
              text: ['Only if you already typed your own data: make a backup first. Click ', b('Data'), ', then ', b('Export backup'), ' (details in ', to('data', 'section 10'), ').'],
              result: 'A file named menupilot-backup with today’s date is saved on your computer.',
            },
            { text: ['In the menu at the top, click ', b('Data'), '.'], result: 'The Data page opens with several cards: Export backup, Import backup, Reset to demo data and Start with empty data.', image: img('data-page', 'The Data page with the cards Export backup, Import backup, Reset to demo data and Start with empty data.', 'The last card is Start with empty data.') },
            {
              text: ['Scroll down to the card ', b('Start with empty data'), ' and click the button ', b('Start with empty data'), ' in it.'],
              result: ['A window “Start with empty data?” opens. It says that everything will be removed.'],
              image: img('data-empty-dialog', 'The confirmation window Start with empty data? with the buttons Cancel and Start with empty data.', 'You can still change your mind: Cancel closes the window and changes nothing.'),
            },
            {
              text: 'Read the window. If you have simulator scenarios that you did not save, a yellow note says how many will be lost.',
            },
            {
              text: ['To go on, click the red button ', b('Start with empty data'), '. To change your mind, click ', b('Cancel'), '.'],
              result: ['The message “All data was removed. Start by adding ingredients on the Ingredients page.” appears, and the page says “Now: 0 ingredients, 0 recipes, 0 saved scenarios.”'],
            },
            { text: ['Click ', b('Ingredients'), ' in the menu, then click ', b('Add your first ingredient'), '.'], result: 'The window for a new ingredient opens. Section 5 shows how to fill it in.' },
          ],
        },
      ],
    },
    /* ------------------------------------------------------------------ 5 */
    {
      id: 'ingredients',
      title: 'Ingredients and their prices',
      blocks: [
        { kind: 'p', text: 'Everything starts with ingredients: what you buy and the price on the supplier’s invoice. MenuPilot keeps every price you enter, with its date. The newest price is the one used in calculations. The older ones stay in the history, and the Dashboard needs them to show what changed.' },
        { kind: 'image', image: img('ingredients-list', 'The Ingredients page: the green Add ingredient button at the top right and the table of ingredients with the buttons New price, History, Rename and Delete in each row.', 'The button Add ingredient is at the top right. Each row has four buttons on the right.') },
        {
          kind: 'steps',
          title: 'Add a new ingredient (example: olive oil, a 5 litre can for €24.00)',
          steps: [
            { text: ['Click ', b('Ingredients'), ' in the menu.'], result: 'The list of your ingredients opens.' },
            { text: ['Click the green button ', b('Add ingredient'), ' at the top right of the page.'], result: 'A window “Add ingredient” opens.' },
            { text: ['Click the field ', b('Name'), ' and type the name: Olive oil.'] },
            {
              text: ['In ', b('Pack size'), ' type the size of one pack as written on the invoice: 5. Then open the field ', b('Unit'), ' next to it and choose ', b('l'), '. The choices are: g (grams), kg (kilograms), ml (millilitres), l (litres), pc (pieces).'],
              result: 'The field Unit shows l.',
            },
            {
              text: ['In ', b('Pack price (€, excl. VAT)'), ' type the price from the invoice, without VAT: 24.00. You can use a point or a comma.'],
              result: ['Below the fields the program shows “That is €4.80/l excl. VAT.” This is the price per litre.'],
              image: img('ingredient-add', 'The window Add ingredient filled in: Olive oil, pack size 5 l, pack price 24.00, and the line That is €4.80/l excl. VAT.', 'The window with Olive oil filled in.'),
            },
            { text: ['Click the green button ', b('Add ingredient'), ' in the window.'], result: 'The window closes and Olive oil is in the list.' },
          ],
        },
        { kind: 'note', tone: 'safe', title: 'If you make a mistake', text: ['Press ', b('Cancel'), ' (or the key Esc on your keyboard). The window closes and nothing is saved.'] },
        {
          kind: 'note',
          tone: 'important',
          title: 'You do not know the price yet?',
          text: ['Type only the name and leave the pack size and the price empty. Add the price later with ', b('New price'), '. Until then the dishes that use this ingredient show “cost unknown”, which is honest: the program does not guess.'],
        },
        {
          kind: 'steps',
          title: 'The supplier raised a price (example: beef mince from €17.00 to €18.50 per kg)',
          steps: [
            { text: ['Click ', b('Ingredients'), '.'], result: 'The list opens.' },
            { text: ['Find the row ', b('Beef mince 80/20'), '. At the end of the row click the button ', b('New price'), '.'], result: ['A window “New price: Beef mince 80/20” opens. It says “Now: €17.00 excl. VAT for 1 kg. The old price stays in the history.”'] },
            { text: ['Look at ', b('Pack size'), '. It is already filled in with the last pack size. Change it only if the pack is different now.'] },
            {
              text: ['Click ', b('Pack price (€, excl. VAT)'), ' and type the new price from the invoice, without VAT: 18.50.'],
              result: 'Below the fields you see the new price per kilo.',
              image: img('ingredient-price', 'The window New price: Beef mince 80/20, with the new pack price 18.50 typed in.', 'Only the price needs to be typed; the pack size is already there.'),
            },
            { text: ['Click ', b('Save price'), '.'], result: 'The window closes. In the row, the price is €18.50 and the date in the column Last price is today’s.' },
          ],
        },
        {
          kind: 'note',
          tone: 'important',
          title: 'This changes real data',
          text: ['In the demo cafe too: the burger becomes more expensive on the Dashboard. To go back to the original demo: Data, then ', b('Reset to demo data'), '.'],
        },
        {
          kind: 'steps',
          title: 'See the price history of an ingredient',
          steps: [
            { text: ['In the row of the ingredient click ', b('History'), '.'], result: ['A window “Price history” opens. The newest price is first and has the grey mark “current”. The older prices are below, each with its date.'], image: img('ingredient-history', 'The window Price history: Beef mince 80/20 with two prices, the current one and an older one.', 'The newest price is on top.') },
            { text: ['Click ', b('Close'), '.'], result: 'The window closes. Nothing was changed.' },
          ],
        },
        { kind: 'p', text: 'Old prices are never changed or deleted. This is on purpose: that is how the Dashboard can tell you what a dish cost a month ago.' },
        {
          kind: 'steps',
          title: 'Rename an ingredient',
          steps: [
            { text: ['In the row of the ingredient click ', b('Rename'), '.'], result: ['A small window “Rename ingredient” opens.'], image: img('ingredient-rename', 'The window Rename ingredient with the field Name.', 'Recipes that use the ingredient keep working under the new name.') },
            { text: ['Click the field ', b('Name'), ', change the name and click the green button ', b('Rename'), '.'], result: 'The window closes and the new name is in the list and in all recipes.' },
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
          text: 'An ingredient that is used in a recipe cannot be deleted, because the recipe would lose a part. The program tells you which recipes use it. Open each of them, remove the line with this ingredient (button Remove), press Save changes, and then delete the ingredient.',
        },
        { kind: 'image', image: img('ingredient-in-use', 'The window Delete Beef mince 80/20 with a red message that it is used by Classic Burger, and a link to Classic Burger.', 'The red message names the recipe. The link under it opens that recipe.') },
      ],
    },
    /* ------------------------------------------------------------------ 6 */
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
          kind: 'steps',
          title: 'Create a prep (example: Mustard mayo, 900 g mayonnaise and 100 g mustard make 1 kg)',
          steps: [
            { text: ['Click ', b('Recipes'), ' in the menu.'], result: 'You see the cards Dishes and Preps.' },
            { text: ['In the card ', b('Preps'), ' click the button ', b('New prep'), '.'], result: ['A page “New prep” opens.'] },
            { text: ['Click the field ', b('Name'), ' and type: Mustard mayo.'] },
            {
              text: ['In ', b('One batch makes'), ' type how much the whole batch produces: 1. Open ', b('Batch unit'), ' and choose ', b('kg'), '.'],
              result: 'The batch is everything you make at one time. Here it is one kilo.',
              image: img('prep-form', 'The top of the New prep page: Name Mustard mayo, One batch makes 1 kg.', 'The first card of a new prep.'),
            },
            { text: ['In the first line, open the list ', b('Ingredient or prep'), ' and choose ', b('Mayonnaise · g'), '.'], result: 'The unit next to the quantity shows g.' },
            {
              text: ['In ', b('Net quantity'), ' type 900. Leave ', b('Yield %'), ' at 100.'],
              result: ['At the end of the line, ', b('Line cost (excl. VAT)'), ' shows €3.96.'],
            },
            { text: ['Click ', b('Add line'), '. In the new line choose ', b('Dijon mustard · g'), ' and type 100 in ', b('Net quantity'), '.'], result: ['The line cost shows €0.50.'], image: img('prep-lines', 'The card Ingredients and preps with two lines: Mayonnaise 900 g and Dijon mustard 100 g.', 'Two lines make one batch.') },
            { text: ['Look at the card ', b('Cost'), ' at the bottom.'], result: ['It shows ', b('Cost per kg, l or pc (excl. VAT)'), ': €4.46/kg. It changes while you type.'], image: img('prep-cost', 'The card Cost with Batch cost €4.46, One batch makes 1 kg, Cost per kg €4.46/kg.', 'The cost of the whole batch and of one kilo.') },
            { text: ['Click the green button ', b('Save prep'), '.'], result: 'The prep is saved. It is now in the list of preps on the Recipes page.' },
          ],
        },
        {
          kind: 'note',
          tone: 'important',
          title: 'Nothing is saved until you press Save',
          text: ['The Cost card changes while you type, but the recipe is saved only when you press ', b('Save prep'), '. If you leave the page before, what you typed is lost.'],
        },
        { kind: 'p', text: ['A prep can use other preps, but not itself and not in a circle. The program refuses this with a clear message, and it allows at most 5 levels. To delete a prep or change it, open it from the Recipes page. A prep that a dish uses cannot be deleted until you remove it from that dish. How to use a prep in a dish is shown in ', to('dishes', 'section 7'), '.'] },
      ],
    },
    /* ------------------------------------------------------------------ 7 */
    {
      id: 'dishes',
      title: 'Dishes: recipe, price and cost',
      blocks: [
        { kind: 'p', text: 'A dish is something a guest orders. For each dish you enter the menu price, the VAT rate and the lines: what goes into it and how much. MenuPilot then shows what the dish costs and what is left from its price.' },
        {
          kind: 'steps',
          title: 'Create a dish (example: Chicken Bun for €9.80)',
          steps: [
            { text: ['Click ', b('Recipes'), ' in the menu.'], result: 'The cards Dishes and Preps open.' },
            { text: ['In the card ', b('Dishes'), ' click the green button ', b('New dish'), '.'], result: ['A page “New dish” opens.'] },
            { text: ['Click the field ', b('Name'), ' and type: Chicken Bun.'] },
            { text: ['In ', b('Menu price (€, incl. VAT)'), ' type the price your guest pays, with tax: 9.80.'] },
            {
              text: ['Look at ', b('VAT rate'), '. Leave it at 9% (food). For alcohol choose 21%. The list also has 0%.'],
              image: img('dish-form', 'The top of the New dish page: Chicken Bun, menu price 9.80, VAT rate 9%, portions per batch 1, monthly volume 100.', 'The first card of a dish.'),
            },
            { text: ['In ', b('Portions per batch'), ' leave 1. This number says how many portions the lines below make. If the lines make four portions, type 4.'] },
            { text: ['In ', b('Monthly volume (optional)'), ' type how many you think you sell in a month: 100. This is your own guess. You may leave it empty.'] },
            {
              text: ['In the first line open ', b('Ingredient or prep'), ' and choose ', b('Chicken breast fillet · g'), '. In ', b('Net quantity'), ' type 120. Leave ', b('Yield %'), ' at 100.'],
              result: ['The line cost shows €1.06.'],
            },
            { text: ['Click ', b('Add line'), '. Choose ', b('Brioche burger bun · pc'), ' and type 1 in ', b('Net quantity'), '.'], result: ['The line cost shows €0.88.'] },
            {
              text: ['Click ', b('Add line'), ' again. In the list, under the heading Preps, choose ', b('Mustard mayo · g'), ' and type 20.'],
              result: ['The line cost shows €0.09. Your prep is used inside the dish.'],
              image: img('dish-lines', 'The card Ingredients with three lines: Chicken breast fillet 120 g, Brioche burger bun 1 pc, Mustard mayo 20 g.', 'A dish line can be an ingredient or a prep.'),
            },
            {
              text: 'If part of a product is lost when you prepare it, lower Yield % in that line. For example, type 80 if a fifth is lost in peeling. The line cost goes up, because you must buy more.',
            },
            {
              text: ['Look at the card ', b('Cost'), ' at the bottom.'],
              result: 'It shows what one portion costs and what is left from the price: here €2.03 for ingredients, €8.99 price excl. VAT and €6.97 contribution. The next part explains every row.',
              image: img('dish-cost', 'The card Cost for Chicken Bun with the ingredient cost per portion, the price excl. VAT and the contribution.', 'The Cost card of the new dish.'),
            },
            { text: ['Click the green button ', b('Save dish'), '.'], result: 'The dish is saved and appears on the Recipes page and on the Dashboard.' },
          ],
        },
        {
          kind: 'note',
          tone: 'safe',
          title: 'Kilograms and litres',
          text: ['You may type 0.12 and choose ', b('kg'), ' instead of 120 and g. The program converts it itself. You cannot mix weight and volume: a line in grams cannot be typed in litres.'],
        },
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
              text: ['To delete the dish, click ', b('Delete dish'), ' at the bottom right, then confirm with the red button in the window. To keep it, click ', b('Cancel'), '.'],
              result: 'If the dish has saved simulator scenarios, the window says they will be deleted too.',
            },
          ],
        },
      ],
    },
    /* ------------------------------------------------------------------ 8 */
    {
      id: 'dashboard',
      title: 'Dashboard: what became more expensive',
      blocks: [
        { kind: 'p', text: 'The Dashboard answers one question: since a chosen date, which of my dishes became more expensive, and how much does that cost me per month? It only reads your data. Nothing you do here changes anything.' },
        {
          kind: 'steps',
          title: 'Read the Dashboard',
          steps: [
            { text: ['Click ', b('Dashboard'), ' in the menu (or the name MenuPilot at the top left).'], result: 'The Dashboard opens.' },
            {
              text: ['Find the line ', b('Compare prices with'), '. Click one of the buttons ', b('7 days'), ', ', b('30 days'), ' or ', b('90 days'), '.'],
              result: 'The chosen button turns green. All numbers below are now compared with the prices of that many days ago.',
              image: img('dashboard-picker', 'The line Compare prices with, three buttons 7 days, 30 days, 90 days, and the field Choose date.', 'The buttons for the comparison period and the date field.'),
            },
            {
              text: ['To compare with an exact day (for example the day of an old invoice), click the field ', b('Choose date'), ' and pick or type a date.'],
              result: 'The buttons lose their green colour, and the table is compared with that date. The date cannot be in the future.',
            },
            {
              text: 'Look at the four cards at the top.',
              result: ['They show how many dishes became more expensive, the ', b('Monthly impact at your volume'), ' in euros, the average food cost % and how many dishes have no monthly volume.'],
              image: img('dashboard-cards', 'Four cards: Dishes that got more expensive, Monthly impact at your volume, Average food cost %, Dishes without volume.', 'The four summary cards. A minus sign before the euros means you are left with less each month.'),
            },
            {
              text: ['Look at the table ', b('Dishes'), '. A dish that became more expensive has an orange mark ', b('↑ Cost increased'), ' after its name.'],
              result: 'Each row shows the cost then and now, the change in euros, what is left from the price now and the effect per month.',
              image: img('dashboard-table', 'The Dashboard table of dishes with the columns for cost at the comparison date, cost now, change, contribution now and monthly impact.', 'One row per dish.'),
            },
            { text: ['To try “what if” for a dish, click ', b('Simulate'), ' at the end of its row.'], result: 'The Simulator opens for that dish (see section 9).' },
            {
              text: ['Scroll down to the card ', b('Preps'), '.'],
              result: 'It shows what one kilo (or litre, or piece) of each prep costs now and on the comparison date.',
              image: img('dashboard-preps', 'The Preps card: Tomato base and Burger sauce, with cost now and cost on the comparison date.', 'Preps are shown separately from dishes.'),
            },
          ],
        },
        { kind: 'h3', text: 'What the columns mean' },
        {
          kind: 'list',
          items: [
            [b('Recipe-based ingredient cost at [date] / now'), ': what the ingredients of one portion cost then and today.'],
            [b('Change (€)'), ': the difference. A plus sign (+€0.65) means the dish became more expensive.'],
            [b('Food cost change (pts)'), ': how much the share of ingredients in the price moved, in percentage points. +5.4 pts means it went from 35.0% to 40.4%.'],
            [b('Contribution now (before other costs)'), ': what is left from the price after ingredients. This is not profit.'],
            [b('Monthly impact at your volume'), ': contribution now minus contribution then, times your monthly sales number. A minus sign (−€195.00) means you are left with that much less per month. It is a calculation from your own number, not a forecast.'],
          ],
        },
        { kind: 'h3', text: 'Signs you may see instead of a number' },
        {
          kind: 'messages',
          items: [
            { message: '—', meaning: ['The dish has no monthly volume, so there is no monthly impact. To see it, open the dish, type ', b('Monthly volume (optional)'), ' and click ', b('Save changes'), '.'] },
            { message: 'cost unknown', meaning: ['A price is missing for an ingredient of this dish. Add the price on the Ingredients page.'] },
            { message: 'no price on this date', meaning: ['One of the ingredients had no price yet on the chosen date, because you started entering prices later. Choose a more recent date.'] },
            { message: 'n/a', meaning: ['The number cannot be calculated, for example a percentage when the menu price is €0.00.'] },
            { message: '(incomplete)', meaning: ['Next to the menu total: some dishes with a monthly volume had to be left out, and the line below says why.'] },
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
    /* ------------------------------------------------------------------ 9 */
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
        {
          kind: 'steps',
          title: 'Open the Simulator for the Classic Burger',
          steps: [
            { text: ['Click ', b('Simulator'), ' in the menu.'], result: 'A list of your dishes opens.', image: img('simulator-picker', 'The Simulator page with a card for each dish and its ingredient cost per portion.', 'One card for each dish.') },
            { text: ['Click the card ', b('Classic Burger'), '.'], result: ['The page “Simulator: Classic Burger” opens.'] },
            {
              text: ['Look at ', b('Baseline'), '. It is your real data today.'],
              result: 'Five cards: menu price €13.08, ingredient cost €4.85, contribution €7.15, food cost 40.4%, and €2145.00 estimated per month.',
              image: img('simulator-baseline', 'The Baseline cards for Classic Burger and the field Expected sales per month (your estimate) showing 300.', 'Baseline, and below it your sales estimate.'),
            },
            {
              text: ['Look at the field ', b('Expected sales per month (your estimate)'), '. It already shows 300, the number saved with the dish. Change it if you wish.'],
              result: 'The same number is used in all scenarios, so the monthly figures are comparable.',
            },
          ],
        },
        {
          kind: 'steps',
          title: 'Scenario A: raise the menu price by 75 cents',
          steps: [
            { text: ['Click the button ', b('Add scenario'), '.'], result: ['A card “Scenario A” appears, and a ', b('Compare'), ' table appears above it.'] },
            {
              text: ['In the card, click the field ', b('Menu price (incl. VAT, €)'), ' and type 13.83.'],
              result: 'The grey 13.08 shows the current price. At the top of the card the contribution per portion becomes €7.84, with a green mark +€0.69.',
              image: img('simulator-scenario', 'The card Scenario A with menu price 13.83 and the result at the top: contribution per portion €7.84, +€0.69.', 'The result at the top of the card changes at once.'),
            },
          ],
        },
        {
          kind: 'steps',
          title: 'Scenario B: a smaller portion of mince (160 g instead of 180 g)',
          steps: [
            { text: ['Click ', b('Add scenario'), ' again.'], result: 'A second card, Scenario B, appears.' },
            { text: ['In Scenario B click the bar ', b('Quantities in the dish'), '.'], result: 'The bar opens and shows a field for every ingredient line of the dish. A line that is a prep cannot be changed here.' },
            {
              text: ['Find ', b('Beef mince 80/20'), ' and type 160 in ', b('New net quantity'), '. The unit stays g.'],
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
            { text: ['In Scenario C click the bar ', b('Ingredient prices'), '.'], result: 'The bar opens and lists the ingredients of the dish.' },
            {
              text: ['Find ', b('Beef mince 80/20'), '. Under its name you see the price now and the earlier price. In ', b('New pack price (€, excl. VAT)'), ' type 14.00.'],
              result: ['The line “That is €14.00/kg excl. VAT.” appears. The contribution becomes €7.69 (+€0.54). The real price on the Ingredients page stays €17.00.'],
              image: img('simulator-prices', 'The opened bar Ingredient prices with Beef mince 80/20: now €17.00 per 1 kg pack, before €14.00/kg, and the new pack price 14.00 typed in.', 'The real price is not changed: this only goes into the copy.'),
            },
          ],
        },
        {
          kind: 'steps',
          title: 'Read the comparison',
          steps: [
            { text: ['Scroll up to the table ', b('Compare'), '.'], result: ['It has four columns: Baseline (today) and Scenarios A, B and C. Each scenario shows the difference from Baseline under its number.'], image: img('simulator-compare', 'The Compare table with the columns Baseline, Scenario A, B and C and the differences from Baseline.', 'Green marks are good news, red marks are bad news.') },
            { text: ['Look at the row ', b('Contribution per portion'), '. The small marks show how much more or less is left from one portion, compared with Baseline.'] },
            { text: ['Look at the row ', b('Estimated monthly contribution'), '. The marks show the difference per month at your sales estimate: A +€206.42, B +€102.00, C +€162.00.'] },
            { text: 'Read the sentence above the table. It names the column with the highest estimated monthly contribution. That column also says “highest monthly”.', result: 'This is only a calculation from your numbers. It is not advice and not a forecast.' },
          ],
        },
        {
          kind: 'steps',
          title: 'Save a scenario and give it a name',
          steps: [
            { text: ['In the card, click the name at the top (it says Scenario A). Press the keys Ctrl and A together (on a Mac: ⌘ and A) to select the old name, then type a new name, for example “Price 13.83”.'], result: 'The column in the table gets the same name. This step is optional. Without selecting first, your text would be added after the old name.' },
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
          text: 'A saved scenario remembers the prices and recipe from the day you saved it. If a price changes later, the scenario would be compared with old numbers. The program warns you and lets you calculate again on today’s data.',
        },
        {
          kind: 'steps',
          title: 'See it yourself',
          steps: [
            { text: ['Save Scenario A as described above.'] },
            { text: ['Click ', b('Ingredients'), ', press ', b('New price'), ' in the row of Beef mince 80/20, type 18.50 and click ', b('Save price'), '.'] },
            { text: ['Click ', b('Simulator'), ', then the card ', b('Classic Burger'), '.'], result: ['The card of Scenario A shows a yellow note “Baseline changed since this scenario was saved”, and the table marks the column “older prices”.'], image: img('simulator-stale', 'The yellow note Baseline changed since this scenario was saved with the button Update baseline.', 'The yellow note appears inside the scenario card.') },
            { text: ['Click ', b('Update baseline'), '.'], result: 'The scenario is calculated again on today’s prices. Your changes stay where they still apply. Nothing is saved yet: press Save changes to keep it. To undo the demo price change, use Reset to demo data on the Data page.' },
          ],
        },
        { kind: 'h3', text: 'Messages in the Simulator' },
        {
          kind: 'messages',
          items: [
            { message: 'Baseline changed since this scenario was saved', meaning: ['Prices or the recipe changed after you saved it. Click ', b('Update baseline'), ' to calculate on today’s data.'] },
            { message: 'Baseline updated. Some changes no longer apply and were removed (save to keep this):', meaning: ['After the update, one of your changes did not fit any more (for example an ingredient was removed from the recipe). Click ', b('OK'), ', check the numbers and save if you agree.'] },
            { message: 'Not enough data to compare monthly results.', meaning: ['The table needs at least two columns with a monthly figure. Type a number in ', b('Expected sales per month (your estimate)'), ' and make sure no price is missing.'] },
            { message: 'Enter your estimate (0 if you do not want a monthly figure).', meaning: ['The dish has a monthly volume, so the field cannot be left empty. Type a number, or 0.'] },
          ],
        },
      ],
    },
    /* ----------------------------------------------------------------- 10 */
    {
      id: 'data',
      title: 'Your data and backups',
      blocks: [
        { kind: 'p', text: 'Everything you type is saved automatically, but only inside this browser on this computer. It is not on the internet, and nobody else can see it. The other side of this: if the browser data is cleared, or you open MenuPilot in another browser or on another computer, your data is not there. A backup copy protects you.' },
        { kind: 'image', image: img('data-backup', 'The cards Export backup and Import backup on the Data page.', 'Export backup makes a copy. Import backup puts a copy back.') },
        {
          kind: 'note',
          tone: 'important',
          title: 'How often to make a backup',
          text: ['Once a week, and after every big change: new prices, new recipes, a long session in the Simulator. It takes a few seconds.'],
        },
        {
          kind: 'steps',
          title: 'Make a backup copy (Export backup)',
          steps: [
            { text: ['Click ', b('Data'), ' in the menu.'], result: 'The Data page opens.' },
            { text: ['In the card ', b('Export backup'), ' click the green button ', b('Export backup'), '.'], result: ['Your browser saves a file named like menupilot-backup-2026-10-19.json, usually in the folder Downloads. The page says “Backup saved as … Keep it somewhere safe.”'] },
            { text: 'Find that file in your Downloads folder and copy it to a safe place: a USB stick, or send it to yourself by email.', result: 'Now you have a copy that survives even if the computer is lost.' },
          ],
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
            { text: ['Click ', b('Data'), ', then in the card ', b('Reset to demo data'), ' click the button ', b('Reset to demo data'), '.'], result: ['A window “Reset to demo data?” opens.'], image: img('data-reset-dialog', 'The window Reset to demo data? with a note about unsaved scenarios, and the buttons Cancel and Reset to demo data.', 'If you have unsaved scenarios, the yellow note counts them.') },
            { text: 'Read the window. Make a backup first if you want to keep your own data.' },
            { text: ['Click the red button ', b('Reset to demo data'), '. To change your mind, click ', b('Cancel'), '.'], result: ['The message “Demo data restored.” appears.'] },
          ],
        },
        {
          kind: 'p',
          text: ['To empty the program and begin with your own data, use ', b('Start with empty data'), ' on the same page. It is explained step by step in ', to('first-start', 'section 4'), '.'],
        },
        {
          kind: 'note',
          tone: 'safe',
          title: 'Mistakes here are harmless',
          text: 'Before anything is replaced, a window asks you to confirm, and Cancel changes nothing. A file that is not a MenuPilot backup is rejected, and your current data stays as it was.',
        },
      ],
    },
    /* ----------------------------------------------------------------- 11 */
    {
      id: 'troubleshooting',
      title: 'What to do if…',
      blocks: [
        { kind: 'p', text: 'Most problems have a simple answer. Find your situation below.' },
        { kind: 'h3', text: 'I typed a wrong number' },
        {
          kind: 'steps',
          title: 'How to correct it',
          steps: [
            { text: 'If the window is still open: click the field with the wrong number, select the number (click it three times, or press Ctrl and A together; on a Mac ⌘ and A) and type the right one.' },
            { text: ['If you do not want to save at all, click ', b('Cancel'), ' (in a recipe: ', b('Discard changes'), ').'], result: 'The window closes and nothing is saved.' },
            { text: ['If a wrong ingredient price was already saved: open ', b('New price'), ' for that ingredient and save the right price.'], result: 'The newest price counts. The wrong one stays in the History, which is harmless.' },
            { text: ['If a recipe was saved with a wrong number: click ', b('Recipes'), ', open the dish, correct the number and click ', b('Save changes'), '.'] },
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
            { message: 'Enter the pack size, for example 1 kg or 250 g.', meaning: ['The ', b('Pack size'), ' field is empty. Type the size from the invoice.'] },
            { message: 'Enter the pack price excl. VAT, for example 11.20.', meaning: ['The pack price is empty. Type the price from the invoice without VAT.'] },
            { message: 'Enter a non-negative amount with at most two decimal places.', meaning: 'A price must be a number with at most two digits after the point or comma, for example 11.20. Do not type the € sign or a thousands separator.' },
            { message: 'Enter a positive quantity with a decimal comma or point.', meaning: 'Type only digits and one point or comma, for example 150 or 0.5. No words or units in the field: the unit is chosen in the list next to it.' },
            { message: 'This ingredient is measured in g. Use g or kg.', meaning: 'You chose a unit of the wrong kind, for example litres for a product that is weighed. Choose a unit from the list.' },
            { message: 'Enter the menu price incl. VAT, for example 13.50.', meaning: 'The menu price of the dish is empty. Type the price your guest pays.' },
            { message: 'Enter a whole number of portions, 1 or more.', meaning: ['In ', b('Portions per batch'), ' type a whole number such as 1 or 4.'] },
            { message: 'Enter a whole number (0 or more), or leave this empty.', meaning: ['In ', b('Monthly volume (optional)'), ' type a whole number such as 300, or clear the field.'] },
            { message: 'Enter a yield from 0.01 to 100 percent, for example 100 or 85.5.', meaning: ['The ', b('Yield %'), ' field needs a number up to 100. Type 100 if nothing is lost.'] },
            { message: 'Choose an ingredient or a prep.', meaning: ['A line has no ingredient. Open the list ', b('Ingredient or prep'), ' and choose one, or click ', b('Remove'), ' for that line.'] },
            { message: 'Some fields need attention. They are marked above.', meaning: 'Scroll up. The fields with a problem have a red text under them. Correct them and press Save again.' },
            { message: "Cannot delete 'Beef mince 80/20': it is used by Classic Burger.", meaning: 'You cannot delete something that a recipe uses. See the end of section 5.' },
            { message: 'A prep cannot use itself.', meaning: 'A prep cannot contain itself. Choose another ingredient or prep for that line.' },
            { message: 'Browser storage is full, so the change was not saved. Export a backup and free some space.', meaning: ['The browser has no room left. Make a backup (', to('data', 'section 10'), ') and ask someone to free browser space.'] },
            { message: 'The imported file is not valid JSON.', meaning: 'The file you chose is not a MenuPilot backup. Choose the file whose name starts with menupilot-backup. Nothing was changed.' },
          ],
        },
        { kind: 'h3', text: 'My data disappeared' },
        {
          kind: 'steps',
          title: 'What to check',
          steps: [
            { text: 'Stay calm and do not click “Start with empty data” or “Reset to demo data”: they replace everything.' },
            { text: 'Check that you use the same browser (for example Chrome, not Edge), the same computer and the same web address as before, and not a private window. The data lives in one browser on one computer.', result: 'If it was a different browser, open the one you used before.' },
            { text: ['If you have a backup file: click ', b('Data'), ', then ', b('Import backup'), ' and choose it (', to('data', 'section 10'), ').'], result: 'Your data comes back as it was on the day of the backup.' },
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
            { text: 'Know that on a narrow screen the tables become cards: each dish or ingredient is a separate card with the same numbers. The menu goes to several lines.' },
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
