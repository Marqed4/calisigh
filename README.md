<div align="center">
  <br/>
  <p>
    <img src="frontend/src-tauri/icons/128x128.png" title="Calisigh" alt="Calisigh logo" width="100" />
  </p>

  <h1>𝐶𝑎𝑙𝑖𝑠𝑖𝑔ℎ</h1>
  <p>A feature‑rich Midwestern-emo calendar </p>

  <p>
    <a href="https://marqed.it/Calisigh">🌐 Visit us & learn more</a>
  </p>
  <br/>
</div>
<div align="center">
  Open it, add your events, choose your themes, and self-loath...
</div>

---

<h2 align="center">Views</h2>

| | |
|---|---|
| <p align="center"><strong>View by month</strong><br/>The classic grid. Your chaos arranged into neat little boxes.</p> | <p align="center"><strong>View by year</strong><br/>A full year on one screen. It feels bigger when you see it all at once.</p> |
| <p align="center"><img src="examples/View%20by%20Month.png" /></p> | <p align="center"><img src="examples/View%20by%20Year.png" /></p> |
| <p align="center"><strong>Teen spirit AI chatbot</strong><br/>She has thoughts about your schedule and isn't subtle about them.</p> | <p align="center"><strong>Settings and themes</strong><br/>Change the look and feel until it matches whatever mood you are in.</p> |
| <p align="center"><img src="examples/Chat%201.png" /></p> | <p align="center"><img src="examples/Settings%20Background%20Change.png" /></p> |

---

<h2 align="center">Features</h2>

<div align="left">

- **Melodramatic event management**  
  Create, edit, and delete events with more emotion than the situation requires. Repeat an event weekly or yearly until a date you pick, attach a picture to it, and snooze the alarm for 5 or 10 minutes when it goes off.

- **Month, week and year views**  
  Switch with the buttons or the keys `M`, `W` and `Y`. Arrow keys step through time, `T` jumps to today, and Ctrl plus, minus and 0 zoom every window.

- **Search that lights up the calendar**  
  Press Ctrl+F or `/` and type. The search reads titles, notes, times and dates, so `interview`, `9:30 pm`, `nov` or `thursday` all work, and several words must all match. Open Filters to limit by date range or time of day. Every day with a match is outlined in amber in the month view, matching events are outlined and the rest fade, and the list shows how many events matched. Esc clears it.

- **Money stands out**  
  A currency symbol followed by a number (`$50`, `$1,250.50`, `€20`, `$5k`) is highlighted in event titles and details, live as you type in the add-event window and the chat box (web links get coloured too), with a running total under the description. The search list adds up the amounts in the events it found, and the chat assistant is given the same totals so it can answer "how much am I spending this week?" without doing shaky math.

- **Teen spirit AI chatbot**  
  A 19‑year‑old from the Midwest who comments on your calendar like it’s a diary you left open. Every so often she suggests an event, and one click puts it on your calendar. She runs on [Ollama](https://ollama.com) on your own computer, so your schedule never leaves it. Ask her to change or delete an event and she offers a button for that too, and nothing touches your calendar until you press it. Past conversations are saved, and a date range in the sidebar limits which events she can see.

- **Pick your own AI model**  
  Llama 3.2 is the default, but the chat works with any model Ollama can run. Switch models from the chat window, or type a model name like `mistral` or `gemma2:9b` to download another one. Bigger models are smarter and slower, so choose what your computer can handle.

- **Bookmarks and event presets**  
  Star any event to bookmark it, then jump back to it from the sidebar. Make presets for kinds of events (Class, Gig, Birthday) with a default colour, font, title and text, and pick one when you add an event.

- **Links in event details**  
  Web addresses in an event's text are clickable. The chat assistant adds map and search links when it suggests an event.

- **Attach files to the chat**  
  Use the paperclip to give the assistant a text file (txt, md, csv, json, ics) or a picture (png, jpg). The model you picked does the reading, so pictures only work with a vision model such as `llama3.2-vision`, `gemma3` or `llava`. PDF and Word files are not supported.

- **Customizable backgrounds, fonts, alert sounds, and more!**  
  Your calendar should look and sound like the mood you are in. Pick any font installed on your computer, choose a finish (matte, metallic, plastic, stone, stainless, shimmer, sparkle or glass), a trim colour and an accent colour, or start from a ready-made theme. Cells can be blurred or see-through, soft or sharp.

</div>

---

<h2 align="center">Ethics</h2>

Calisigh takes zero liability for your pointless events. Your choices are yours to carry.

---

<h2 align="center">Contributing</h2>

- If you're considering contributing to Calisigh, first of all, thank you!  
- Check the [Contribution Guidelines](CONTRIBUTING.md) before getting started. Opinions are welcomed. Even the dramatic ones.

---

<h2 align="center">License</h2>

Unless specified otherwise, this repository is licensed under [AGPL-3.0](LICENSE)

---

<h2 align="center">Under the hood</h2>

- **Everything is stored in SQLite.** Database: `%APPDATA%\Calisigh\Database\Calisigh.db` (macOS: `~/Library/Application Support/Calisigh/Database/`, Linux: `~/.local/share/Calisigh/Database/`). Alarms, your alarm sound list, your backgrounds, the selected sound and the volume all live there; the audio and image files themselves stay in the Calisigh folder and are tracked by relative path, so moving to a new PC or username doesn't break them. On first launch, old text and JSON files (`Events.txt`, `AlarmSounds.txt`, `Backgrounds.json` and so on) are imported once and renamed with a `.migrated` suffix. The SQLite driver is bundled in the backend jar, so users install nothing.
- **Holidays come from Calendarific.** One API call per year, then the result is cached in the same SQLite database, so each year is only fetched once. Offline, years you have already opened still show. You need your own free API key from [calendarific.com](https://calendarific.com). The installer offers to open the sign-up page, and Calisigh asks for the key the first time you open it (you can also add or change it any time in Settings). The key is checked with Calendarific and saved in `config.properties` in the Calisigh app-data folder (`%APPDATA%\Calisigh\` on Windows). Without a key everything else works, there are just no holidays.
- **Search and money live in two small files.** `frontend/src/lib/eventSearch.js` decides what matches, and the dropdown list and the highlighted cells both use it, so they never disagree. `frontend/src/lib/money.js` holds the one pattern for amounts (a symbol, then a number, with optional commas, cents and a `k` or `m` suffix). The highlighting, the search total and the chat context all read it. Sums are done in whole cents. An amount repeated in an event's title and notes counts once.
- **The chat assistant is told the date, a focused slice of your calendar and the totals.** Small models guess when handed a whole calendar and are poor at arithmetic, so the app sends the current date, the events in your chosen range (or today plus 14 days, up to 80 events), each event's amounts, a subtotal per day and a grand total. The assistant never changes your calendar itself: add, edit and delete proposals arrive as cards, and only a button press calls the API.
- **Building the backend:** `cd backend && mvn clean package`, then copy `target/CustomCalendar.jar` to `frontend/src-tauri/target/debug/` for local Tauri runs.

<h2 align="center">Credits</h2>

Holiday data by [Calendarific](https://calendarific.com).
