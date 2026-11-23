# Stickerwall 0.1 — veilige technische proef

Deze proefversie is een **afzonderlijk entrypoint** in de Photoboot-fork. De bestaande Photoboot blijft op main staan. Deze versie gebruikt een **fictief getekend gezicht** en drie technische dieren-plaatsaanduiders. De uiteindelijke AI-portretmodule en echte dierenillustraties zijn **nog niet gebouwd**.

## Zelf lokaal starten (Windows)

1. Installeer Node.js 22 of nieuwer als dat nog niet aanwezig is.
2. Open een terminal in de repository en voer uit:
   - npm ci
   - npm run stickerwall:dev
3. Open http://127.0.0.1:5174/stickerwall.html in Chrome of Edge.
4. Kies maximaal drie kwaliteiten en wissel tussen axolotl, draak en pinguïn. De voorvertoning is het 1-bit resultaat op 552 printerpunten breed.
5. Een geschikte Bluetooth-printer koppelen is optioneel; printen met de nieuwe Stickerwall-route moet nog op echte hardware worden gevalideerd.

### Production build zonder uploadroutes

Voer npm run stickerwall:build uit. Alleen de Stickerwall-pagina wordt in dist-stickerwall gebouwd. Bekijk lokaal met npm run stickerwall:preview op http://127.0.0.1:4174/stickerwall.html. Gebruik **niet** de algemene Photoboot-server of een publiek clouddeployment als privacybewijs.

## Privacygrens

- Er is **geen camerafunctie**, en de proef verwerkt geen echte gezichtsfoto's.
- Er is geen fotogalerij, IndexedDB-fotoarchief, analytics, cloud-AI of uploadfunctie in deze nieuwe pagina.
- De specifieke Vite-config laadt **niet** de Photoboot shareMiddleware.
- De originele bestanden van Photoboot (inclusief gallery/share API) staan nog in de fork, maar horen niet bij de aparte Stickerwall-build. De originele Photoboot-pagina mag niet als privacyveilige Stickerwall worden ingezet.
- Laat een technisch onderzoek controleren dat de uiteindelijke installatie, inclusief lokaal AI-model en browser, geen beelddata verlaat. Dit prototype is nog geen volledige AVG-audit.
- De uiteindelijke camera-integratie moet toestemming, annulering en sessiewissing afdwingen; niets uit een gezichtssessie mag naar een externe AI/server.
- De browser kan bij het starten lokaal scripts/assets via 127.0.0.1 ophalen. Voor de uiteindelijke installatie zijn netwerkisolatie, logging en volledige offline test verplicht.

## Gebruik van bestaande Photoboot-code

De applicatie importeert de originele printmodules:
- src/photo.ts: printPhoto()
- src/printers/index.ts: connectPrinter()
- src/raster.ts: canvasToRaster() en rasterToCanvas()
- src/types.ts: Raster

De stijlillustratie is een placeholder (src/stickerwall/artwork.ts). Er wordt geen fotografisch filter gebruikt om het hoofd te tekenen.

## Volgende fase

1. Technische tests en werkelijke testprint.
2. Professionele zwart-wit dierenbibliotheek aanleveren en compositie met aansluitpunten maken.
3. Afzonderlijk lokaal AI-model voor vrijstaand herkenbaar hoofd onderzoeken.
4. Privacyveilig cameratoestemmingsscherm en volledige sociale kwaliteitenflow bouwen.

Gebaseerd op Photoboot © Marijn Van de Voorde, onder MIT-licentie: behoud de originele LICENSE bij hergebruik.
