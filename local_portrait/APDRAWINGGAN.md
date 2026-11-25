# APDrawingGAN — integratieonderzoek bij Build 0.4

**Status: niet geïnstalleerd of geïntegreerd.** Er is geen werkende
APDrawingGAN-knop en er wordt geen ander model onder die naam getoond.

De 2019-versie ([code en modelinstructies](https://github.com/yiranran/APDrawingGAN))
is beschikbaar onder Apache-2.0 voor de code, maar de gepubliceerde
installatieroute vermeldt Linux/macOS, Python 2.7 en PyTorch 0.4+.
De gewichten zijn een afzonderlijke download. De originele testcode verwacht
niet alleen een afbeelding maar ook een vijfpunts-gezichtslandmarkbestand,
een uitgelijnde 512 x 512 afbeelding en een foreground/background-masker.
De
[preprocessing-instructies](https://github.com/yiranran/APDrawingGAN/blob/master/preprocess/readme.md)
gebruiken MTCNN, een MATLAB-uitlijningsfunctie en een apart segmentatiemodel.

De [APDrawingGAN++-repository](https://github.com/yiranran/APDrawingGAN2)
vraagt extra hulpnetwerken en voorbereide maskers. De gepubliceerde
checkpoint-downloads lopen via BaiduYun/YandexDrive. In dit onderzoek is
geen vertrouwde, kant-en-klare Windows/ONNX-inferentie gevonden die ook
de noodzakelijke preprocessing lokaal afhandelt. De feitelijke checkpoints
zijn niet opgehaald of gevalideerd; de rechten op gewichten/trainingsdata
moeten ook nog worden gecontroleerd. De code-licentie alleen is daarvoor
onvoldoende. De online demo is géén route voor privéportretten.

## Besluit voor deze build

- Laat de werkende Python 3.11 + ONNX-omgeving intact.
- Geen extra zware PyTorch/MATLAB-installatie, geen externe gezichtsservice
  en geen veiligheidsinstellingen wijzigen.
- Voeg APDrawingGAN pas toe na een onafhankelijke lokale proef:
  1. verifieer bron, checkpoint en licentie;
  2. voer het gepubliceerde model op een publieke/synthetische referentie uit;
  3. reproduceer landmarkuitlijning en segmentatie volledig lokaal;
  4. moderniseer de inferentie of exporteer naar ONNX en vergelijk de
     uitvoer met de originele implementatie;
  5. benchmark Windows CPU/RAM, vervolgens invoegen in het bestaande lab.

Een mogelijk vereenvoudigd alternatief voor die aparte proef is
[U²-Net Portrait](https://github.com/xuebinqin/U-2-Net), een ander model
getraind op APDrawing-data. Dat is nadrukkelijk **niet** APDrawingGAN; de
modelgewichten en eventuele niet-commerciële datasetvoorwaarden moeten
eerst worden beoordeeld. Dit model is niet toegevoegd aan 0.4.
