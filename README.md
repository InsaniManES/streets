# Streets

Street search API and Hebrew UI, with Elasticsearch as the backend. You can run everything with Docker—no Node, npm, or Elasticsearch installed on your machine.

---

## Prerequisites

Install **Docker** on your computer:

- **Windows or Mac:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker and Docker Compose).
- **Linux:** [Docker Engine](https://docs.docker.com/engine/install/) and the [Compose plugin](https://docs.docker.com/compose/install/linux/).

Check that Docker and Compose work:

```bash
docker --version
docker compose version
```

---

## Run the project (Docker only)

1. **Clone the repo** (if you don’t have it yet):

   ```bash
   git clone https://github.com/InsaniManES/streets
   cd streets
   ```

2. **Put the Excel data file in place** (if the repo doesn’t include it):
   - The loader expects an Excel file in the `data/` folder.
   - Default filename: `מטלת בית ארכיון שמות רחובות.xlsx`.
   - If your file has a different name, you can pass `EXCEL_FILE_NAME=yourfile.xlsx` when running the load step below.

3. **Start the app and Elasticsearch:**

   ```bash
   cd infra
   docker compose up -d --build
   ```

   The first run will build the app image and download the Elasticsearch image. Elasticsearch runs only inside Docker (not exposed to your host). The web app is served on port 3000.

4. **(Optional) Load the data into Elasticsearch** (only needed when loading another file or searching returns no results):

   We don’t load data automatically. The app and Elasticsearch start with an empty index, so you need to run the loader once so that search has data to work with:

   ```bash
   docker compose run --rm load
   ```

   You should see something like: `Indexed N rows into streets`. You only need to do this once (or again if you recreated the ES volume or want to reload the Excel file).

5. **Open the app:**

   In your browser go to: **http://localhost:3000**

   You can search streets (Hebrew UI) and use the API from the same origin.

6. **Stop everything:**

   ```bash
   docker compose down
   ```

   Data in Elasticsearch is stored in a Docker volume, so it will still be there the next time you run `docker compose up -d`.

---

## Summary of commands (from repo root)

| What you want to do | Command |
|---------------------|--------|
| Start app + Elasticsearch | `cd infra && docker compose up -d --build` |
| Load Excel data into ES | `cd infra && docker compose run --rm load` |
| Open the app | http://localhost:3000 |
| Stop | `cd infra && docker compose down` |

---

## Running without Docker (optional)

If you prefer to run the backend and UI locally (with Node.js and npm installed):

- See the **Scripts** section in the root `package.json` (`build`, `build:ui`, `build:all`, `start`, `load`).
- You’ll need Elasticsearch running (e.g. start it with Docker: `cd infra && docker compose up -d elasticsearch`, then temporarily expose port 9200 in `docker-compose.yml` if you want to run the loader from your host).
