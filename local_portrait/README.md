# Stickerwall 0.4 — Artistiek Portretlab

Drie bestaande Informative Drawings ONNX-modellen (OpenSketch, Contour, Anime).
Alle verwerking vindt op de eigen CPU plaats. G'MIC is geparkeerd na de
Windows Smart App Control-blokkade. APDrawingGAN is nog geen actieve engine.

## Bestaande Windows-installatie 0.3 bijwerken (aanbevolen)

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

Setup downloadt de drie vastgepinde modellen van Kazuhito00's ONNX-conversie
met controle van Git blob-hash en bestandsgrootte. Geen installatie van
G'MIC, PyTorch of andere portretsoftware. Na installatie kan internet uit.

## Kwaliteitstest

- Kies een onbewerkte portretfoto. De originele uitsnede (512 x 576) staat
  naast de drie resultaten. Zoom en verschuif totdat het hoofd goed staat.
- Klik 'Vergelijk de drie AI-stijlen'. De drie bestaande gewichten worden
  sequentieel met dezelfde RGB-uitsnede en ONNX Runtime CPU verwerkt.
  Er is maximaal één model-sessie tegelijk.
- Bekijk de ruwe uitvoer met 'Origineel model'. Schakel het ovaalmasker uit
  om de volledige hoofdcontour te zien.
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
met protocolversie 4 op de lokale server, niet op een externe Vercel-host.
Dit is ontwerp en technische test, geen volledige privacy- of securityaudit.
Gebruik een eigen onbewerkte foto om de artistieke kwaliteit te beoordelen.

Modelbron: [Informative Drawings](https://github.com/carolineec/informative-drawings)
en [ONNX-conversie](https://github.com/Kazuhito00/Informative-Drawings-ONNX-Sample).
De oorspronkelijke code en de conversie hebben een open-sourcelicentie;
controleer afzonderlijk de rechten op gewichten/trainingsdata vóór verspreiding
of commercieel gebruik. Zie [APDRAWINGGAN.md](APDRAWINGGAN.md) voor de
onderzochte vervolgrichting en waarom die nog niet actief is.
