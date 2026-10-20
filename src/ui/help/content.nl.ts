import { b, sectionNumber, to, type HelpDocument, type HelpImage, type HelpImageId, type HelpSectionId } from './types';

const img = (id: HelpImageId, alt: string, caption?: string): HelpImage => (caption === undefined ? { id, alt } : { id, alt, caption });

/** “hoofdstuk 11”: het nummer komt uit de volgorde van de hoofdstukken en kan dus nooit afwijken. */
const sec = (id: HelpSectionId) => `hoofdstuk ${sectionNumber(id)}`;
const secLink = (id: HelpSectionId, capital = false) => to(id, capital ? `Hoofdstuk ${sectionNumber(id)}` : sec(id));

/**
 * De handleiding in het Nederlands. Namen van knoppen en velden staan precies zoals het Nederlandse scherm ze toont.
 * De schermafbeeldingen zijn van het Nederlandse scherm met de Nederlandse voorbeeldgegevens.
 */
export const contentNl: HelpDocument = {
  lang: 'nl',
  title: 'MenuPilot: handleiding stap voor stap',
  subtitle: 'Voor iedereen die nog nooit met zo’n programma heeft gewerkt. Neem de tijd: elke stap is één kleine handeling.',
  ui: {
    languageLabel: 'Taal van deze handleiding',
    print: 'Handleiding afdrukken',
    contents: 'Inhoud',
    toTop: 'Naar boven',
    stepsDone: 'Dit zie je',
    openLarger: 'Groter openen (in een nieuw tabblad)',
    backToContents: 'Terug naar de inhoud',
    messageHeader: 'Melding op het scherm',
    meaningHeader: 'Wat het betekent en wat je doet',
    contextLink: 'Hulp bij deze pagina',
  },
  sections: [
    /* ------------------------------------------------------------------ 1 */
    {
      id: 'how-to-use',
      title: 'Zo gebruik je deze handleiding',
      blocks: [
        { kind: 'p', text: 'Deze handleiding laat zien hoe je MenuPilot gebruikt, stap voor stap. Je hebt geen computerkennis nodig. Lees rustig: doe één stap en kijk dan naar het scherm.' },
        {
          kind: 'note',
          tone: 'safe',
          title: 'Rondkijken kan geen kwaad',
          text: ['Oefen met het verzonnen voorbeeldcafé. ', b('Annuleren'), ' sluit een venster zonder op te slaan wat je erin hebt getypt.'],
        },
        {
          kind: 'note',
          tone: 'important',
          title: 'Lezen en werken tegelijk',
          text: ['Een uitgeprinte handleiding is makkelijker te volgen terwijl je werkt. Lees je op het scherm, dan opent ', b('Hulp'), ' in het menu bovenaan deze handleiding opnieuw, en de link ', b('Hulp bij deze pagina'), ' onder de titel van elke pagina opent het bijpassende deel. Sla je recept op voordat je de pagina verlaat.'],
        },
        {
          kind: 'steps',
          title: 'Zo lees je de stappen',
          steps: [
            {
              text: ['Namen van knoppen en velden staan ', b('vet'), '. Ze staan er precies zoals op het scherm. Deze handleiding is voor het Nederlandse scherm. Staat je scherm in het Engels, kies dan bovenaan de Engelse handleiding.'],
            },
            {
              text: 'Elke stap is één handeling. Doe die en kijk dan naar het scherm. Onder de stap staat wat er te zien moet zijn. Ziet je scherm er anders uit, lees dan de vorige stap nog eens. De terugknop van je browser heb je niet nodig.',
            },
            {
              text: ['Wil je naar een deel van deze handleiding springen, klik dan op de naam in de lijst ', b('Inhoud'), ' hieronder.'],
              result: ['De pagina schuift naar dat deel. Aan het eind van elk hoofdstuk brengt de link ', b('Terug naar de inhoud'), ' je terug. Op een computer doet de knop ', b('Naar boven'), ' (rechtsonder) hetzelfde.'],
            },
            {
              text: ['De taal van deze handleiding wijzig je met ', b('English'), ', ', b('Nederlands'), ' of ', b('Русский'), ' bovenaan deze pagina.'],
              result: 'De hele handleiding wisselt van taal. Het programma onthoudt je keuze. Heb je niets gekozen, dan volgt de handleiding de taal van het scherm.',
              image: img('help-toolbar', 'De bovenkant van de handleiding: de knoppen English, Nederlands en Русский en de knop Handleiding afdrukken.', 'De taalknoppen en de printknop staan bovenaan deze pagina.'),
            },
            {
              text: ['Wil je de handleiding op papier, druk dan op ', b('Handleiding afdrukken'), '.'],
              result: 'Het afdrukvenster van je computer opent. De uitdraai is altijd licht, heeft grote letters en geen menu.',
            },
            {
              text: 'Wil je alles op het scherm groter maken, houd dan de Ctrl-toets ingedrukt en druk op de plustoets (op een Mac: de ⌘-toets en plus). Weer kleiner: houd Ctrl ingedrukt en druk op min. Op een Mac houd je ⌘ ingedrukt.',
              result: 'Tekst en knoppen worden groter. Maak ze zo groot dat je ze makkelijk leest.',
            },
          ],
        },
      ],
    },
    /* ------------------------------------------------------------------ 2 */
    {
      id: 'about',
      title: 'Wat MenuPilot is en waarvoor het dient',
      blocks: [
        { kind: 'p', text: 'MenuPilot is een klein programma voor de eigenaar van een café of restaurant. Je vult in wat je inkoopt, wat er in elk gerecht zit en voor hoeveel je het verkoopt. Het programma laat dan zien wat elk gerecht kost om te maken en wat er van de prijs overblijft.' },
        {
          kind: 'p',
          text: ['Een voorbeeld. Je leverancier verhoogt de prijs van rundergehakt. Je Klassieke burger bevat 180 g daarvan. Een maand geleden kostten de ingrediënten van één burger ', b('€ 4,20'), '. Nu kosten ze ', b('€ 4,85'), '. Dat is 65 cent meer per burger. Verkoop je 300 burgers per maand, dan houd je elke maand ', b('€ 195,00'), ' minder over.'],
        },
        { kind: 'p', text: 'MenuPilot rekent dat in een paar seconden voor je uit. Je kunt ook antwoorden uitproberen: de prijs 75 cent verhogen, een iets kleinere portie serveren, of hopen dat de leverancier terugkeert naar de oude prijs. Je ziet het resultaat voordat je iets besluit.' },
        { kind: 'image', image: img('dashboard-table', 'De tabel Gerechten op het Overzicht: de rij Klassieke burger toont de kosten een maand geleden en nu, het verschil in euro en het maandeffect.', 'Het Overzicht toont per gerecht wat er veranderd is. De rij Klassieke burger: € 4,20 toen, € 4,85 nu en −€ 195,00 per maand.') },
        {
          kind: 'list',
          items: [
            [b('Overzicht'), ': welke gerechten duurder zijn geworden en wat dat je per maand kost.'],
            [b('Simulator'), ': een veilige plek om “wat als” uit te proberen zonder je echte gegevens te wijzigen.'],
            [b('Recepten'), ': je gerechten en je basisrecepten (sauzen en andere dingen die je in een grotere hoeveelheid maakt).'],
            [b('Ingrediënten'), ': wat je inkoopt en wat het kost. Elke nieuwe prijs wordt met de datum bewaard.'],
            [b('Gegevens'), ': kopieën van je gegevens (reservekopieën).'],
          ],
        },
        {
          kind: 'note',
          tone: 'safe',
          title: 'Er zit al een voorbeeldcafé in',
          text: ['De eerste keer dat je MenuPilot opent, zie je een verzonnen burgercafé. Niets daarin is echt, dus probeer alles gerust uit. Hoe je overstapt op je eigen gegevens staat in ', secLink('data'), '.'],
        },
        {
          kind: 'note',
          tone: 'important',
          title: 'Waar je gegevens staan',
          text: ['Een browser is het programma waarmee je MenuPilot opent, zoals Chrome, Safari of Edge. Je opgeslagen gegevens blijven alleen in die browser op deze computer. Ze worden nergens naartoe gestuurd en er is geen account. ', secLink('data', true), ' legt uit hoe je een reservekopie maakt.'],
        },
      ],
    },
    /* ------------------------------------------------------------------ 3 */
    {
      id: 'glossary',
      title: 'Woorden in gewone taal',
      blocks: [
        { kind: 'p', text: 'Deze woorden kom je op het scherm tegen. Bij elk woord staat een voorbeeld uit het dagelijks leven.' },
        {
          kind: 'terms',
          items: [
            { term: 'Ingrediënt', meaning: 'Alles wat je voor de keuken inkoopt: vlees, broodjes, olie, wijn.', example: 'Rundergehakt 80/20 is een ingrediënt.' },
            {
              term: 'Verpakking',
              meaning: 'Zo verkoopt de leverancier een ingrediënt: één verpakking heeft een grootte en een prijs. Je typt beide zoals ze op de factuur staan. MenuPilot rekent zelf de prijs per kilo, liter of stuk uit.',
              example: 'Een verpakking van 1 kg gehakt voor € 17,00 is € 17,00 per kg. Een verpakking van 12 broodjes voor € 10,56 is € 0,88 per broodje.',
            },
            {
              term: 'Prijs excl. btw / incl. btw',
              meaning: 'Btw (belasting toegevoegde waarde) is belasting die bij prijzen komt. “Excl. btw” is zonder die belasting, “incl. btw” is met belasting. De prijzen van de factuur van je leverancier vul je in zonder btw. De prijs op je menukaart, die de gast betaalt, is met btw. MenuPilot rekent altijd met de prijs zonder btw.',
              example: 'Een burger kost op de kaart € 13,08 incl. btw. Bij 9% btw is dat € 12,00 excl. btw.',
            },
            {
              term: 'Ingrediëntkosten volgens recept',
              meaning: 'Wat de ingrediënten van één portie volgens je recept horen te kosten. Het is berekend uit het recept, niet gemeten in de keuken: weggegooid eten of een extra grote portie telt niet mee.',
              example: 'De ingrediënten van één Klassieke burger kosten € 4,85.',
            },
            {
              term: 'Bijdrage vóór overige kosten',
              meaning: 'De prijs zonder btw min de kosten van de ingrediënten. Dat blijft van één portie over om al het andere van te betalen: personeel, huur, stroom. Het is GEEN winst, want die overige kosten moeten nog betaald worden.',
              example: '€ 12,00 − € 4,85 = € 7,15 bijdrage per burger.',
            },
            {
              term: 'Foodcostpercentage',
              meaning: 'Hoeveel van de prijs (zonder btw) naar ingrediënten gaat. Een hoger percentage betekent dat er minder voor jou overblijft.',
              example: '€ 4,85 van € 12,00 is 40,4%.',
            },
            {
              term: 'pp (procentpunt)',
              meaning: 'De eenheid voor een verandering van een percentage. Gaat het foodcostpercentage van 35,0% naar 40,4%, dan is dat +5,4 pp.',
              example: 'Onder “Verschil (€)” in de tabel van het Overzicht zie je bijvoorbeeld +5,4 pp.',
            },
            {
              term: 'Nettohoeveelheid',
              meaning: 'De bruikbare hoeveelheid van een ingrediënt voor de hele bereiding, na het verlies dat je hebt ingevuld. Voor vier porties vul je de totale hoeveelheid voor alle vier in.',
              example: '180 g gehakt voor één burger; 720 g voor een bereiding van vier.',
            },
            {
              term: 'Rendement %',
              meaning: 'Hoeveel van wat je inkoopt echt bruikbaar is. 100 betekent dat er niets verloren gaat. 80 betekent dat een vijfde verloren gaat, bijvoorbeeld schillen of afgesneden vet.',
              example: 'Voor 300 g friet heb je aardappelen met 20% schil nodig: rendement 80. MenuPilot rekent dan met 375 g aardappelen.',
            },
            {
              term: 'Basisrecept',
              meaning: 'Iets wat je in een grotere hoeveelheid maakt en daarna in meerdere gerechten gebruikt: een saus, deeg, bouillon. MenuPilot rekent de kosten per kilo uit en de gerechten gebruiken die.',
              example: 'De burgersaus zit in de Klassieke burger en in de Friet.',
            },
            { term: 'Gerecht', meaning: 'Iets op je menukaart wat een gast bestelt. Een gerecht heeft een menukaartprijs.', example: 'Klassieke burger, Tomatensoep.' },
            {
              term: 'Scenario',
              meaning: 'Een “wat als”-kopie van één gerecht in de Simulator. Je verandert iets in de kopie en ziet het resultaat. Het echte gerecht en de echte prijzen veranderen nooit.',
              example: '“Wat als ik de prijs van de burger 75 cent verhoog?”',
            },
            { term: 'Huidige situatie', meaning: 'Je echte gegevens van vandaag: het recept en de prijzen waarmee elk scenario wordt vergeleken. Een opgeslagen scenario kan nog een oudere basis gebruiken.', example: 'In de Simulator toont de kolom Huidige situatie je echte gerecht van vandaag.' },
            {
              term: 'Verkocht per maand (je schatting)',
              meaning: 'Hoeveel porties van een gerecht je denkt per maand te verkopen. Dit is je eigen schatting, geen voorspelling van het programma. Het rekent het verschil per portie om naar euro’s per maand. Je mag het leeg laten.',
              example: '300 burgers per maand.',
            },
            {
              term: 'Maandeffect bij jouw aantallen',
              meaning: 'Op het Overzicht: hoeveel er per maand meer of minder van de prijs overblijft doordat inkoopprijzen veranderden. Het is berekend met je eigen schatting van de verkoop.',
              example: '−€ 195,00 betekent dat er per maand € 195,00 minder overblijft.',
            },
            {
              term: 'kosten onbekend',
              meaning: 'MenuPilot toont dit als er een prijs ontbreekt en de kosten dus niet te berekenen zijn. Voor iets onbekends toont het nooit nul.',
              example: 'Je hebt een ingrediënt toegevoegd, maar de prijs nog niet.',
            },
            {
              term: 'Browser',
              meaning: 'Het programma waarmee je websites en MenuPilot opent, bijvoorbeeld Chrome, Safari of Edge. MenuPilot bewaart je gegevens daarin, alleen op deze computer.',
              example: 'Open je MenuPilot in Safari nadat je Chrome gebruikte, dan zie je geen gegevens: elke browser bewaart zijn eigen gegevens.',
            },
            {
              term: 'Reservekopie',
              meaning: 'Een bestand met een kopie van al je gegevens. Raakt er iets kwijt, dan zet je de gegevens uit dit bestand terug.',
              example: 'Zoals een fotokopie van je receptenboek die je in een la bewaart.',
            },
          ],
        },
      ],
    },
    /* ------------------------------------------------------------------ 4 */
    {
      id: 'first-start',
      title: 'Eerste keer: het voorbeeldcafé',
      blocks: [
        { kind: 'p', text: ['Als je MenuPilot voor het eerst opent, zit er al een verzonnen burgercafé in: 12 ingrediënten, 5 gerechten en 2 basisrecepten. Leer ermee werken. Heb je geoefend, dan kun je het programma leegmaken en je eigen gegevens invullen (', secLink('data'), ').'] },
        {
          kind: 'note',
          tone: 'safe',
          title: 'Je kunt het voorbeeld niet verpesten',
          text: ['Wat je ook verandert in het voorbeeld, je kunt altijd terug: ', b('Terugzetten naar voorbeeldgegevens'), ' op de pagina Gegevens zet het originele voorbeeld terug. Ook je eigen recepten en scenario’s verdwijnen dan.'],
        },
        {
          kind: 'steps',
          title: 'Kijk rond in het voorbeeldcafé',
          steps: [
            {
              text: ['Kijk naar de bovenkant van het scherm. Daar zie je het menu: ', b('Overzicht'), ', ', b('Simulator'), ', ', b('Recepten'), ' en ', b('Ingrediënten'), ' links, ', b('Gegevens'), ' en ', b('Hulp'), ' verderop naar rechts.'],
              result: 'De naam van de pagina waarop je bent, is onderstreept. Op een telefoon zit het menu achter de knop Menu: druk erop om de lijst te openen.',
              image: img('menu', 'Het hoofdmenu bovenaan het scherm: Overzicht, Simulator, Recepten, Ingrediënten en verderop Gegevens en Hulp.', 'Het menu bovenaan elke pagina.'),
            },
            { text: ['Klik op ', b('Ingrediënten'), '.'], result: 'Een lijst met 12 ingrediënten en hun prijzen opent.' },
            { text: ['Klik op ', b('Recepten'), '.'], result: 'Je ziet de kaarten Gerechten (vijf gerechten) en Basisrecepten (twee basisrecepten), elk met de kosten.' },
            { text: ['Klik op ', b('Overzicht'), '.'], result: ['Je ziet welke gerechten duurder zijn geworden. ', secLink('dashboard', true), ' legt deze pagina uit.'] },
          ],
        },
        {
          kind: 'note',
          tone: 'important',
          title: 'Eerst oefenen?',
          text: ['Houd het voorbeeldcafé en ga verder met ', secLink('appearance'), ' of ', secLink('ingredients'), '. De volgende voorbeelden gebruiken de ingrediënten ervan. Maak het programma pas leeg als je hebt geoefend: ', secLink('data'), ' laat zien hoe.'],
        },
      ],
    },
    /* ------------------------------------------------------------------ 5 */
    {
      id: 'appearance',
      title: 'Kleuren (thema) en taal van het scherm',
      blocks: [
        { kind: 'p', text: 'Bovenaan elke pagina vind je Thema en de taalknoppen EN en NL. Met Thema kies je de kleuren van het scherm, met de knoppen de taal. Geen van beide verandert je gegevens.' },
        { kind: 'image', image: img('theme-language', 'Rechtsboven in het scherm: de lijst Thema met de keuze Licht en de taalknoppen EN en NL.', 'De lijst Thema en de taalknoppen EN | NL.') },
        {
          kind: 'steps',
          title: 'De kleuren van het scherm wijzigen',
          steps: [
            { text: ['Zoek bovenaan de pagina de lijst ', b('Thema'), ' en klik erop.'], result: 'Er opent een lijst met drie keuzes: Systeem, Licht en Donker.' },
            { text: ['Klik op ', b('Licht'), ' voor een helder scherm of op ', b('Donker'), ' voor een donker scherm.'], result: 'De kleuren veranderen meteen. Het programma onthoudt je keuze in deze browser.' },
          ],
        },
        {
          kind: 'list',
          items: [
            [b('Licht'), ': een helder scherm. Het beste overdag en het makkelijkst te lezen in een lichte keuken.'],
            [b('Donker'), ': een donker scherm. Rustiger voor de ogen in de avond.'],
            [b('Systeem'), ': MenuPilot volgt de lichte of donkere instelling van je computer of telefoon. Verandert die instelling, dan verandert MenuPilot mee. Dit staat ingesteld totdat je kiest.'],
          ],
        },
        {
          kind: 'note',
          tone: 'safe',
          title: 'Afdrukken is altijd licht',
          text: 'Ook als het scherm donker is, drukken deze handleiding en het Overzicht licht af, op wit papier, zodat er op papier niets verloren gaat.',
        },
        {
          kind: 'steps',
          title: 'De taal van het scherm wijzigen',
          steps: [
            { text: ['Klik bovenaan de pagina op ', b('NL'), ' voor Nederlands of op ', b('EN'), ' voor Engels.'], result: 'Alle teksten en knoppen van het programma wisselen meteen van taal. De gekozen taal is onderstreept en wordt onthouden in deze browser.' },
          ],
        },
        {
          kind: 'note',
          tone: 'important',
          title: 'Opgeslagen namen worden niet vertaald',
          text: ['De taal verandert alleen de eigen woorden van het programma. Namen die je zelf hebt getypt (ingrediënten, gerechten, scenario’s) blijven zoals je ze schreef. Het voorbeeldcafé wordt de eerste keer geladen in de taal van het scherm. ', b('Terugzetten naar voorbeeldgegevens'), ' laadt het voorbeeld in de taal die op dat moment op het scherm staat en vervangt je gegevens. Ook namen uit eerder geladen voorbeeldgegevens blijven in hun oorspronkelijke taal. Beef mince 80/20 verandert dus niet vanzelf in Rundergehakt 80/20. Deze Nederlandse handleiding gebruikt Nederlandse voorbeeldnamen.'],
        },
        {
          kind: 'note',
          tone: 'safe',
          title: 'Deze handleiding heeft eigen taalknoppen',
          text: ['Bovenaan deze handleiding kies je English, Nederlands of Русский. Zonder keuze volgt de handleiding de taal van het scherm. De Russische handleiding gebruikt Engelse schermnamen en schermafbeeldingen.'],
        },
      ],
    },
    /* ------------------------------------------------------------------ 6 */
    {
      id: 'ingredients',
      title: 'Ingrediënten en hun prijzen',
      blocks: [
        { kind: 'p', text: 'Alles begint met ingrediënten: wat je inkoopt en de prijs op de factuur van de leverancier. MenuPilot bewaart elke prijs die je invult, met de datum. De nieuwste prijs wordt in berekeningen gebruikt. De oudere blijven in de geschiedenis staan, en het Overzicht heeft ze nodig om te laten zien wat er veranderd is.' },
        { kind: 'image', image: img('ingredients-list', 'De pagina Ingrediënten: de tabel Huidige inkoopprijzen met de knoppen Nieuwe prijs, Prijsgeschiedenis, Hernoemen en Verwijderen aan het eind van elke rij.', 'Elke rij heeft rechts vier knoppen. De knop Ingrediënt toevoegen staat rechtsboven op de pagina.') },
        {
          kind: 'steps',
          title: 'Een nieuw ingrediënt toevoegen (voorbeeld: olijfolie, een can van 5 liter voor € 24,00)',
          steps: [
            { text: ['Klik in het menu op ', b('Ingrediënten'), '.'], result: 'De lijst met je ingrediënten opent.' },
            { text: ['Klik bovenaan de pagina op ', b('Ingrediënt toevoegen'), '.'], result: 'Een venster “Ingrediënt toevoegen” opent.' },
            { text: ['Klik in het veld ', b('Naam'), ' en typ de naam: Olijfolie.'] },
            {
              text: ['Open de lijst ', b('Eenheid'), ' (rechts van de verpakkingsgrootte). Kies ', b('l'), ' voor liters.'],
              result: ['De titel van het veld voor de grootte verandert in ', b('Verpakking (l)'), '.'],
            },
            { text: ['Typ in ', b('Verpakking (l)'), ' de grootte van één verpakking zoals die op de factuur staat: 5.'] },
            {
              text: ['Typ in ', b('Verpakkingsprijs (excl. btw)'), ' de prijs van de factuur, zonder btw: 24,00. Je mag een komma of een punt gebruiken.'],
              result: ['Onder de velden toont het programma “Dat is € 4,80/l excl. btw.” Dat is de prijs per liter.'],
              image: img('ingredient-add', 'Het venster Ingrediënt toevoegen ingevuld: Olijfolie, verpakking 5 l, verpakkingsprijs 24,00 en de regel Dat is € 4,80/l excl. btw.', 'Het venster met Olijfolie ingevuld.'),
            },
            { text: ['Klik in het venster op de knop ', b('Ingrediënt toevoegen'), '.'], result: 'Het venster sluit en Olijfolie staat onderaan de lijst.' },
          ],
        },
        {
          kind: 'note',
          tone: 'safe',
          title: 'Wat de eenheden betekenen',
          text: [b('g'), ' gram, ', b('kg'), ' kilogram, ', b('ml'), ' milliliter, ', b('l'), ' liter, ', b('st.'), ' stuks. Gebruik de eenheid die op de factuur staat voor één verpakking.'],
        },
        { kind: 'note', tone: 'safe', title: 'Als je je vergist', text: ['Druk op ', b('Annuleren'), ' (of op de toets Esc op je toetsenbord). Het venster sluit en er wordt niets opgeslagen.'] },
        {
          kind: 'note',
          tone: 'important',
          title: 'Weet je de prijs nog niet?',
          text: ['Vul de naam in en kies bij ', b('Eenheid'), ' hoe je het ingrediënt inkoopt: bijvoorbeeld kg, l of st. Laat de verpakkingsgrootte en de prijs leeg. Voeg de prijs later toe met ', b('Nieuwe prijs'), '. Tot die tijd tonen gerechten met dit ingrediënt “kosten onbekend”. Dat is eerlijk: het programma raadt niet.'],
        },
        {
          kind: 'steps',
          title: 'De leverancier verhoogde een prijs (voorbeeld: rundergehakt van € 17,00 naar € 18,50 per kg)',
          steps: [
            { text: ['Klik op ', b('Ingrediënten'), '.'], result: 'De lijst opent.' },
            { text: ['Zoek de rij ', b('Rundergehakt 80/20'), '. Klik aan het eind van de rij op de knop ', b('Nieuwe prijs'), '.'], result: ['Een venster “Nieuwe prijs: Rundergehakt 80/20” opent. Er staat “Nu: € 17,00 excl. btw voor 1 kg. De oude prijs blijft in de prijsgeschiedenis.”'] },
            { text: ['Kijk naar ', b('Verpakking (kg)'), '. Daar staat al 1, de laatste verpakkingsgrootte. Wijzig die alleen als de verpakking nu anders is.'] },
            {
              text: ['Klik in ', b('Verpakkingsprijs (excl. btw)'), ' en typ de nieuwe prijs van de factuur, zonder btw: 18,50.'],
              result: ['Onder de velden zie je “Dat is € 18,50/kg excl. btw.”, de nieuwe prijs per kilo.'],
              image: img('ingredient-price', 'Het venster Nieuwe prijs: Rundergehakt 80/20, met de nieuwe verpakkingsprijs 18,50 getypt en de regel Dat is € 18,50/kg excl. btw.', 'Je hoeft alleen de prijs te typen; de verpakkingsgrootte staat er al.'),
            },
            { text: ['Klik op ', b('Prijs opslaan'), '.'], result: 'Het venster sluit. In de rij staat nu € 18,50 en de datum in de kolom Laatste prijs is die van vandaag.' },
          ],
        },
        {
          kind: 'note',
          tone: 'important',
          title: 'Dit wijzigt echte gegevens',
          text: ['Ook in het voorbeeldcafé: de burger wordt duurder op het Overzicht. Je hebt de oefenprijs van € 18,50 opgeslagen, dus latere cijfers wijken af van de afbeeldingen. Wil je de volgende voorbeelden volgen, voeg dan nog een prijs toe voor dit ingrediënt: ', b('Nieuwe prijs'), ' met € 17,00 excl. btw voor 1 kg. Of gebruik ', b('Terugzetten naar voorbeeldgegevens'), ' (', secLink('data'), ').'],
        },
        {
          kind: 'steps',
          title: 'De prijsgeschiedenis van een ingrediënt bekijken',
          steps: [
            { text: ['Klik in de rij van het ingrediënt op ', b('Prijsgeschiedenis'), '.'], result: ['Een venster “Prijsgeschiedenis van Rundergehakt 80/20” opent. De nieuwste prijs staat bovenaan en heeft het label “huidig”. De oudere prijzen staan eronder, elk met een datum.'], image: img('ingredient-history', 'Het venster Prijsgeschiedenis van Rundergehakt 80/20 met de prijzen: de huidige bovenaan en oudere eronder.', 'De nieuwste prijs staat bovenaan.') },
            { text: ['Klik op ', b('Sluiten'), '.'], result: 'Het venster sluit. Er is niets gewijzigd.' },
          ],
        },
        { kind: 'p', text: 'Een nieuwe prijs toevoegen laat de eerdere regels in de geschiedenis staan. Verwijder je het ingrediënt, dan verdwijnt ook de prijsgeschiedenis. Het Overzicht gebruikt de oude prijzen om te zeggen wat een gerecht een maand geleden kostte.' },
        {
          kind: 'steps',
          title: 'Een ingrediënt hernoemen',
          steps: [
            { text: ['Klik in de rij van het ingrediënt op ', b('Hernoemen'), '.'], result: ['Een klein venster “Hernoemen” opent met het veld ', b('Naam'), '.'], image: img('ingredient-rename', 'Het venster Hernoemen met het veld Naam en de knoppen Annuleren en Hernoemen.', 'Recepten die het ingrediënt gebruiken blijven werken onder de nieuwe naam.') },
            { text: ['Klik in het veld ', b('Naam'), ', wijzig de naam en klik op de knop ', b('Hernoemen'), '.'], result: 'Het venster sluit en de nieuwe naam staat in de lijst en in alle recepten.' },
          ],
        },
        {
          kind: 'steps',
          title: 'Een ingrediënt verwijderen (voorbeeld: haal de Olijfolie weg die je toevoegde)',
          steps: [
            { text: ['Klik in de rij van Olijfolie op ', b('Verwijderen'), '.'], result: ['Een venster “Olijfolie verwijderen?” opent. Er staat dat dit niet ongedaan gemaakt kan worden.'], image: img('ingredient-delete', 'Het venster Olijfolie verwijderen? met de knoppen Annuleren en Ingrediënt verwijderen.', 'Annuleren laat het ingrediënt staan.') },
            { text: ['Klik op de rode knop ', b('Ingrediënt verwijderen'), '. Wil je het ingrediënt houden, klik dan op ', b('Annuleren'), '.'], result: 'Het ingrediënt en de prijsgeschiedenis verdwijnen uit de lijst.' },
          ],
        },
        { kind: 'h3', text: 'Waarom een ingrediënt soms niet te verwijderen is' },
        {
          kind: 'p',
          text: 'Een ingrediënt dat in een recept zit, kun je niet verwijderen, want het recept zou een onderdeel kwijtraken. Klik je op Ingrediënt verwijderen, dan verschijnt in het venster een rode melding die de recepten noemt waarin het zit. Open ze stuk voor stuk, haal de regel met dit ingrediënt weg (knop Verwijderen), druk op Wijzigingen opslaan en verwijder daarna het ingrediënt.',
        },
        { kind: 'image', image: img('ingredient-in-use', 'Het venster Rundergehakt 80/20 verwijderen? met een rode melding dat het ingrediënt nog in recepten wordt gebruikt en een link naar Klassieke burger.', 'De rode melding noemt het recept. De link eronder opent dat recept.') },
      ],
    },
    /* ------------------------------------------------------------------ 7 */
    {
      id: 'preps',
      title: 'Basisrecepten: sauzen en andere bereidingen',
      blocks: [
        { kind: 'p', text: 'Een basisrecept is iets wat je in een grotere hoeveelheid maakt en daarna in meerdere gerechten gebruikt, bijvoorbeeld een saus, deeg of bouillon. Je vult het basisrecept één keer in, met de ingrediënten. MenuPilot rekent uit wat een kilo kost en de gerechten gebruiken die prijs.' },
        {
          kind: 'note',
          tone: 'safe',
          title: 'Waarom dit handig is',
          text: 'Verandert de prijs van een ingrediënt in de saus, dan worden alle gerechten met die saus vanzelf bijgewerkt. Gebruikt maar één gerecht een saus, dan kun je de ingrediënten ook direct in dat gerecht zetten. Dan heb je geen basisrecept nodig.',
        },
        {
          kind: 'note',
          tone: 'important',
          title: 'Er wordt niets opgeslagen voordat je op Opslaan drukt',
          text: ['Je invoer is nog niet opgeslagen. Klik als je klaar bent op ', b('Basisrecept opslaan'), '. De kaart Kostenoverzicht verandert terwijl je typt, maar verlaat je de pagina vóór het opslaan, dan ben je kwijt wat je typte.'],
        },
        {
          kind: 'steps',
          title: 'Een basisrecept maken (voorbeeld: Mosterdmayonaise, 900 g mayonaise en 100 g mosterd maken samen 1 kg)',
          steps: [
            { text: ['Klik in het menu op ', b('Recepten'), '.'], result: 'Je ziet de kaarten Gerechten en Basisrecepten.' },
            { text: ['Klik in de kaart ', b('Basisrecepten'), ' op de knop ', b('Nieuw basisrecept'), '.'], result: ['Een pagina “Nieuw basisrecept” opent.'] },
            { text: ['Klik in het veld ', b('Naam'), ' en typ: Mosterdmayonaise.'] },
            { text: ['Open de lijst ', b('Eenheid van de bereiding'), ' (rechts van het veld voor de hoeveelheid) en kies ', b('kg'), '.'], result: ['De titel van het veld voor de hoeveelheid verandert in ', b('Opbrengst van één bereiding (kg)'), '.'] },
            {
              text: ['Typ in ', b('Opbrengst van één bereiding (kg)'), ' hoeveel de hele bereiding oplevert: 1.'],
              result: 'De bereiding is alles wat je in één keer maakt. Hier is dat één kilo.',
              image: img('prep-form', 'De bovenkant van de pagina Nieuw basisrecept: Naam Mosterdmayonaise, Opbrengst van één bereiding 1 kg met Eenheid van de bereiding kg.', 'De eerste kaart van een nieuw basisrecept.'),
            },
            { text: ['Open in de eerste regel de lijst ', b('Ingrediënt of basisrecept'), ' en kies ', b('Mayonaise · g'), '.'], result: ['De titel van het veld voor de hoeveelheid zegt ', b('Nettohoeveelheid (g)'), '.'] },
            {
              text: ['Typ in ', b('Nettohoeveelheid (g)'), ' 900. Laat ', b('Rendement %'), ' op 100 staan.'],
              result: ['Aan het eind van de regel toont ', b('Kosten van de regel (excl. btw)'), ' € 3,96.'],
            },
            { text: ['Klik op ', b('Regel toevoegen'), '.'], result: 'Er verschijnt een tweede, lege regel.' },
            { text: ['Kies in de nieuwe regel ', b('Dijonmosterd · g'), '.'] },
            { text: ['Typ in ', b('Nettohoeveelheid (g)'), ' van de nieuwe regel 100.'], result: ['De kosten van de regel zijn € 0,50.'], image: img('prep-lines', 'De kaart Ingrediënten en basisrecepten met twee regels: Mayonaise 900 g en Dijonmosterd 100 g, met de kosten per regel.', 'Twee regels vormen één bereiding.') },
            { text: ['Kijk onderaan naar de kaart ', b('Kostenoverzicht'), '.'], result: ['Daar staan ', b('Kosten van de bereiding, alle porties (excl. btw)'), ' € 4,46, ', b('Opbrengst van één bereiding'), ' 1 kg en ', b('Kosten per kg, l of st (excl. btw)'), ' € 4,46/kg. Het verandert terwijl je typt.'], image: img('prep-cost', 'De kaart Kostenoverzicht met Kosten van de bereiding € 4,46, Opbrengst van één bereiding 1 kg en Kosten per kg, l of st € 4,46/kg.', 'De kosten van de hele bereiding en van één kilo.') },
            { text: ['Klik onderaan de pagina op ', b('Basisrecept opslaan'), '.'], result: ['Het basisrecept is opgeslagen. De pagina heeft nu de naam van het basisrecept als titel en de knoppen onderaan worden ', b('Wijzigingen opslaan'), ', ', b('Wijzigingen ongedaan maken'), ' en ', b('Basisrecept verwijderen'), '.'] },
            { text: ['Klik bovenaan de pagina op ', b('← Alle recepten'), '.'], result: 'Mosterdmayonaise staat in de kaart Basisrecepten met de kosten, € 4,46/kg.' },
          ],
        },
        { kind: 'p', text: ['Een basisrecept mag andere basisrecepten gebruiken, maar niet zichzelf en niet in een kring. Het programma weigert dat met een duidelijke melding en staat maximaal 5 niveaus toe. Wil je een basisrecept wijzigen of verwijderen, klik dan op de pagina Recepten op de naam. Een basisrecept dat een gerecht gebruikt, kun je pas verwijderen als je het uit dat gerecht haalt. Hoe je een basisrecept in een gerecht gebruikt, staat in ', secLink('dishes'), '.'] },
      ],
    },
    /* ------------------------------------------------------------------ 8 */
    {
      id: 'dishes',
      title: 'Gerechten: recept, prijs en kosten',
      blocks: [
        { kind: 'p', text: 'Een gerecht is iets wat een gast bestelt. Voor elk gerecht vul je de menukaartprijs, het btw-tarief en de regels in: wat erin zit en hoeveel. MenuPilot laat dan zien wat het gerecht kost en wat er van de prijs overblijft.' },
        {
          kind: 'note',
          tone: 'important',
          title: 'Opslaan voordat je weggaat',
          text: ['Je invoer is nog niet opgeslagen. Klik als je klaar bent op ', b('Gerecht opslaan'), '. Verlaat je de pagina vóór het opslaan, dan ben je kwijt wat je typte.'],
        },
        {
          kind: 'steps',
          title: 'Een gerecht maken (voorbeeld: Kipbroodje voor € 9,80, met de Mosterdmayonaise uit het vorige hoofdstuk)',
          steps: [
            { text: ['Klik in het menu op ', b('Recepten'), '.'], result: 'De kaarten Gerechten en Basisrecepten openen.' },
            { text: ['Klik in de kaart ', b('Gerechten'), ' op ', b('Nieuw gerecht'), '.'], result: ['Een pagina “Nieuw gerecht” opent. De eerste, lege regel staat er al.'] },
            { text: ['Klik in het veld ', b('Naam'), ' en typ: Kipbroodje.'] },
            { text: ['Typ in ', b('Menukaartprijs (incl. btw)'), ' de prijs die je gast betaalt, mét btw: 9,80.'] },
            {
              text: ['Kijk naar ', b('Btw-tarief'), '. Laat het op 9% (eten) staan. Kies voor alcohol 21%. In de lijst staat ook 0%.'],
            },
            { text: ['Laat ', b('Porties per bereiding'), ' op 1 staan. Dit getal zegt hoeveel porties de regels hieronder opleveren. Leveren de regels vier porties op, typ dan 4.'] },
            {
              text: ['Typ in ', b('Verkocht per maand (optioneel)'), ' hoeveel je er denkt te verkopen per maand: 100. Dit is je eigen schatting. Je mag het leeg laten.'],
              image: img('dish-form', 'De bovenkant van de pagina Nieuw gerecht: Kipbroodje, menukaartprijs 9,80, btw-tarief 9%, porties per bereiding 1, verkocht per maand 100.', 'De eerste kaart van een gerecht.'),
            },
            { text: ['Open in de eerste regel de lijst ', b('Ingrediënt of basisrecept'), ' en kies ', b('Kipfilet · g'), '.'] },
            {
              text: ['Typ in ', b('Nettohoeveelheid (g)'), ' 120. Laat ', b('Rendement %'), ' op 100 staan.'],
              result: ['De kosten van de regel zijn € 1,06.'],
            },
            { text: ['Klik op ', b('Regel toevoegen'), '.'], result: 'Er verschijnt een tweede, lege regel.' },
            { text: ['Open in de nieuwe regel de lijst ', b('Ingrediënt of basisrecept'), ' en kies ', b('Briocheburgerbroodje · st.'), '.'] },
            { text: ['Typ 1 in ', b('Nettohoeveelheid (st.)'), '.'], result: ['De kosten van de regel zijn € 0,88.'] },
            { text: ['Klik nog eens op ', b('Regel toevoegen'), '.'], result: 'Er verschijnt een derde, lege regel.' },
            { text: ['Open in de nieuwe regel de lijst ', b('Ingrediënt of basisrecept'), ' en kies onder de kop Basisrecepten ', b('Mosterdmayonaise · g'), '.'] },
            {
              text: ['Typ 20 in ', b('Nettohoeveelheid (g)'), '.'],
              result: ['De kosten van de regel zijn € 0,09. Je basisrecept wordt in het gerecht gebruikt.'],
              image: img('dish-lines', 'De kaart Ingrediënten met drie regels: Kipfilet 120 g, Briocheburgerbroodje 1 st. en Mosterdmayonaise 20 g.', 'Een regel van een gerecht kan een ingrediënt of een basisrecept zijn.'),
            },
            {
              text: ['Laat voor dit voorbeeld ', b('Rendement %'), ' op 100 staan. ', secLink('glossary', true), ' legt andere waarden uit.'],
            },
            {
              text: ['Kijk onderaan naar de kaart ', b('Kostenoverzicht'), '.'],
              result: 'Daar staat wat één portie kost en wat er van de prijs overblijft: hier € 2,03 voor ingrediënten, € 8,99 prijs excl. btw en € 6,97 bijdrage. Het volgende deel legt elke regel uit.',
              image: img('dish-cost', 'De kaart Kostenoverzicht van Kipbroodje met de ingrediëntkosten per portie, de prijs excl. btw, de bijdrage en de maandschatting.', 'De kaart Kostenoverzicht van het nieuwe gerecht.'),
            },
            { text: ['Klik onderaan de pagina op ', b('Gerecht opslaan'), '.'], result: ['Het gerecht is opgeslagen. De pagina heeft nu de naam van het gerecht als titel en de knoppen onderaan worden ', b('Wijzigingen opslaan'), ', ', b('Wijzigingen ongedaan maken'), ' en ', b('Gerecht verwijderen'), '. Het gerecht staat op de pagina Recepten en op het Overzicht.'] },
          ],
        },
        {
          kind: 'note',
          tone: 'safe',
          title: 'Kilogrammen en liters',
          text: ['In elke regel mag je in de lijst ', b('Eenheid'), ' ', b('kg'), ' kiezen en 0,12 typen in plaats van 120 met g. Het programma rekent het zelf om. Gewicht en inhoud kun je niet mengen: een regel in grammen kun je niet in liters typen.'],
        },
        { kind: 'p', text: 'Bedragen op het scherm zijn afgerond op centen. Het programma rekent nauwkeuriger, dus narekenen met de getoonde bedragen kan een verschil van een paar cent geven.' },
        { kind: 'h3', text: 'Zo lees je de getallen in de kaart Kostenoverzicht' },
        {
          kind: 'list',
          items: [
            [b('Kosten van de bereiding, alle porties (excl. btw)'), ': wat de ingrediënten van de hele bereiding kosten.'],
            [b('Ingrediëntkosten volgens recept per portie (excl. btw)'), ': wat de ingrediënten van één portie kosten. Dit is het belangrijkste kostengetal.'],
            [b('Menukaartprijs (incl. btw)'), ' en ', b('Prijs excl. btw'), ': de prijs die je gast betaalt en dezelfde prijs zonder btw. Het programma rekent met die zonder btw.'],
            [b('Bijdrage per portie (vóór overige kosten)'), ': de prijs zonder btw min de ingrediëntkosten. Dit is geen winst: personeel, huur en de rest moeten er nog van betaald worden.'],
            [b('Foodcostpercentage'), ': hoeveel van de prijs zonder btw naar ingrediënten gaat. ', b('Bijdragemarge %'), ' is de rest.'],
            [b('Geschatte maandelijkse bijdrage'), ': bijdrage per portie maal je verkoopaantal per maand. Dit verschijnt alleen als je een aantal per maand hebt ingevuld. Het is je schatting, geen prognose.'],
            [b('kosten onbekend'), ': er ontbreekt een prijs. Een regel onder de kaart zegt welk ingrediënt nog geen prijs heeft. Voeg die toe op de pagina Ingrediënten.'],
          ],
        },
        {
          kind: 'steps',
          title: 'Een gerecht wijzigen of verwijderen',
          steps: [
            { text: ['Klik op ', b('Recepten'), ' en dan op de naam van het gerecht.'], result: 'Het gerecht opent met al zijn regels.' },
            { text: ['Wijzig wat je nodig hebt. Wil je de wijzigingen toch niet bewaren? Klik op ', b('Wijzigingen ongedaan maken'), '.'], result: 'De melding “Je hebt niet-opgeslagen wijzigingen.” staat naast de knoppen totdat je opslaat.' },
            { text: ['Klik op ', b('Wijzigingen opslaan'), '.'], result: 'De melding “Opgeslagen.” verschijnt.' },
            {
              text: ['Wil je het gerecht verwijderen, klik dan rechtsonder op ', b('Gerecht verwijderen'), ' en bevestig in het venster met de rode knop. Wil je het houden, klik dan op ', b('Annuleren'), '.'],
              result: 'Heeft het gerecht opgeslagen scenario’s in de Simulator, dan staat in het venster dat ze ook worden verwijderd.',
            },
          ],
        },
      ],
    },
    /* ------------------------------------------------------------------ 9 */
    {
      id: 'dashboard',
      title: 'Overzicht: wat is duurder geworden',
      blocks: [
        { kind: 'p', text: 'Het Overzicht beantwoordt één vraag: welke van mijn gerechten zijn sinds een gekozen datum duurder geworden en wat kost dat mij per maand? Het leest alleen je gegevens. Niets wat je hier doet, verandert iets. Voor beide datums gebruikt MenuPilot je huidige recept en huidige menukaartprijs. Alleen de inkoopprijzen verschillen. Je vergelijkt dus niet met een oudere versie van het recept.' },
        {
          kind: 'steps',
          title: 'Het Overzicht lezen',
          steps: [
            { text: ['Klik in het menu op ', b('Overzicht'), ' (of op de naam MenuPilot linksboven).'], result: 'Het Overzicht opent.' },
            {
              text: 'Kijk naar de twee blokken bovenaan. Links staat het hele menu: het grote getal is het effect per maand. Rechts staat het ene gerecht waarvan de kosten van één portie het meest zijn gestegen.',
              result: ['Het linkerblok heet ', b('Maandeffect bij jouw aantallen'), ': rood met een min (bijvoorbeeld −€ 273,38) betekent dat er per maand zoveel minder overblijft. Het rechterblok heet ', b('Grootste stijging per portie'), ': het gerecht, de kosten toen en nu en de knop ', b('Probeer een scenario'), '.'],
              image: img('dashboard-cards', 'De twee blokken bovenaan: Maandeffect bij jouw aantallen −€ 273,38 en Grootste stijging per portie: Klassieke burger, van € 4,20 naar € 4,85, met de knop Probeer een scenario.', 'De samenvattende blokken. Een minteken voor de euro’s betekent dat er per maand minder overblijft.'),
            },
            {
              text: ['Zoek de regel ', b('Vergelijk prijzen met'), '. Klik op een van de knoppen ', b('7 dagen'), ', ', b('30 dagen'), ' of ', b('90 dagen'), '.'],
              result: 'De gekozen knop krijgt een lichtgouden achtergrond. Alle getallen eronder worden nu vergeleken met de prijzen van zoveel dagen geleden. In het voorbeeld toont 7 dagen geen verandering, omdat de laatste voorbeeldprijzen ouder zijn dan een week; voor 90 dagen heeft het voorbeeld nog geen prijzen en zegt de tabel “geen prijs op deze datum”.',
              image: img('dashboard-picker', 'De regel Vergelijk prijzen met, drie knoppen 7 dagen, 30 dagen, 90 dagen, het veld Kies een datum en de opmerking Datums in UTC.', 'De knoppen voor de vergelijkingsperiode en het datumveld.'),
            },
            {
              text: ['Wil je vergelijken met een exacte dag (bijvoorbeeld de dag van een oude factuur), klik dan in het veld ', b('Kies een datum'), ' en kies of typ een datum, bijvoorbeeld die van drie weken geleden.'],
              result: 'De knoppen verliezen hun gouden kleur en alles wordt vergeleken met die datum. De datum mag niet in de toekomst liggen. Datums zijn in UTC.',
            },
            {
              text: ['Kijk naar de tabel ', b('Gerechten'), '. Elke rij is één gerecht: de naam met de menukaartprijs incl. en excl. btw.'],
              result: 'Elke rij toont de kosten toen en nu, het verschil in euro (rood als het hoger is), wat er nu van de prijs overblijft en het effect per maand.',
              image: img('dashboard-table', 'De tabel Gerechten op het Overzicht met de kolommen voor de kosten op de vergelijkingsdatum, de kosten nu, het verschil, de bijdrage nu en het maandeffect.', 'Eén rij per gerecht.'),
            },
            { text: ['Wil je “wat als” voor een gerecht proberen, klik dan onder de naam op ', b('Simuleren'), '.'], result: ['De Simulator opent voor dat gerecht (zie ', sec('simulator'), ').'] },
            {
              text: 'Kijk onder de tabel naar de totaalregel.',
              result: ['Daar staat ', b('Maandeffect van je menu (gerechten met geschatte aantallen)'), ' en het totaal in euro’s. Een gerecht zonder aantal per maand wordt weggelaten en eronder geteld, bijvoorbeeld “1 gerecht zonder maandaantal uitgesloten”.'],
            },
            {
              text: ['Scroll omlaag naar de kaart ', b('Basisrecepten'), '.'],
              result: 'Die toont wat een kilo (of liter, of stuk) van elk basisrecept kost op de vergelijkingsdatum (Toen) en nu (Nu).',
              image: img('dashboard-preps', 'De kaart Basisrecepten: Tomatenbasis en Burgersaus, met de kosten per kilo toen en nu.', 'Basisrecepten staan apart van gerechten.'),
            },
            {
              text: ['Scroll onderaan naar ', b('Samenvatting van je menu'), '.'],
              result: 'Drie getallen: hoeveel gerechten duurder zijn geworden, het gemiddelde foodcostpercentage van je gerechten en hoeveel gerechten geen aantal per maand hebben. Eronder staat dat ongeveer 30% foodcost een gemiddelde is voor Nederlandse horeca: een algemene richtlijn, geen doel en geen regel.',
              image: img('dashboard-summary', 'De Samenvatting van je menu: Gerechten die duurder zijn geworden 5, Gemiddeld foodcostpercentage 21,7%, Gerechten zonder maandaantal 1.', 'De drie samenvattende getallen.'),
            },
          ],
        },
        { kind: 'h3', text: 'Wat de kolommen betekenen' },
        {
          kind: 'list',
          items: [
            [b('Gerecht'), ': de naam en daaronder de menukaartprijs met en zonder btw.'],
            [b('[datum]'), ' en ', b('Nu'), ': wat de ingrediënten van één portie kostten op de vergelijkingsdatum en vandaag.'],
            [b('Verschil (€)'), ': het verschil. Een plusteken (+€ 0,65) betekent dat het gerecht duurder is geworden. Eronder staat de verandering van het foodcostpercentage in procentpunten, bijvoorbeeld +5,4 pp.'],
            [b('Bijdrage nu (vóór overige kosten)'), ': wat er na de ingrediënten van de prijs overblijft. Dit is geen winst.'],
            [b('Maandeffect bij jouw aantallen'), ': bijdrage nu min bijdrage toen, maal je verkoopaantal per maand. Een minteken (−€ 195,00) betekent dat er per maand zoveel minder overblijft. Het is een berekening met je eigen getal, geen voorspelling.'],
          ],
        },
        { kind: 'h3', text: 'Tekens die je kunt zien in plaats van een getal' },
        {
          kind: 'messages',
          items: [
            { message: '—', meaning: ['Voor dit gerecht is geen verkoopaantal per maand ingevuld (de tabel zegt “Aantal ontbreekt”). Het wordt weggelaten uit het maandtotaal. Open het gerecht. Vul het aantal porties in bij ', b('Verkocht per maand (optioneel)'), '. Klik op ', b('Wijzigingen opslaan'), '.'] },
            { message: 'kosten onbekend', meaning: ['Er ontbreekt een prijs voor een ingrediënt van dit gerecht. Voeg de prijs toe op de pagina Ingrediënten.'] },
            { message: 'geen prijs op deze datum', meaning: ['Een van de ingrediënten had op de gekozen datum nog geen prijs, omdat je later met prijzen invullen begon. Kies een recentere datum.'] },
            { message: 'n.v.t.', meaning: ['Het getal is niet te berekenen, bijvoorbeeld een percentage als de menukaartprijs € 0,00 is.'] },
            { message: '(onvolledig)', meaning: ['Naast het maandeffect: sommige gerechten met een aantal per maand moesten worden weggelaten en een regel eronder zegt waarom.'] },
            { message: 'Geen vergelijkbaar gerecht is in deze periode duurder geworden.', meaning: ['Van de gerechten waarvoor op beide datums prijzen bekend zijn, is geen gerecht duurder geworden. Controleer ook of andere gerechten “kosten onbekend” of “geen prijs op deze datum” tonen. Kies een langere periode of een oudere datum om verder terug te kijken.'] },
          ],
        },
        {
          kind: 'note',
          tone: 'important',
          title: 'Twee dingen om te onthouden',
          text: 'De kosten zijn berekend uit je recepten; het is niet wat er echt in de keuken is gebruikt. En “bijdrage” is geen winst: personeel, huur en andere kosten zijn er niet in verwerkt.',
        },
      ],
    },
    /* ------------------------------------------------------------------ 10 */
    {
      id: 'simulator',
      title: 'Simulator: veilig “wat als” proberen',
      blocks: [
        { kind: 'p', text: 'De Simulator beantwoordt vragen als: wat als ik de prijs verhoog? Wat als ik een iets kleinere portie serveer? Wat als de leverancier terugkeert naar de oude prijs? Je maakt een kopie van een gerecht, verandert iets in de kopie en ziet het resultaat naast je echte getallen.' },
        {
          kind: 'note',
          tone: 'safe',
          title: 'Dit is veilig',
          text: 'De Simulator verandert nooit je echte ingrediënten, prijzen of recepten. Alles wat je probeert, is alleen een berekening in een kopie.',
        },
        { kind: 'p', text: 'Op een computer staan de invoervelden links en de vergelijking rechts. Op een telefoon staat de vergelijking eronder. Je ziet daar de Huidige situatie en het gekozen scenario. Kies A, B of C om een ander scenario te bekijken.' },
        {
          kind: 'steps',
          title: 'De Simulator openen voor de Klassieke burger',
          steps: [
            { text: ['Klik in het menu op ', b('Simulator'), '.'], result: 'Er opent een kaart voor elk gerecht, met de ingrediëntkosten per portie en het aantal opgeslagen scenario’s.', image: img('simulator-picker', 'De pagina Simulator met een kaart per gerecht en de ingrediëntkosten volgens recept per portie.', 'Eén kaart voor elk gerecht.') },
            { text: ['Klik op de kaart ', b('Klassieke burger'), '.'], result: ['De pagina “Simulator: Klassieke burger” opent. Een link ', b('Alle gerechten'), ' bovenaan leidt terug naar de kaarten.'] },
            {
              text: ['Kijk naar ', b('Huidige situatie'), '. Dat zijn je echte gegevens van vandaag.'],
              result: 'Vijf getallen op een rij: menukaartprijs € 13,08, ingrediëntkosten € 4,85, bijdrage € 7,15, foodcostpercentage 40,4% en € 2.145,00 geschat per maand.',
              image: img('simulator-baseline', 'De rij Huidige situatie voor Klassieke burger: menukaartprijs, ingrediëntkosten, bijdrage per portie, foodcostpercentage en geschatte maandelijkse bijdrage.', 'Huidige situatie: je echte gerecht van vandaag.'),
            },
            {
              text: ['Kijk links naar het veld ', b('Verkocht per maand (jouw schatting)'), '. Daar staat al 300, het getal dat bij het gerecht is opgeslagen. Wijzig het als je wilt.'],
              result: ['Dit is de gedeelde verkoopschatting. Elk scenario heeft ook ', b('Eigen verkoopaantal per maand (optioneel)'), '. Laat dat veld leeg om het gedeelde getal te gebruiken.'],
            },
          ],
        },
        {
          kind: 'steps',
          title: 'Scenario A: de menukaartprijs 75 cent verhogen',
          steps: [
            { text: ['Klik op de knop ', b('Scenario toevoegen'), '.'], result: ['Een groot blok “Scenario A” verschijnt met het maandverschil (nu € 0,00), links een kaart ', b('Pas je scenario aan'), ' en rechts de tabel ', b('Dezelfde basis, andere keuzes'), '.'] },
            {
              text: ['Klik in de kaart links op het veld ', b('Verkoopprijs (incl. btw)'), ' en typ 13,83.'],
              result: 'Het grijze 13,08 toont de huidige prijs. In de kaart wordt de bijdrage per portie € 7,84, met +€ 0,69, en bovenaan de pagina wordt het maandverschil +€ 206,42.',
              image: img('simulator-scenario', 'De bovenkant van de kaart Pas je scenario aan: scenarionaam, verkoopprijs 13,83 en de resultaten bijdrage per portie € 7,84 en maandelijkse bijdrage € 2.351,42.', 'Verkoopprijs 13,83: bijdrage € 7,84 per portie, verschil +€ 206,42 per maand.'),
            },
          ],
        },
        {
          kind: 'steps',
          title: 'Scenario B: een kleinere portie gehakt (160 g in plaats van 180 g)',
          steps: [
            { text: ['Klik nog eens op ', b('Scenario toevoegen'), '.'], result: ['Een tweede scenario, B, verschijnt. Het is gekozen en de kaart ervan staat links. Onder ', b('Kies een scenario om te vergelijken'), ' wissel je tussen A en B.'] },
            { text: ['Klik in de kaart van Scenario B op de balk ', b('Hoeveelheden in het gerecht'), '.'], result: 'De balk opent en toont een veld voor elke ingrediëntregel van het gerecht. Een regel die een basisrecept is, kun je hier niet wijzigen.' },
            {
              text: ['Zoek ', b('Rundergehakt 80/20'), ' en typ 160 in ', b('Nieuwe nettohoeveelheid (g)'), '. Laat ', b('Eenheid'), ' op g staan.'],
              result: 'Velden die je leeg laat, zeggen “ongewijzigd”. Op de balk verschijnt een klein label “1 gewijzigd”. De bijdrage wordt € 7,49 (+€ 0,34).',
              image: img('simulator-qty', 'De geopende balk Hoeveelheden in het gerecht met het veld Nieuwe nettohoeveelheid ingevuld met 160 voor Rundergehakt 80/20.', 'Alleen de velden die je invult, worden gewijzigd.'),
            },
          ],
        },
        {
          kind: 'note',
          tone: 'important',
          title: 'Wees voorzichtig met porties',
          text: 'Een kleinere portie kan de kwaliteit van het gerecht veranderen en kan gevolgen hebben voor voedselveiligheid of allergeneninformatie. Het programma rekent alleen. Controleer dat zelf voordat je een echt recept wijzigt.',
        },
        {
          kind: 'steps',
          title: 'Scenario C: wat als de leverancier terugkeert naar de oude prijs',
          steps: [
            { text: ['Klik nog een keer op ', b('Scenario toevoegen'), '.'], result: ['Scenario C verschijnt. De knop zegt nu “Maximaal 3 scenario’s” en is grijs: meer dan drie kan niet.'] },
            { text: ['Klik in de kaart van Scenario C op de balk ', b('Inkoopprijzen'), '.'], result: 'De balk opent en toont de ingrediënten van het gerecht en van de basisrecepten erin.' },
            {
              text: ['Zoek ', b('Rundergehakt 80/20'), '. Onder de naam zie je de prijs nu en de eerdere prijs. Typ in ', b('Nieuwe verpakkingsprijs van Rundergehakt 80/20 (excl. btw)'), ' 14,00.'],
              result: ['De regel “Dat is € 14,00/kg excl. btw.” verschijnt. De bijdrage wordt € 7,69 (+€ 0,54). De echte prijs op de pagina Ingrediënten blijft € 17,00.'],
              image: img('simulator-prices', 'De geopende balk Inkoopprijzen met Rundergehakt 80/20: nu € 17,00 per verpakking van 1 kg, toen € 14,00/kg en de nieuwe verpakkingsprijs 14,00 getypt.', 'De echte prijs verandert niet: dit gaat alleen in de kopie.'),
            },
          ],
        },
        {
          kind: 'steps',
          title: 'De vergelijking lezen',
          steps: [
            { text: ['Kijk naar de tabel ', b('Dezelfde basis, andere keuzes'), '.'], result: ['Op een computer heeft die vier kolommen: Huidige situatie (vandaag) en Scenario A, B en C. Elk scenario toont onder zijn getal het verschil met de Huidige situatie. Groen betekent een gunstige verandering in de berekening, rood een ongunstige. De pijl laat zien of het getal stijgt of daalt. Lagere ingrediëntkosten krijgen dus een groene pijl omlaag. Het gekozen scenario heeft een gekleurde kolom.'], image: img('simulator-compare', 'De vergelijkingstabel met de kolommen Huidige situatie, Scenario A, B en C en de verschillen met de Huidige situatie.', 'Groen is een gunstige verandering, rood een ongunstige. De pijl wijst omhoog of omlaag.') },
            { text: ['Kijk naar de rij ', b('Bijdrage per portie'), '. De kleine tekens tonen hoeveel meer of minder er van één portie overblijft, vergeleken met de Huidige situatie.'] },
            { text: ['Kijk naar de rijen ', b('Geschatte maandelijkse bijdrage'), ' en ', b('Verschil per maand'), '. Ze tonen het verschil per maand bij je verkoopschatting: A +€ 206,42, B +€ 102,00, C +€ 162,00.'] },
            { text: 'Lees de zin onder de tabel. Die noemt de kolom met de hoogste geschatte maandelijkse bijdrage. Die kolom zegt ook “hoogste maandbijdrage”.', result: 'Dit is alleen een berekening met jouw getallen. Het is geen advies en geen voorspelling.' },
          ],
        },
        {
          kind: 'steps',
          title: 'Een scenario opslaan en een naam geven',
          steps: [
            { text: ['Klik onder ', b('Kies een scenario om te vergelijken'), ' op ', b('Scenario A'), '.'], result: 'De kaart toont nu Scenario A met verkoopprijs 13,83.' },
            { text: ['Klik in de kaart op het veld ', b('Scenarionaam'), '. Daar staat Scenario A.'] },
            { text: 'Houd Ctrl ingedrukt en druk op A. Op een Mac gebruik je ⌘ en A.', result: 'De oude naam is geselecteerd. Zonder deze stap komt je tekst achter de oude naam.' },
            { text: ['Typ de nieuwe naam: Prijs 13,83.'], result: 'De kolom in de tabel krijgt dezelfde naam. Deze stap is optioneel.' },
            { text: ['Klik op ', b('Scenario opslaan'), '.'], result: ['De tekst onder de knoppen verandert van “Nog niet opgeslagen.” in “Opgeslagen.” De knop heet nu ', b('Wijzigingen opslaan'), ' en is grijs totdat je iets wijzigt.'] },
            {
              text: ['Wil je een scenario weggooien, klik dan op ', b('Verwijderen'), '. Bij een opgeslagen scenario vraagt het programma om bevestiging met ', b('Scenario verwijderen'), '.'],
              result: 'Alleen het scenario verdwijnt. Je gerechten en prijzen blijven ongemoeid.',
            },
          ],
        },
        {
          kind: 'note',
          tone: 'important',
          title: 'Niet-opgeslagen scenario’s gaan verloren als je de pagina sluit',
          text: ['Zolang je in MenuPilot blijft, wacht een niet-opgeslagen scenario op je als je terugkomt bij het gerecht. Sluit of herlaad je de pagina, dan is het weg. Druk op ', b('Scenario opslaan'), ' voor alles wat je wilt bewaren.'],
        },
        { kind: 'h3', text: '“De huidige situatie is veranderd” en “Huidige situatie bijwerken”' },
        {
          kind: 'p',
          text: 'Een scenario bewaart het recept en de prijzen waarmee je begon, of die je koos met Huidige situatie bijwerken. Scenario opslaan bewaart die basis; het haalt niet automatisch nieuwe prijzen op. Verandert er later een prijs, dan zou het scenario met oude getallen worden vergeleken. Het programma waarschuwt je en laat je opnieuw rekenen met de gegevens van vandaag.',
        },
        {
          kind: 'steps',
          title: 'Zie het zelf',
          steps: [
            { text: ['Sla Scenario A op zoals hierboven beschreven.'] },
            { text: ['Klik op ', b('Ingrediënten'), ', druk bij Rundergehakt 80/20 op ', b('Nieuwe prijs'), ', typ 18,50 en klik op ', b('Prijs opslaan'), '.'] },
            { text: ['Klik op ', b('Simulator'), ' en dan op de kaart ', b('Klassieke burger'), '.'], result: ['De kaart van het scenario toont een goudkleurige melding “De huidige situatie is veranderd sinds je dit scenario opsloeg” en de tabel markeert de kolom “oudere prijzen”.'], image: img('simulator-stale', 'De goudkleurige melding De huidige situatie is veranderd sinds je dit scenario opsloeg met de knop Huidige situatie bijwerken.', 'De melding staat in de kaart van het scenario.') },
            { text: ['Klik op ', b('Huidige situatie bijwerken'), ' om het huidige recept en de huidige prijzen voor de vergelijking te gebruiken.'], result: ['Alleen dit scenario wordt opnieuw berekend, met de prijzen van vandaag. Je wijzigingen blijven staan waar ze nog gelden. De tekst onder de knoppen zegt “Niet-opgeslagen wijzigingen.”: klik op ', b('Wijzigingen opslaan'), ' om de update te bewaren.'] },
          ],
        },
        {
          kind: 'p',
          text: ['Wil je de gehaktprijs herstellen, voeg dan een nieuwe prijs van € 17,00 excl. btw voor 1 kg toe (', b('Nieuwe prijs'), ' op de pagina Ingrediënten). ', b('Terugzetten naar voorbeeldgegevens'), ' vervangt alles, ook je oefenrecepten en opgeslagen scenario’s.'],
        },
        { kind: 'p', text: 'Bedragen zijn afgerond op centen, dus een verschil per maand is niet altijd precies het verschil per portie maal 300.' },
        { kind: 'h3', text: 'Meldingen in de Simulator' },
        {
          kind: 'messages',
          items: [
            { message: 'De huidige situatie is veranderd sinds je dit scenario opsloeg', meaning: ['Prijzen of het recept zijn veranderd nadat je opsloeg. Klik op ', b('Huidige situatie bijwerken'), ' om met de gegevens van vandaag te rekenen.'] },
            { message: 'Huidige situatie bijgewerkt. Sommige wijzigingen gelden niet meer en zijn verwijderd (sla op om dit te bewaren):', meaning: ['Na de update paste een van je wijzigingen niet meer (bijvoorbeeld omdat een ingrediënt uit het recept is gehaald). Klik op ', b('OK'), ', controleer de getallen en sla op als je het ermee eens bent.'] },
            { message: 'Niet genoeg gegevens om maandresultaten te vergelijken.', meaning: ['De tabel heeft minstens twee kolommen met een maandbedrag nodig. Typ een getal in ', b('Verkocht per maand (jouw schatting)'), ' en zorg dat er geen prijs ontbreekt, of druk op ', b('Huidige situatie bijwerken'), ' bij een scenario met “oudere prijzen”.'] },
            { message: 'Vul je schatting in. Vul 0 in als je geen verkopen verwacht.', meaning: ['Het gerecht heeft een aantal per maand, dus het veld mag niet leeg blijven. Typ een getal, of 0. Let op: 0 betekent dat je geen verkopen verwacht. De maandbedragen worden dan nul; ze verdwijnen niet.'] },
            { message: 'Vul een geheel getal van 0 of meer in, bijvoorbeeld 300.', meaning: ['Typ in het veld voor de verkoop per maand een heel getal zoals 300, zonder woorden of eenheid.'] },
          ],
        },
      ],
    },
    /* ----------------------------------------------------------------- 11 */
    {
      id: 'data',
      title: 'Je gegevens en reservekopieën',
      blocks: [
        { kind: 'p', text: 'Je gegevens worden opgeslagen nadat je met succes een opslaanknop gebruikt. MenuPilot uploadt ze niet naar een server. Ze blijven in deze browser op deze computer. Wie toegang heeft tot deze browser kan ze zien. De keerzijde: worden de browsergegevens gewist, of open je MenuPilot in een andere browser of op een andere computer, dan zijn je gegevens daar niet. Een reservekopie beschermt je.' },
        { kind: 'image', image: img('data-page', 'De pagina Gegevens met de kaarten Reservekopie exporteren, Reservekopie importeren, Terugzetten naar voorbeeldgegevens en Begin met lege gegevens.', 'Maak eerst een reservekopie voordat je gegevens vervangt of verwijdert.') },
        {
          kind: 'note',
          tone: 'important',
          title: 'Hoe vaak een reservekopie maken',
          text: ['Eén keer per week en na elke grote wijziging: nieuwe prijzen, nieuwe recepten, een lange sessie in de Simulator. Het kost een paar seconden. Sla vóór het maken van een reservekopie de recepten en scenario’s op die je wilt bewaren. Niet-opgeslagen invoer zit er niet in.'],
        },
        {
          kind: 'steps',
          title: 'Een reservekopie maken (Reservekopie exporteren)',
          steps: [
            { text: ['Klik in het menu op ', b('Gegevens'), '.'], result: ['De pagina Gegevens opent. Onder de titel staat wat er nu in zit, bijvoorbeeld “Nu: 12 ingrediënten, 7 recepten, 0 opgeslagen scenario’s.”'] },
            { text: ['Klik in de kaart ', b('Reservekopie exporteren'), ' op ', b('Reservekopie exporteren'), '.'], result: ['Je browser bewaart een bestand met een naam als menupilot-backup-2026-10-20.json, meestal in de map Downloads. De pagina zegt “Reservekopie opgeslagen als … Bewaar het bestand op een veilige plek.”'] },
            { text: 'Zoek dat bestand in je map Downloads en kopieer het naar een veilige plek: een usb-stick, of mail het naar jezelf.', result: 'Zo blijft je reservekopie beschikbaar, ook als je je computer kwijtraakt.' },
          ],
        },
        {
          kind: 'note',
          tone: 'important',
          title: 'Importeren vervangt alles',
          text: ['Een reservekopie importeren vervangt alle huidige gegevens. Invoer die je na die reservekopie deed, gaat verloren. Exporteer eerst een aparte reservekopie van je huidige gegevens.'],
        },
        {
          kind: 'steps',
          title: 'Een reservekopie terugzetten (Reservekopie importeren)',
          steps: [
            { text: ['Klik op ', b('Gegevens'), ' en klik dan in de kaart ', b('Reservekopie importeren'), ' op de knop ', b('Reservekopie importeren'), '.'], result: 'Een venster van je computer opent om een bestand te kiezen.' },
            { text: 'Kies je reservekopiebestand (de naam begint met menupilot-backup) en klik op Openen.', result: ['Een venster “Deze reservekopie importeren?” opent en toont de naam van het bestand. Er staat dat alle huidige gegevens worden vervangen.'] },
            { text: ['Klik om door te gaan op ', b('Vervangen door reservekopie'), '. Wil je toch niet doorgaan? Klik op ', b('Annuleren'), '.'], result: ['De melding “Reservekopie … is geïmporteerd. Je gegevens zijn vervangen.” verschijnt. Is het bestand onbruikbaar, dan verschijnt in het venster een rode melding die zegt waarom, en er verandert niets.'] },
          ],
        },
        {
          kind: 'steps',
          title: 'Terug naar de voorbeeldgegevens (Terugzetten naar voorbeeldgegevens)',
          steps: [
            { text: ['Klik op ', b('Gegevens'), ' en klik dan in de kaart ', b('Terugzetten naar voorbeeldgegevens'), ' op de knop ', b('Terugzetten naar voorbeeldgegevens'), '.'], result: ['Een venster “Terugzetten naar voorbeeldgegevens?” opent. Er staat dat alle huidige gegevens worden vervangen.'], image: img('data-reset-dialog', 'Het venster Terugzetten naar voorbeeldgegevens? met de knoppen Annuleren en Terugzetten naar voorbeeldgegevens.', 'Heb je niet-opgeslagen scenario’s, dan telt een melding in dit venster ze.') },
            { text: ['Wil je je gegevens houden? Klik op ', b('Annuleren'), '. Maak een kopie met ', b('Reservekopie exporteren'), '. Open daarna ', b('Terugzetten naar voorbeeldgegevens'), ' opnieuw. Anders lees je het venster en ga je verder.'] },
            { text: ['Klik op de rode knop ', b('Terugzetten naar voorbeeldgegevens'), '. Wil je toch niet doorgaan? Klik op ', b('Annuleren'), '.'], result: ['De melding “Voorbeeldgegevens zijn teruggezet.” verschijnt. Het voorbeeld wordt geladen in de taal van het scherm.'] },
          ],
        },
        {
          kind: 'note',
          tone: 'important',
          title: 'Lees dit voordat je het programma leegmaakt',
          text: ['“Begin met lege gegevens” verwijdert alles wat nu in het programma staat: het voorbeeld en alles wat je zelf typte. Heb je al je eigen gegevens ingevuld, maak dan eerst een kopie: zie stap 1 hieronder. Ook oefenrecepten en opgeslagen scenario’s worden verwijderd. Maak een reservekopie als je die wilt bewaren.'],
        },
        {
          kind: 'steps',
          title: 'Beginnen met je eigen gegevens (leeg programma)',
          steps: [
            {
              text: ['Alleen als je al eigen gegevens hebt getypt: maak eerst een reservekopie. Klik op ', b('Gegevens'), ' en dan op ', b('Reservekopie exporteren'), ' (hierboven beschreven).'],
              result: 'Een bestand met de naam menupilot-backup en de datum van vandaag wordt op je computer bewaard.',
            },
            { text: ['Klik in het menu bovenaan op ', b('Gegevens'), '.'], result: 'De pagina Gegevens opent met vier kaarten: Reservekopie exporteren, Reservekopie importeren, Terugzetten naar voorbeeldgegevens en Begin met lege gegevens.' },
            {
              text: ['Scroll omlaag naar de kaart ', b('Begin met lege gegevens'), ' en klik daarin op de knop ', b('Begin met lege gegevens'), '.'],
              result: ['Een venster “Beginnen met lege gegevens?” opent. Er staat dat alles wordt verwijderd.'],
              image: img('data-empty-dialog', 'Het bevestigingsvenster Beginnen met lege gegevens? met de knoppen Annuleren en Beginnen met lege gegevens.', 'Je kunt nog stoppen: Annuleren sluit het venster en verandert niets.'),
            },
            {
              text: 'Lees het venster. Heb je scenario’s in de Simulator die je niet hebt opgeslagen, dan zegt een melding hoeveel er verloren gaan.',
            },
            {
              text: ['Klik om door te gaan op de rode knop ', b('Beginnen met lege gegevens'), '. Wil je toch niet doorgaan? Klik op ', b('Annuleren'), '.'],
              result: ['De melding “Alle gegevens zijn verwijderd. Voeg ingrediënten toe op de pagina Ingrediënten.” verschijnt en de pagina zegt “Nu: 0 ingrediënten, 0 recepten, 0 opgeslagen scenario’s.”'],
            },
            { text: ['Klik in het menu op ', b('Ingrediënten'), ' en dan op ', b('Voeg je eerste ingrediënt toe'), '.'], result: ['Het venster voor een nieuw ingrediënt opent. ', secLink('ingredients', true), ' laat zien hoe je het invult.'] },
          ],
        },
        {
          kind: 'note',
          tone: 'safe',
          title: 'Je kunt annuleren voordat gegevens worden vervangen',
          text: ['Annuleren sluit het venster zonder gegevens te vervangen. Bevestigen vervangt je huidige gegevens. Je kunt ze terugzetten uit een reservekopie die je eerder maakte. Een bestand dat geen MenuPilot-reservekopie is, wordt geweigerd en je huidige gegevens blijven zoals ze waren.'],
        },
      ],
    },
    /* ----------------------------------------------------------------- 12 */
    {
      id: 'troubleshooting',
      title: 'Wat als…',
      blocks: [
        { kind: 'p', text: 'De meeste problemen hebben een eenvoudig antwoord. Zoek hieronder je situatie.' },
        { kind: 'h3', text: 'Ik heb een verkeerd getal getypt' },
        {
          kind: 'list',
          items: [
            ['Het getal is nog niet opgeslagen: klik in het veld. Houd Ctrl ingedrukt en druk op A (op een Mac: ⌘ en A). Typ het juiste getal. Klik daarna op de opslaanknop.'],
            ['Je wilt helemaal niets opslaan: klik op ', b('Annuleren'), ' (in een recept: ', b('Wijzigingen ongedaan maken'), '). Er wordt niets opgeslagen.'],
            ['Een verkeerde ingrediëntprijs is al opgeslagen: open ', b('Nieuwe prijs'), ' van dat ingrediënt en sla de juiste prijs op. De nieuwste prijs telt. De verkeerde prijs blijft in de geschiedenis staan. Die kan nog meetellen bij vergelijkingen met een datum vóór je correctie.'],
            ['Een recept is met een verkeerd getal opgeslagen: klik op ', b('Recepten'), ', open het gerecht, verbeter het getal en klik op ', b('Wijzigingen opslaan'), '.'],
          ],
        },
        { kind: 'h3', text: 'Een venster sluit niet' },
        {
          kind: 'steps',
          title: 'Zo sluit je het',
          steps: [
            { text: ['Klik op ', b('Annuleren'), ' of op het × rechtsboven in het venster.'], result: 'Het venster sluit.' },
            { text: 'Werkt dat niet, druk dan op de toets Esc op je toetsenbord.' },
            { text: 'Reageert de hele pagina niet, laad haar dan opnieuw: druk op F5 (op een Mac: de ⌘-toets en R).', result: 'De pagina opent opnieuw. Alles wat was opgeslagen, staat er nog. Alleen wat je aan het typen was, is weg.' },
          ],
        },
        { kind: 'h3', text: 'Er verscheen een rode melding' },
        { kind: 'p', text: 'Een rode melding betekent dat het programma iets niet heeft geaccepteerd en niet heeft opgeslagen. Lees hem: er staat wat je moet verbeteren. Dit zijn de meldingen die je kunt tegenkomen.' },
        {
          kind: 'messages',
          items: [
            { message: 'Vul een naam in.', meaning: 'Het veld Naam is leeg. Typ een naam.' },
            { message: 'Vul de verpakkingsgrootte in, bijvoorbeeld 1 kg of 250 g.', meaning: ['Het veld ', b('Verpakking'), ' is leeg. Typ de grootte van de factuur, bijvoorbeeld 1 met de eenheid kg.'] },
            { message: 'Vul de verpakkingsprijs excl. btw in, bijvoorbeeld 11,20.', meaning: ['De verpakkingsprijs is leeg. Typ de prijs van de factuur zonder btw. Typ geen €. Een minteken wordt niet geaccepteerd.'] },
            { message: 'Vul een bedrag van 0 of meer in met maximaal twee decimalen. Bijvoorbeeld: 13,83', meaning: 'Vul nul of een positief bedrag in, zoals 13,83. Gebruik maximaal twee decimalen. Typ geen €.' },
            { message: 'Vul een hoeveelheid in, bijvoorbeeld 150.', meaning: ['Vul in ', b('Nettohoeveelheid'), ' een getal groter dan nul in, zoals 150 of 0,5. Kies de eenheid in de lijst ernaast. Typ geen woorden of eenheden in het veld.'] },
            { message: 'Dit ingrediënt wordt gemeten in g. Gebruik g of kg.', meaning: 'Je hebt een eenheid van de verkeerde soort gekozen, bijvoorbeeld liters voor iets wat je weegt. Kies een eenheid uit de lijst.' },
            { message: 'Vul de menukaartprijs incl. btw in, bijvoorbeeld 13,50.', meaning: ['De ', b('Menukaartprijs (incl. btw)'), ' van het gerecht is leeg. Typ de prijs die je gast betaalt.'] },
            { message: 'Vul een heel aantal porties in (minstens 1).', meaning: ['Typ in ', b('Porties per bereiding'), ' een heel getal zoals 1 of 4.'] },
            { message: 'Vul een heel getal van 0 of hoger in, of laat dit leeg.', meaning: ['Typ in ', b('Verkocht per maand (optioneel)'), ' een heel getal zoals 300, of maak het veld leeg.'] },
            { message: 'Vul een opbrengst tussen 0,01 en 100 procent in, bijvoorbeeld 100 of 85,5.', meaning: ['Vul in ', b('Rendement %'), ' een getal van 0,01 tot 100 in. Vul 100 in als er niets verloren gaat.'] },
            { message: 'Kies een ingrediënt of basisrecept.', meaning: ['Een regel heeft geen ingrediënt. Open de lijst ', b('Ingrediënt of basisrecept'), ' en kies er een, of klik bij die regel op ', b('Verwijderen'), '.'] },
            { message: 'Sommige velden vragen aandacht. Ze zijn hierboven gemarkeerd.', meaning: 'Scroll omhoog. Bij de velden met een probleem staat een rode tekst. Verbeter ze en druk nog eens op Opslaan.' },
            { message: 'Dit ingrediënt wordt nog in recepten gebruikt en kan niet worden verwijderd.', meaning: ['Je kunt niets verwijderen wat een recept gebruikt. Zie het eind van ', sec('ingredients'), '.'] },
            { message: 'Een basisrecept kan zichzelf niet gebruiken.', meaning: 'Een basisrecept kan zichzelf niet bevatten. Kies een ander ingrediënt of basisrecept voor die regel.' },
            { message: 'De browseropslag is vol. Je gegevens zijn niet gewijzigd.', meaning: ['De browser heeft geen ruimte meer. Maak een reservekopie (', sec('data'), ') en vraag iemand om browserruimte vrij te maken.'] },
            { message: 'Dit bestand bevat geen geldige JSON. Je huidige gegevens zijn niet gewijzigd.', meaning: 'Het bestand dat je koos is geen MenuPilot-reservekopie. Kies het bestand waarvan de naam met menupilot-backup begint. Er is niets gewijzigd.' },
          ],
        },
        { kind: 'h3', text: 'Ik wijzigde een getal, maar het resultaat bleef gelijk' },
        { kind: 'p', text: ['Zoek een rode melding onder het veld. Totdat de invoer is verbeterd, toont de Simulator de laatst geaccepteerde waarden: “Corrigeer de gemarkeerde velden om op te slaan. De resultaten tonen je laatste geldige invoer.”'] },
        { kind: 'h3', text: 'Mijn gegevens zijn weg' },
        {
          kind: 'steps',
          title: 'Wat je kunt controleren',
          steps: [
            { text: 'Blijf rustig en klik niet op “Begin met lege gegevens” of “Terugzetten naar voorbeeldgegevens”: die vervangen alles.' },
            { text: 'Controleer of je dezelfde browser gebruikt (bijvoorbeeld Chrome, niet Edge), dezelfde computer en hetzelfde webadres als eerder, en geen privévenster. De gegevens staan in één browser op één computer.', result: 'Was het een andere browser, open dan die van eerder.' },
            { text: ['Heb je een reservekopiebestand: klik op ', b('Gegevens'), ' en dan op ', b('Reservekopie importeren'), ' en kies het (', sec('data'), ').'], result: 'Je gegevens komen terug zoals ze waren op de dag van de reservekopie.' },
            { text: ['Staat op de pagina “Je gegevens konden niet worden geopend” en “Er is niets gewijzigd of verwijderd”, druk dan nergens anders op. Vraag de persoon die het programma voor je heeft ingesteld om te helpen.'], result: 'Je opgeslagen gegevens staan nog in de browser. Ze waren alleen niet leesbaar.' },
          ],
        },
        { kind: 'p', text: 'Is er geen reservekopie en zijn de browsergegevens gewist, dan zijn de gegevens niet terug te halen. Daarom zijn die paar seconden voor een wekelijkse reservekopie het waard.' },
        { kind: 'h3', text: 'Ik wil op een andere computer werken' },
        {
          kind: 'steps',
          title: 'Zo verhuis je je gegevens',
          steps: [
            { text: ['Op de oude computer: klik op ', b('Gegevens'), ' en op ', b('Reservekopie exporteren'), '.'], result: 'Een reservekopiebestand wordt bewaard.' },
            { text: 'Kopieer het bestand met een usb-stick naar de andere computer, of mail het naar jezelf.' },
            { text: ['Open op de andere computer MenuPilot, klik op ', b('Gegevens'), ' en op ', b('Reservekopie importeren'), ', kies het bestand en klik op ', b('Vervangen door reservekopie'), '.'], result: 'Je gegevens staan er. Vanaf nu bewaren de twee computers aparte kopieën: een wijziging op de ene verschijnt niet op de andere.' },
          ],
        },
        { kind: 'h3', text: 'Op de telefoon is alles klein of ziet het er anders uit' },
        {
          kind: 'steps',
          title: 'Wat helpt',
          steps: [
            { text: 'Draai de telefoon op zijn zij.', result: 'Het scherm is breder en de tekst is makkelijker te lezen.' },
            { text: 'Spreid twee vingers op het scherm om dingen groter te maken.' },
            { text: ['Weet dat op een smal scherm het menu achter de knop ', b('Menu'), ' zit en dat de tabellen kaarten worden: elk gerecht of ingrediënt is een aparte kaart met dezelfde getallen.'] },
            { text: 'Moet je veel gegevens typen, gebruik dan een computer of tablet als dat kan.' },
          ],
        },
        { kind: 'h3', text: 'Het scherm zegt “Er ging iets mis”' },
        {
          kind: 'steps',
          title: 'Wat je doet',
          steps: [
            { text: ['Lees de tekst onder de titel. Die zegt: “Laad de app opnieuw. Je opgeslagen gegevens zijn niet gewijzigd.”'] },
            { text: ['Klik op de knop ', b('Opnieuw laden'), '.'], result: 'Het programma start opnieuw en je opgeslagen gegevens staan er.' },
            { text: 'Komt het weer, onthoud dan wat je net deed en vraag om hulp.' },
          ],
        },
        { kind: 'h3', text: 'De getallen kloppen niet' },
        {
          kind: 'steps',
          title: 'Wat je kunt controleren',
          steps: [
            { text: ['Kijk naar de prijzen van de ingrediënten op de pagina Ingrediënten. Zijn ze zonder btw, zoals op de factuur? Klopt de verpakkingsgrootte (1 kg, niet 1 g)?'] },
            { text: ['Kijk naar ', b('Rendement %'), ' in de regels. 100 betekent dat er niets verloren gaat.'] },
            { text: ['Kijk naar ', b('Porties per bereiding'), ' bij het gerecht. De hoeveelheden in de regels gelden voor de hele bereiding, dus een gerecht dat in een bereiding van vier wordt gemaakt, heeft 4 nodig.'] },
            { text: ['Toont een rij “kosten onbekend”, dan heeft een ingrediënt nog geen prijs. Voeg die toe met ', b('Nieuwe prijs'), '.'] },
          ],
        },
      ],
    },
  ],
};
