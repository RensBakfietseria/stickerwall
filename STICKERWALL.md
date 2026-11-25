# Stickerwall 0.3 — Proefatelier + lokaal Hoofdlab

**Bestaande pagina, geen nieuwe app.** Deze ontwikkelbranch bouwt verder op de oorspronkelijke Photoboot-fork en de Proefatelier-versies 0.1/0.2. Het Hoofdlab ondersteunt nu ook vergelijking van **G'MIC Line Art** en **Informative Drawings ONNX**, beide op een lokale Windows-computer.

- **Installatie en bediening:** [local_portrait/README.md](local_portrait/README.md)
- **Pagina:** `stickerwall.html` (door de Python-server lokaal geserveerd op `http://127.0.0.1:8765/stickerwall.html`)
- **Server en modeluitvoering:** `local_portrait/server.py`, `local_portrait/processing.py`
- **Bestaande dieren, complimenten, naamgeneratie en printercode blijven behouden.**
- **Privacy:** geen cloud-AI, geen fotogalerij, geen persistente foto-opslag; alleen de lokale browser en loopback-API. De modelassets worden eenmalig zonder echte foto's gedownload. G'MIC gebruikt tijdelijke PNG's die automatisch worden opgeruimd.

De openbare Vercel-kijkdemo is **niet** de lokale AI-installatie: op externe hosts is de knop voor G'MIC/ONNX uitgeschakeld. Voor echte foto's gebruik je uitsluitend de lokaal gestarte versie.

De oorspronkelijke Photoboot-broncode bevat andere pagina's met galerij-/deelroutes; gebruik voor Sticky Wall uitsluitend de aparte `vite.stickerwall.config.ts`-build en **niet** de algemene Photoboot-server.

**Status:** bestaande website- en Python-tests zijn geautomatiseerd; de daadwerkelijke portretkwaliteit en thermische afdruk op de doelhardware vergen nog tests met onbewerkte foto's. De licenties van G'MIC, de originele Claude Lion-filter en de Informative Drawings-modelgewichten moeten vóór commerciële verspreiding afzonderlijk beoordeeld worden.

Gebaseerd op Photoboot van Marijn van de Voorde (MIT); behoud de oorspronkelijke LICENSE bij hergebruik.
