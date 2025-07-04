const express = require("express");
const path = require("path");
const fs = require("fs");
const { Pool } = require("pg");
const app = express();
const port = 3000;
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "museum_db",
  password: "1234",
  port: 5432,
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

pool
  .connect()
  .then(() => {
    console.log("Подключение к базе данных PostgreSQL успешно установлено.");
    return loadDataAndSaveToJson();
  })
  .catch((err) => {
    console.error("Ошибка подключения к базе данных:", err);
  });

async function loadDataAndSaveToJson() {
  try {
    const museumsResult = await pool.query("SELECT * FROM museums");
    const workhoursResult = await pool.query("SELECT * FROM museum_workhours");
    const typesResult = await pool.query("SELECT * FROM museum_type");
    const keywordsResult = await pool.query("SELECT * FROM museum_keyword");

    const museums = museumsResult.rows;
    const workhours = workhoursResult.rows;
    const types = typesResult.rows;
    const keywords = keywordsResult.rows;

    const structuredData = {
      museums: museums.map((museum) => {
        return {
          name: museum.name,
          coordinates: museum.coordinates,
          description: museum.short_description,
          long_description: museum.description,
          choosed: false,
          type: types
            .filter((type) => type.museum_id === museum.id)
            .map((type) => type.type),
          region: museum.region,
          keywords: keywords
            .filter((keyword) => keyword.museum_id === museum.id)
            .map((keyword) => keyword.keyword),
          Понедельник: formatWorkHours(
            workhours.filter(
              (wh) =>
                wh.museum_id === museum.id && wh.day_of_week === "понедельник"
            )
          ),
          Вторник: formatWorkHours(
            workhours.filter(
              (wh) => wh.museum_id === museum.id && wh.day_of_week === "вторник"
            )
          ),
          Среда: formatWorkHours(
            workhours.filter(
              (wh) => wh.museum_id === museum.id && wh.day_of_week === "среда"
            )
          ),
          Четверг: formatWorkHours(
            workhours.filter(
              (wh) => wh.museum_id === museum.id && wh.day_of_week === "четверг"
            )
          ),
          Пятница: formatWorkHours(
            workhours.filter(
              (wh) => wh.museum_id === museum.id && wh.day_of_week === "пятница"
            )
          ),
          Суббота: formatWorkHours(
            workhours.filter(
              (wh) => wh.museum_id === museum.id && wh.day_of_week === "суббота"
            )
          ),
          Воскресенье: formatWorkHours(
            workhours.filter(
              (wh) =>
                wh.museum_id === museum.id && wh.day_of_week === "воскресенье"
            )
          ),
          image: museum.image || "img/default_image.jpg",
          website: museum.website || "",
          слух: museum.hearing_impairment || false,
          зрение: museum.vision_impairment || false,
          коляска: museum.wheelchair_access || false,
        };
      }),
    };

    fs.writeFileSync(
      path.join(__dirname, "public", "museum.json"),
      JSON.stringify(structuredData, null, 2)
    );

    console.log("Данные успешно сохранены в museum.json");
  } catch (err) {
    console.error("Ошибка при загрузке данных:", err);
  }
}

function formatWorkHours(hoursArray) {
  if (hoursArray.length > 0) {
    const formattedHours = hoursArray.map((wh) => {
      if (wh.workstart === null || wh.workend === null) {
        return null;
      }
      const start = wh.workstart ? wh.workstart.slice(0, 5) : null;
      const end = wh.workend ? wh.workend.slice(0, 5) : null;
      return `${start}-${end}`;
    });
    return formattedHours.join(", ");
  }
  return null;
}

app.get("/api/museums", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM museums");
    res.json(result.rows);
  } catch (err) {
    console.error("Ошибка при получении данных:", err);
    res.status(500).send("Ошибка при получении данных");
  }
});

app.post("/save_museums", (req, res) => {
  const data = req.body;
  if (data && Array.isArray(data.museums)) {
    fs.writeFile(
      path.join(__dirname, "public", "museum.json"),
      JSON.stringify({ museums: data.museums }, null, 2),
      (err) => {
        if (err) {
          return res
            .status(500)
            .json({ success: false, error: "Ошибка при сохранении данных" });
        }
        res.json({ success: true });
      }
    );
  } else {
    res
      .status(400)
      .json({ success: false, error: "Нет данных или неверный формат" });
  }
});
app.listen(port, () => {
  console.log(`Сервер запущен на http://localhost:${port}`);
});
