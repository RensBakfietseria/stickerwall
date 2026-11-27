# Build 0.12.1 — directe multiselectie en illustratiecorrectie

Basis: vrijgegeven 0.12 (44473dfae2f1942712ee6caee271355e6cb678d9).
Praktijkfeedback: bediening werkt goed; Ctrl+C/V, Ctrl+klik en gezamenlijke verplaatsing gewenst. Interne kopie bevat alleen geometrie, geen portret. Ctrl+D, Backspace/Delete en lagen werken op geselecteerde illustraties; portret kan meebewegen maar niet worden gekopieerd. Alleen individuele schaal/rotatie en bestaande geheel-wezen-schaal blijven. Undo/redo per actie.

Assetrevisie: 92 illustraties, 20 met handmatig begrensde witte onderlaag (axolotl, ogre-oren, flaporen, puntoren, open hand, zwaaihand, wijshand, komhanden, dragende handen, slungelarm, harige poot, vogelklauw, tentakel-krul, uitgestrekte hand, vuist, kikkerhand, vogelvleugels, tentakelstaart, zwemvlies, hoef). Afmetingen en IDs blijven gelijk; 72 ongewijzigd. Geen persoonlijk beeld gebruikt. Correctiepakket versie 2 afzonderlijk lokaal importeren; SHA-256 3f5d14b6968569b1131270874a82de03dd92e70ab315b75401e0b0aae2030d80. Bestaande versie 1 blijft bruikbaar tot import; dezelfde IndexedDB-key wordt pas na succesvolle validatie vervangen. Opgeslagen scènes blijven in dezelfde geometrieversie.

Bestaande lokale updater, portretmodellen en export ongewijzigd. CI moet slagen vóór vrijgave. Assetcorrecties visueel beoordelen bij creatieve composities en print; kleine resterende transparante randen en handmatig afgebakende aansluitingen zijn mogelijk.
