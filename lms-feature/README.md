# Proofcraft — LMS demo

## Run it

You need [Node.js](https://nodejs.org) 20 or newer (it includes `npm`).

```bash
npm install     # once, needs internet
npm run dev
```

Then open http://localhost:5173

The demo starts at the landing page: answer the profile questions, take the one pre-assessment, work through the modules, then the final assessment.
While "Demo access" is on (Profile), a **Demo** button in the top bar jumps to key points in the journey,
any lesson step can be opened, and narration can be skipped.
Everything is stored in the browser, so each laptop/browser starts fresh.
To start over, open Profile and click **Reset ALL prototype data**.

## Other commands

| Command | What it does |
|---|---|
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run audio` | Regenerate narration clips (needs Python 3 with `pip install edge-tts`, and internet). Not needed to run the demo — the clips are already in `public/audio/`. |

## Notes

- Narration plays automatically once you have clicked somewhere on the page. If a lesson is opened directly by URL in a new tab, press play.
- To open the demo from another device on the same network, use `http://<this-laptop's-IP>:5173`.
