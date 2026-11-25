# Stickerwall 0.6 — U² Focus

Vijf tekenvarianten: Contour, Contour+ (BiSeNet + Contour), U²-Net Portrait (met BiSeNet), OpenSketch en Anime. Alle verwerking lokaal op CPU. Geen G'MIC of PyTorch. APDrawingGAN++ blijft onderzocht, niet actief.

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
met protocolversie 6 op de lokale server, niet op een externe Vercel-host.
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
