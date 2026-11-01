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
  Create, edit, and delete events with more emotion than the situation requires.

- **Teen spirit AI chatbot**  
  A 19‑year‑old from the Midwest who comments on your calendar like it’s a diary you left open.

- **Customizable backgrounds, fonts, alert sounds, and more!**  
  Your calendar should look and sound like the mood you are in.

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

- **Alarms live in SQLite.** Database: `%APPDATA%\Calisigh\Database\Calisigh.db` (macOS: `~/Library/Application Support/Calisigh/Database/`, Linux: `~/.local/share/Calisigh/Database/`). Every alarm has a numeric `id`. On first launch an old `Events/Events.txt` is imported once and renamed `Events.txt.migrated`. The SQLite driver is bundled in the backend jar, so users install nothing.
- **Holidays come from Calendarific.** One API call per year, then the result is cached in the same SQLite database, so each year is only fetched once. Offline, years you have already opened still show. You need your own free API key from [calendarific.com](https://calendarific.com): put it in `config.properties` in the Calisigh app-data folder (`%APPDATA%\Calisigh\` on Windows) as `calendarific.api.key=...`. The file is created on first launch.
- **Building the backend:** `cd backend && mvn clean package`, then copy `target/CustomCalendar.jar` to `frontend/src-tauri/target/debug/` for local Tauri runs.

<h2 align="center">Credits</h2>

Holiday data by [Calendarific](https://calendarific.com).
