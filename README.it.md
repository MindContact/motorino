# motorino

Piccolo motore di giochi 2D in JavaScript puro: moduli ES, nessuna
dipendenza, nessuna build. Uno schermo di 320×180 pixel, un ciclo fisso a
60 Hz e tutto quello che serve a un piccolo platform o a un'avventura: input,
font bitmap, sprite e mappe scritti come testo, fisica con la gravità in
quattro direzioni, dialoghi, menu, salvataggio, PWA.

[English](README.md)

## Installazione

```bash
npm install motorino
```

oppure come submodule git, che è il modo in cui di solito lo porta con sé un
gioco senza build:

```bash
git submodule add https://github.com/MindContact/motorino lib/motorino
```

Nel browser si importa dal percorso (o si mappa `motorino` con una import
map):

```js
import { startLoop, setupScreen, Input } from './lib/motorino/src/index.js';
```

Il suono è facoltativo: motorino non dipende da
[sidicio](https://github.com/MindContact/sidicio); un gioco che vuole l'audio
SID passa `createSidicioNode` di sidicio ad `audio.js`, così sceglie lui la
versione.

## Moduli (`src/`, tutti riesportati da `src/index.js`)

| Modulo | Cosa |
| --- | --- |
| `loop.js` | passo fisso a 60 Hz con accumulatore, un disegno per frame |
| `screen.js` | il canvas 320×180 e il suo ingrandimento per numeri interi |
| `input.js` | tastiera, gamepad, tocco → azioni; `FakeInput` per i test |
| `font.js` | font bitmap 5×7 con le lettere accentate italiane, `wrapText` |
| `sprites.js` | sprite disegnati come testo, precalcolati; specchiati e ruotati |
| `camera.js` | camera con inseguimento morbido, limitata ai bordi, con scossa |
| `particles.js` | particelle decorative con un vettore di gravità |
| `i18n.js` | testi per lingua, `pick({ it, en }, lang)` |
| `states.js` | macchina a stati per la cornice del gioco |
| `storage.js` | salvataggio in localStorage, non lancia mai eccezioni |
| `tilemap.js` | mappe disegnate come testo con una legenda; `TileMap` vivo |
| `physics.js` | `Body` da platform con la gravità in quattro direzioni |
| `dialog.js` | copioni dei dialoghi come testo: battute, scelte, flag, oggetti |
| `progress.js` | flag, inventario, archivio dei testi letti |
| `interact.js` | la cosa utilizzabile più vicina a portata |
| `ui.js` | pannelli, riquadro dei dialoghi, menu a lista (inventario/archivio), finestra sì/no, suggerimento |
| `audio.js` | collegamento al worklet di sidicio; sidicio lo passa il gioco |
| `focus.js` | `watchFocus`: pausa quando la scheda si nasconde o la finestra perde il focus |
| `fullscreen.js` | schermo intero (tasto F in `DEFAULT_KEYS`) |
| `pwa.js` | `registerServiceWorker`: installabile, giocabile offline |

La gravità, il formato dei copioni e le convenzioni sono descritti nel
commento in testa a ogni modulo.

## PWA

Un gioco diventa installabile e si gioca offline con:

* `sw.js` nella sua radice: `importScripts('lib/motorino/pwa/sw.js');`
  (prima la rete; ogni risposta in cache; offline l'ultima copia buona).
* `manifest.webmanifest` e `<link rel="manifest">` nella sua pagina.
* icone dalla pixel art: `node lib/motorino/tools/icon.mjs src/icon.js icons/`
  (32, 180, 192, 512 px; il disegno nei 3/4 centrali, va bene come maskable).
* `registerServiceWorker()` da `src/pwa.js` quando il gioco parte.

Con npm i percorsi partono invece da `node_modules/motorino/`.

## Sviluppo

```bash
npm test          # node --test
npm run demo      # http://localhost:8140/examples/
```

La demo è una stanza della stazione: stivali magnetici (salta contro una
parete o il soffitto e diventa il pavimento), ECO su un terminale, un
fusibile, una porta, l'inventario. Frecce per muoversi, Spazio per saltare, E
per usare, I per l'inventario.

I due README dicono le stesse cose; un test controlla che mantengano la
stessa forma.

Come funziona dentro (loop, input, fisica, dialoghi, widget, suono, PWA) è
in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); ricette, test di un gioco e
regole per le modifiche in [docs/TECHNICAL.md](docs/TECHNICAL.md) (tutti e due
in inglese).

### Pubblicare una versione

1. Aggiornare `version` in `package.json` e fare il commit.
2. `git tag vX.Y.Z && git push origin main vX.Y.Z`.
3. Il workflow `release` esegue i test e mette la versione in attesa su npm
   con il trusted publishing (nessun token nel repository).
4. Approvarla su npmjs.com, scheda *Staged Packages*, con la 2FA. Fino ad
   allora non è pubblica.

## Licenza

[MIT](LICENSE) © MindContact | Roberto Luttino
