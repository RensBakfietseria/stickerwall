# Stickerwall 0.12 — Vrij fantasiebeestenatelier

## Build 0.12 (ontwikkelbranch)

Het vrije atelier staat centraal. Eenmalig laad je het afgeleide `stickerwall-illustratiepakket-0.12.json` (92 PNG's) via Illustratiepakket laden. Dit pakket blijft lokaal in IndexedDB; het kan ook als gelijknamig statisch bestand in `public/` worden geplaatst vóór de build. De SHA-256 wordt gecontroleerd: gebruik het aangeleverde pakket, geen eigen portretfoto's. De oorspronkelijke ZIP blijft de artistieke bron. Bij wissen van browsergegevens moet het pakket opnieuw worden geladen.

Sleep illustraties naar de kaart of klik op een thumbnail. Klik om een onderdeel te selecteren; sleep, gebruik de hoekgrepen om te schalen of de ronde greep om te draaien. Backspace/Delete verwijdert, Ctrl+D dupliceert, Ctrl+Z/Ctrl+Y herstelt. De lagenlijst geeft toegang tot verborgen onderdelen; Hele wezen schakelt groepsverplaatsing en -schaling in. Het portret is een apart onderdeel, ook zonder geladen foto. Bewaar ontwerpen met een niet-persoonlijke naam; de opslag en JSON-export bevatten alleen ontwerpgeometrie, nooit foto's. Kies een ander portret zonder de geometrie te wijzigen. PNG/PDF/A4 gebruiken dezelfde renderer, zonder selectiekaders. De oorspronkelijke A/B/A+-editor is beschikbaar via Referentieatelier.

De echte illustraties worden niet door GitHub gedistribueerd in deze ontwikkelversie; het JSON-pakket wordt afzonderlijk aangeleverd. De stabiele updater mag pas naar deze versie wijzen na technische acceptatie. Fysieke printkwaliteit, artistieke uitsneden en lokale gebruikersacceptatie blijven open.

Vijf tekenvarianten: Contour, Contour+ (BiSeNet + Contour), U²-Net Portrait (met BiSeNet), OpenSketch en Anime. Alle verwerking lokaal op CPU. Geen G'MIC of PyTorch. APDrawingGAN++ blijft onderzocht, niet actief.

## Build 0.11

Het Collectibles-atelier staat centraal: één grote kaart naast de bediening. De oude modelvergelijkingen, testsetbeheer, zwart-witprinter, achterkant, export en drie vergelijkingspanelen zijn inklapbaar. Vergelijkingen worden alleen gerenderd als het paneel open staat. De testportretten heten nu Testportret 1–3; de bestanden blijven op hun bestaande lokale plek.

Negen originele losse transparante illustraties zijn meegeleverd via de updater. Klik Probeer A+ voor een proefcombinatie op het lichte A-lijf of voeg onderdelen zelf toe. Kies een onderdeel en stel schaal, x/y, rotatie en laag in. Achter lichaam en haar, tussen lichaam en hoofd, of voor hoofd en haar. Maximaal zes onderdelen tegelijk. Bewaar per dier/stijl bewaart alleen de compositie- en accessoirewaarden in lokale browseropslag. Geen portretfoto’s. De bestaande A/B-lichamen, kleurroute en exports blijven behouden. A+ is een eerste compositiestudie, geen volledig nieuw getekende lichaamsserie. Lang haar wordt nog niet afzonderlijk gesegmenteerd. Artistieke plaatsing en fysieke printkwaliteit zijn te beoordelen.

## Build 0.10

Sectie 04B: het oorspronkelijke JSON-illustratiepakket uit de stijlstudies A en B wordt automatisch meegeleverd en lokaal geladen. Het bevat acht transparante dierenlichamen en de voorgrondtentakel van B-octopus. De oorspronkelijke tekeningen zijn uitgesneden uit de overzichtsafbeeldingen, niet nagetekend. Het pakket staat in public/ en komt met de gewone updater mee. Optioneel kan een ander pakket lokaal worden geïmporteerd; de browseropslag bevat dan dat illustratiepakket en expliciet bewaarde compositievoorkeuren (geen portretten, logo's of kaartresultaten). Met Herstel standaardillustraties wordt het gebundelde pakket opnieuw geladen. Bij het wissen van browsergegevens zijn de originele illustraties nog steeds beschikbaar.

Gebruik 'Maak kaarten van vaste testset' en kies één testportret. Acht lichamen naast elkaar in A/B-paren, bestaande kaartontwerpen en export behouden. Hoofdgrootte 75–180%, horizontaal/verticaal, rotatie ±20°, zes kleurpaletten en een optionele voorgrondtentakel op B-octopus. Volledige compositie past binnen het illustratievak; de verhoudingen blijven behouden. Bewaar expliciet per dier/stijl. Terug naar 'Bestaand lijf (0.9)' blijft mogelijk. De kleurroute en protocol 9 zijn ongewijzigd. Geen extra modelgewichten. Artistieke kwaliteit, daadwerkelijke afdrukresolutie van de uitgesneden illustraties en fysieke proefdruk moeten nog worden beoordeeld.

## Build 0.9

Sectie 04: maak kaarten van de vaste testset of huidige foto. Alleen AnimeGANv2 en BiSeNet worden gebruikt voor de kleurroute. De nieuwe segmentatie gebruikt een gezicht-gebonden envelop, kleine morfologische filters en geen grote opgevulde gaten tussen haar en hals. De strakke uitsnede en kinpositie houden de collage op schaal; de oudere zwart-witroute blijft ongewijzigd. Foutieve segmentatie blijft mogelijk, vooral bij lastig haar of te kleine gezichten.

Atelier, Club en Archief met zwart-wit dierenlijf of kleuraccent; zes previews en drie profielen. De bestaande dieren zijn technische illustratieprototypes. Achterzijde met lokaal PNG/JPG/WebP-logo, naam en korte tekst. Logo en kaartresultaten blijven in geheugen. Export door expliciete download, geen automatische opslag.

Tradingcard 63 x 88 mm (744 x 1039 px) en 100 x 150 mm (1181 x 1772 px), PNG pHYs 300 ppi. PDF: twee exact gedimensioneerde pagina's, lossless RGB raster. A4: zes tradingcards (testportretten herhaald) of één grote kaart, twee zijden met snijtekens en gespiegeld geplaatste achterkant voor lange-zijde duplex. Print op ware grootte. Geen afloop; dit is een interne proefdruk, geen drukkerij-PDF/X of CMYK. Controleer fysieke dubbelzijdige uitlijning, kleur, papier en snijden. Geen nieuwe modelgewichten, geen printerroutering. Licenties van modelgewichten nog niet commercieel gevalideerd.

## Build 0.8

Het aparte Cartoon First-ontwikkellab (03C) bewaart uitsluitend expliciet ingestelde testuitsneden in de lokale Windows-map `%LOCALAPPDATA%\Stickerwall\testset` (buiten de projectmap) (drie vaste 512 × 576 PNG's). Geen namen of EXIF; geen gewone bezoekersfoto's. De map valt buiten de updater, git en de webroot. Laad de drie testfoto's één keer, of bewaar een handmatig gekadreerde huidige uitsnede. Daarna 'Vergelijk alle drie'. Testfoto's worden bij herladen opgehaald van de loopbackserver en blijven op schijf totdat je 'Wis testfoto' kiest. Bewaar alleen foto's met toestemming; gewone Windows-bestandsbeveiliging, geen versleuteling in deze prototypebuild. Resultaten blijven in geheugen. Gebruik geen synchronisatiemap. Testmodus is geen bezoekersfunctie.

Twee nieuwe ONNX-gewichten (samen ca. 24 MB): Photo2Cartoon (minivision-ai, gepinde kopie LiteraturePro/Photo2cartoon) en AnimeGANv2 face_paint_512_v2 (bryandlee/Kazuhito00). Beide gebruiken RGB NCHW [-1,1], respectievelijk 256 en 512 vierkant met witte padding en de bestaande BiSeNet-uitsnede. Photo2Cartoon gebruikt dus niet de oorspronkelijke landmarkrotatie en segmentatie; model en voorbewerking zijn experimenteel. Oorspronkelijke hoofdvorm wordt gehandhaafd. Elke kleurcartoon gaat naar U² Sticker (180/0) en naar directe grijswaardedrempel (145/0) met dezelfde natuurlijke buitenlijn. De huidige U² Adaptief (180/0/1/1) is de vaste referentie. Geen automatische kwaliteitsclaim. De drie foto's worden sequentieel verwerkt; de oude vergelijker blijft beschikbaar. Modellicenties en trainingsdata nog niet commercieel gevalideerd. Photo2Cartoon is getraind op een beperkte doelgroep; herkenbaarheid kan per gezicht verschillen.

Bronnen:
- https://github.com/minivision-ai/photo2cartoon
- https://github.com/LiteraturePro/Photo2cartoon/tree/0a53ec1c5922e46127c00faca6cf8724324ea724
- https://github.com/Kazuhito00/AnimeGANv2-ONNX-Sample/tree/1597c3ad45b2db87e1ac4944ee62cfdb30d0670d

## Build 0.7

Sticker blijft ongewijzigd en standaard geselecteerd. Adaptief gebruikt de bestaande BiSeNet-labels uit dezelfde segmentatie: haar/hoed (rood), ogen, wenkbrauwen, bril, neus, mond en lippen (groen), beschermde buitenrand (blauw). De kaart is zichtbaar onder de oude referenties. Geen tweede AI-inferentie of nieuwe modellen. Afwerking op 226 × 252: in haar kan alleen bestaande Sticker-inkt worden verwijderd; in gezichtsdetails kan alleen een bestaande zwakke rand naast inkt worden versterkt. Buitenrand en alpha blijven gelijk; overige regio's blijven Sticker. Twee schuiven 0–2 (standaard 1) regelen haar en gezicht apart. Beide op nul reproduceert Sticker exact. Bij ontbrekende kaart blijft Sticker beschikbaar, Adaptief niet. Het is een experimentele afwerking, geen garantie op betere expressie. Test dezelfde drie portretten en fysieke prints lokaal.

## Build 0.6

Eén U²-Net-inferentie geeft drie grafische afwerkingen: Basis (de 0.5-afdruk), Bold (hogere drempel en één pixel verdikking), Sticker (selectieve lokale contrastversterking, zwakke randpixels naast inkt behouden, losse zwarte componenten kleiner dan drie pixels verwijderen). De drie afwerkingen worden in de browser op 226 × 252 punten gemaakt en behouden exact hetzelfde hoofdmasker. De voorkeursproef is Sticker; dit is een ontwerpkeuze, geen bewezen kwaliteitswinnaar. Basis kan ook de oorspronkelijke U²-modeluitvoer met natuurlijke contour tonen. De algemene drempel en lijndikte zijn relatieve aanpassingen; de resetknop herstelt 180/0. De oude modellen blijven optioneel via het selectievak. Geen nieuwe modelbestanden of pakketten. Detailinjectie uit andere modellen is geparkeerd: eerst de drie gecontroleerde afwerkingen vergelijken.

## Toekomstige updates

Stop de lokale server met Ctrl+C. Open PowerShell in de bestaande Stickerwall-map:

```powershell
.\update.cmd
```

De updater haalt de vaste GitHub-branch `stickerwall-local-stable` op, gepind op de commit bij het begin van de update. Alleen op verzoek, nooit tijdens beeldverwerking. Geen Git nodig. Releasebeheer: deze branch uitsluitend naar een geteste commit verplaatsen; geen experimentele builds automatisch vrijgeven.

De bestaande Python-omgeving, modellen en andere niet-beheerde bestanden blijven behouden. Gewijzigde dependencylijsten activeren de betreffende package-installatie. Bij een fout worden de vorige bronnen en websitebuild hersteld; gewijzigde dependencies worden niet automatisch teruggedraaid. De GitHub-releasecode is niet afzonderlijk ondertekend. Bewaar eigen wijzigingen buiten de beheerde bronbestanden. Start daarna met `local_portrait/start.ps1`.

## Bestaande Windows-installatie 0.3 bijwerken

1. Stop de lokale server in PowerShell met Ctrl+C.
2. Download deze ontwikkelbranch als ZIP en pak hem uit. Installeer **niet**
   vanuit de nieuw uitgepakte map.
3. Open PowerShell in de uitgepakte 0.4-map. Voer uit:

```powershell
powershell -ExecutionPolicy Bypass -File .\local_portrait\update-from-03.ps1 -TargetRoot "C:\stickerwall-stickerwall-0-3-local-portrait-compare"
```

Pas het doelpad alleen aan als jouw huidige 0.3-map ergens anders staat.
De updater kopieert een beperkte lijst bronbestanden en voert setup uit in de
**bestaande map**. De geïnstalleerde Python-omgeving, node_modules en
OpenSketch-gewichten blijven behouden. Setup downloadt alleen de twee nieuwe
modellen (samen ongeveer 35,9 MB), of herstelt ontbrekende bestanden.

Open daarna PowerShell in de bestaande doelmap en start:

```powershell
powershell -ExecutionPolicy Bypass -File .\local_portrait\start.ps1
```

Open in Chrome/Edge http://127.0.0.1:8765/stickerwall.html . Vernieuw indien
nodig met Ctrl+F5 en controleer het versienummer 0.4.

## Nieuwe installatie

Python 3.11 en Node.js 22+ zijn vereist. Gebruik een korte mapnaam direct op
C: (bijvoorbeeld C:\Stickerwall), om Windows-padlengteproblemen te voorkomen.

```powershell
powershell -ExecutionPolicy Bypass -File .\local_portrait\setup.ps1
powershell -ExecutionPolicy Bypass -File .\local_portrait\start.ps1
```

Setup hergebruikt de drie vastgepinde Informative Drawings-modellen en downloadt eenmalig BiSeNet ResNet18 (53 MB) en U²-Net Portrait (176 MB). De releases worden gecontroleerd op bestandsgrootte en hash. Geen installatie van
G'MIC, PyTorch of andere portretsoftware. Na installatie kan internet uit.

## Kwaliteitstest

- Kies een onbewerkte portretfoto. De originele uitsnede (512 x 576) staat
  naast de drie resultaten. Zoom en verschuif totdat het hoofd goed staat.
- Klik 'Maak drie U²-afwerkingen'. Vink desgewenst de oude referenties aan. De hoofdsegmentatie en U² draaien eenmaal per aanvraag; de afwerkingen draaien in de browser. Het geïsoleerde hoofd laat de BiSeNet-voorbewerking zien.
  Er is maximaal één model-sessie tegelijk.
- Bekijk de tekening met 'Modeluitvoer'. De oude stijlen kunnen een ovaalmasker krijgen. Contour+ en U²-Net krijgen altijd het natuurlijke hoofdmasker en een expliciete buitenlijn.
- 'Zwart-witdruk' toont een echte tweekleurige versie. Drempel en lijndikte
  werken direct in de browser, zonder opnieuw inferentie.
- 'Gebruik op sticker' plaatst altijd de zwart-witlaag op het gekozen
  dierenlichaam (226 x 252 printerpunten binnen de bestaande 552-punts
  compositie). Het ovaalmasker werkt ook op die laag.
- De oude browserfilters blijven behouden. G'MIC wordt in 0.4 niet gestart.
- Het wijzigen van de foto of uitsnede wist oude resultaten. De knop
  'Verwijder foto' verwijdert portretdata uit de actieve sessie.

## Privacy en beperkingen

De browser stuurt uitsluitend de gekozen uitsnede naar de lokale HTTP-server
op 127.0.0.1:8765. De server verwerkt pixels in geheugen; er zijn geen
uitgaande API-aanroepen, tijdelijke portretbestanden of fotogalerij.
De server bewaart geen requestlog. De browser heeft een restrictief CSP en
weigert redirects voor modelrequests. De portretvergelijking werkt alleen
met protocolversie 9 op de lokale server, niet op een externe Vercel-host.
Dit is ontwerp en technische test, geen volledige privacy- of securityaudit.
Gebruik een eigen onbewerkte foto om de artistieke kwaliteit te beoordelen.

Modelbron: [Informative Drawings](https://github.com/carolineec/informative-drawings)
en [ONNX-conversie](https://github.com/Kazuhito00/Informative-Drawings-ONNX-Sample).
De oorspronkelijke code en de conversie hebben een open-sourcelicentie;
controleer afzonderlijk de rechten op gewichten/trainingsdata vóór verspreiding
of commercieel gebruik. Zie [APDRAWINGGAN.md](APDRAWINGGAN.md) voor de
onderzochte vervolgrichting en waarom die nog niet actief is.

## Nieuwe modelbronnen en grenzen (0.5)

- BiSeNet ResNet18: https://github.com/yakhyo/face-parsing (MIT-code, CelebAMask-HQ-data). Exacte release-hash gecontroleerd. Klassen 1–13 en 17–18 behouden; achtergrond, hals en kleding uitgesloten. Grootste verbonden hoofdregio, kleine gaten gesloten; geen herkennings/identiteitsmodel.
- U²-Net Portrait: https://github.com/xuebinqin/U-2-Net ; bestaande PyTorch-naar-ONNX-export https://github.com/cocoa-xu/U-2-Net/releases/tag/onnx-20230530 . Gebruik de eerste uitgang, inversie en min-max normalisatie zoals de oorspronkelijke portrettest. Dit model is niet het algemene U²-Net achtergrondmodel.
- Beide nieuwe routes krijgen een witte achtergrond vóór inferentie en een transparante natuurlijke hoofdvorm na inferentie. Een gecontroleerde binnenrand wordt toegevoegd; dus geen zuivere ongefilterde modeluitvoer. Dit is een kwaliteitsproef, geen gegarandeerd perfect haar- of brillenmasker. Handmatig kadreren blijft nodig.
- CelebAMask-HQ en APDrawing-trainingsdata hebben mogelijke niet-commerciële beperkingen. Deze build is uitsluitend bedoeld voor interne kwaliteitsproeven; controleer gewichten en datalicenties vóór commerciële inzet of verspreiding.
- APDrawingGAN++ is niet opgenomen: checkpoint, preprocess en Windows CPU nog niet gevalideerd. Zie APDRAWINGGAN.md. Geen andere engine wordt als APDrawingGAN gepresenteerd.
