# Forma · Portfolio

En statisk portfolio för GitHub Pages. Hela webbplatsen ligger i arkivets rot och fungerar även under en sökväg som `/forma-portfolio/`.

## Publicera

Lägg filerna i ett GitHub-arkiv med grenen `main`. Öppna **Settings → Pages**, välj **Deploy from a branch** och ange `main` och `/(root)`. GitHub visar sidans adress när publiceringen är klar.

## Uppdatera innehållet

1. Öppna portfolions webbadress med `?redigera=1` i slutet.
2. Lägg till eller redigera ett projekt. Under **Om** kan du ändra presentationen.
3. Klicka på **Ladda ned portfolio.json** efter ändringarna.
4. Ersätt `portfolio.json` i arkivets rot på grenen `main` med den nedladdade filen och välj **Commit changes** på GitHub. Använd exakt filnamn.
5. När GitHub Pages har publicerat ändringen syns den på den vanliga webbadressen.

Redigeringsvyn skapar ett lokalt utkast. GitHub kontrollerar vem som får spara filen i arkivet och därmed publicera ändringen. Börja en ny redigering först när föregående version har publicerats, så att utkastet utgår från de senaste projekten.
