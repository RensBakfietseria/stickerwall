# Sticky Wall — lokale portretvergelijking (Build 0.3)

Dit is een **uitbreiding van de bestaande Proefatelier-pagina**, geen tweede site. Het toont op dezelfde onbewerkte portretfoto de resultaten van:

- **G'MIC Line Art**: de originele `cl_lineart`-filter van Claude Lion.
- **Informative Drawings**: een bestaand voorgetraind model, via ONNX Runtime **CPU**.
- De bestaande drie lichte browserfilters blijven beschikbaar als referentie.

**Geen cloudportretten.** De lokale browser gebruikt alleen `http://127.0.0.1:8765/stickerwall.html`. Alleen wanneer de gebruiker expliciet op "Vergelijk" klikt, wordt een **512×576 uitsnede als PNG naar dezelfde lokale computer** verstuurd. Het ONNX-model draait in lokaal geheugen. G'MIC gebruikt tijdelijk een input/output-PNG in de besturingssysteemtempmap; die map wordt direct na verwerking verwijderd. Er is geen gallery, cloud-AI, API-key, fotolog of persistente opslag. De code blokkeert gebruik van de AI-vergelijking op een publiek gehoste pagina. De webserver is uitsluitend op loopback gebonden, controleert Origin/Host en accepteert alleen een beperkt PNG-formaat.

## Eenmalig installeren (Windows)

Nodig: **Python 3.11/3.12** (bij voorkeur 3.11) en **Node.js 22 of nieuwer**. Open PowerShell in deze Stickerwall-repository:

```powershell
powershell -ExecutionPolicy Bypass -File .\local_portrait\setup.ps1
```

Dit maakt `.local-portrait-venv`, installeert `Pillow`, `numpy` en `onnxruntime`, downloadt eenmalig twee specifieke assets met controle op Git blob SHA, voert `npm ci` uit en bouwt de aparte Stickerwall-pagina. De model- en filterscripts blijven onder `local_portrait/assets/` en worden **niet naar GitHub gepusht**.

De installer haalt ook de **officiële G'MIC 4.0.8 Windows CLI** op en controleert het bestand vóór het uitpakken. Er is dus geen losse GIMP-plugin of handmatige PATH-aanpassing nodig. De uitgepakte CLI staat in `.local-portrait-bin/` (niet in Git).

Als je al een eigen G'MIC-installatie hebt, kun je deze desgewenst expliciet instellen:

```powershell
$env:STICKERWALL_GMIC="C:\pad\naar\gmic.exe"
```

Na installatie heb je voor de verwerking van portretten geen internet meer nodig.

## Elke volgende keer starten

```powershell
powershell -ExecutionPolicy Bypass -File .\local_portrait\start.ps1
```

Open: <http://127.0.0.1:8765/stickerwall.html> (Chrome of Edge).

1. Kies een **onbewerkte** portretfoto, bij voorkeur van voren met rustige achtergrond.
2. Verschuif/vergroot het hoofd zoals eerder in het Hoofdlab.
3. Klik **Vergelijk G'MIC en Informative Drawings**.
4. Bekijk de **echte** resultaten naast elkaar. Kies een van beide met **Gebruik op sticker** om dezelfde tekening op axolotl, draak of pinguïn te zien.
5. Verandert de uitsnede of de foto, dan vervalt de eerder gemaakte vergelijking en kun je opnieuw testen.

**Eén route niet beschikbaar?** De fout wordt zichtbaar in de betreffende kolom. Er wordt niet stilletjes teruggevallen op een ander filter.

## Offline/veiligheid controleren

1. Voltooi eenmalig de downloads en installatie als je internet hebt.
2. Schakel wifi én kabelinternet uit.
3. Start het Proefatelier op `127.0.0.1` en vergelijk een echte foto.
4. Controleer of geen bestanden achterblijven in `local_portrait/assets/` behalve de installatiebestanden. De temp-PNG's van G'MIC moeten na iedere taak verdwenen zijn.
5. De lokale server logt geen afbeeldingen, bestandsnamen of requestinhoud. Controleer voor een publieke installatie ook netwerkactiviteit, OS-tempbestanden en Windows crash-rapportage met een onafhankelijke audit.

De publieke Vercel-kijkdemo laadt alleen frontendcode; de extra AI-vergelijkingsknop staat daar **uit**. Test geen echte foto's via onbeheerde publieke servers.

## Afhankelijkheden en licenties

- G'MIC command-line: <https://gmic.eu/>. Claude Lion `cl_lineart`, <https://github.com/GreycLab/gmic-community/blob/master/include/claude_lion.gmic>; bron vermeldt CeCILL/CeCILL-C. Commerciële distributie van G'MIC en bundeling van de filter vragen een aparte licentiebeoordeling.
- Informative Drawings: <https://github.com/carolineec/informative-drawings>, onderzoeksproject en MIT-broncode. Deze build gebruikt de vooraf geconverteerde `opensketch_style_512x512.onnx` van <https://github.com/Kazuhito00/Informative-Drawings-ONNX-Sample>; controleer rechten van **modelgewichten**, eventuele derde-partijdata en afhankelijkheden voordat de installatie commercieel verspreid wordt.
- De downloadcode pint beide downloads op een specifieke publieke commit en controleert de exacte Git blob SHA; zie `download_assets.py`.
- Origin- en payloadbeperkingen verlagen risico's, maar vormen geen volledige beveiligings- of AVG-audit.

## Validatie en beperkingen

- Automatische lokale tests: `python -m unittest discover -s local_portrait -p "test_*.py"`
- Vite-build: `npm run stickerwall:build`
- Echte model-inferentie, G'MIC-versiecompatibiliteit, gebruiksduur en afdruk moeten nog **op jouw Windows-laptop** worden gecontroleerd.
- De uitsnede is nog handmatig; de bestaande ovaalmaskering blijft. Er is geen automatische haarvrijstelling of gezichtslandmarks. Dit is juist een objectieve eerste kwaliteitsvergelijking, geen definitieve installatie.
